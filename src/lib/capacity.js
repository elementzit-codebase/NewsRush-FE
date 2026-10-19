/**
 * Works out how much text fits in a section's box **on the printed sheet**.
 *
 * This deliberately measures the print geometry rather than the editor's
 * preview block. The preview block is a 150–190px placeholder that grows with
 * its content; measuring it reported ~126 characters for a box that prints
 * 2,430, so the AI was asked for a fraction of the copy the page needed and the
 * paper came out 11% full.
 *
 * The maths is geometric: the body font's average glyph width gives characters
 * per line, the column width gives how many fit across, and the row's share of
 * the sheet gives how many lines are available below the label and headline.
 */
import {
  COLUMNS,
  GRID_GAP,
  PX_PER_MM,
  TYPE,
  blockWidth,
  mmToPx,
  ptToMm,
  rowHeight,
} from '../data/printGeometry'
import { PAGES } from '../data/sections'
import { formatMalayalamNewspaperText } from './malayalamTypography'

// A pangram plus digits and punctuation, so the average leans neither narrow
// nor wide. Widths are cached per font string — measuring is not free.
const ENGLISH_SAMPLE =
  'The quick brown fox jumps over the lazy dog; 0123456789, and then it rested.'
const MALAYALAM_SAMPLE =
  '\u0D15\u0D47\u0D30\u0D33\u0D24\u0D4D\u0D24\u0D3F\u0D32\u0D46 \u0D35\u0D3E\u0D30\u0D4D\u0D24\u0D4D\u0D24\u0D15\u0D33\u0D4D \u0D1C\u0D28\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D1F\u0D46 \u0D1C\u0D40\u0D35\u0D3F\u0D24\u0D24\u0D4D\u0D24\u0D46 \u0D2E\u0D3E\u0D31\u0D4D\u0D31\u0D41\u0D28\u0D4D\u0D28\u0D41.'

const widthCache = new Map()
const headlineHeightCache = new Map()
let scratchCanvas = null

const SENTENCE_END = /[.!?…\u0964\u0965]+(?:["'’”)]*)?(?=\s|$)/gu

/** End offsets for complete English or Malayalam sentences. */
export function sentenceEndOffsets(text, language = 'english') {
  if (typeof text !== 'string' || !text) return []
  if (typeof Intl.Segmenter === 'function') {
    try {
      const locale = language === 'malayalam' ? 'ml' : 'en'
      const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' })
      const offsets = []
      let cursor = 0
      for (const part of segmenter.segment(text)) {
        const trimmed = part.segment.trimEnd()
        const end = cursor + trimmed.length
        if (/[.!?…\u0964\u0965]+(?:["'’”)]*)$/.test(trimmed)) offsets.push(end)
        cursor += part.segment.length
      }
      if (offsets.length) return offsets
    } catch {
      // Fall back to punctuation scanning if the runtime lacks this locale.
    }
  }
  return [...text.matchAll(SENTENCE_END)].map((match) => match.index + match[0].length)
}

/** Keeps the longest complete-sentence prefix within a character capacity. */
export function truncateAtSentenceBoundary(text, limit, language = 'english') {
  if (typeof text !== 'string' || text.length <= limit) return text ?? ''
  const end = sentenceEndOffsets(text, language).filter((offset) => offset <= limit).at(-1)
  return end ? text.slice(0, end).trimEnd() : ''
}

function averageCharWidth(font, sample) {
  const fontLoadState = typeof document === 'undefined' ? 'unavailable' : document.fonts?.status ?? 'unavailable'
  const cacheKey = `${fontLoadState}\u0000${font}\u0000${sample}`
  const cached = widthCache.get(cacheKey)
  if (cached) return cached

  // No canvas outside a browser; callers fall back to the static table.
  if (typeof document === 'undefined') return 0

  scratchCanvas ??= document.createElement('canvas')
  const ctx = scratchCanvas.getContext('2d')
  ctx.font = font
  const width = ctx.measureText(sample).width / sample.length

  if (!Number.isFinite(width) || width <= 0) return 0
  widthCache.set(cacheKey, width)
  return width
}

/**
 * Characters that fit in a rectangle of body text.
 * @returns {number|null} null when the font cannot be measured
 */
export function charsThatFit({ widthPx, heightPx, font, lineHeightPx, sample = ENGLISH_SAMPLE }) {
  const charWidth = averageCharWidth(font, sample)
  if (!charWidth || widthPx <= 0 || heightPx <= 0 || lineHeightPx <= 0) return null

  const lines = Math.floor(heightPx / lineHeightPx)
  const perLine = Math.floor(widthPx / charWidth)
  if (lines < 1 || perLine < 1) return null

  // Average glyph width cannot guarantee arbitrary copy. Leave a small margin
  // for wider words, justification, and print rounding; the print view checks
  // the exact rendered box and removes only whole trailing sentences if needed.
  return Math.floor(lines * perLine * 0.95)
}

/** Keep AI requests below the server's `max_tokens: 1500` response ceiling. */
export const MAX_REQUESTABLE_CHARS = 4200
export const MIN_FILL_RATIO = 0.82

// The expand endpoint aims for about 92% of its requested character limit.
// Request a little above the printable limit so that its normal shortfall
// lands near the space available; generated text is still capped at the
// printable limit and then checked against the actual PDF boxes.
const AI_GENERATION_YIELD = 0.92

export function generationTargetFor(printableLimit) {
  const limit = Number.isFinite(printableLimit) ? Math.max(0, printableLimit) : 0
  return Math.min(MAX_REQUESTABLE_CHARS, Math.ceil(limit / AI_GENERATION_YIELD))
}

// Geometry is constant for a given set of templates, so each arrangement is
// measured once and cached under its own signature.
const capacityTables = new Map()
const columnCapacityTables = new Map()

function headlineAllowanceMm(block, title, language) {
  const fallback = TYPE.headlineAllowance[block.span]
  if (typeof document === 'undefined' || typeof title !== 'string' || !title.trim()) {
    return fallback
  }

  const isMalayalam = language === 'malayalam'
  const displayTitle = isMalayalam ? formatMalayalamNewspaperText(title) : title
  const fontLoadState = document.fonts?.status ?? 'unavailable'
  const cacheKey = `${fontLoadState}:${language}:${block.span}:${displayTitle}`
  const cached = headlineHeightCache.get(cacheKey)
  if (Number.isFinite(cached)) return cached

  // Measure the same headline markup used on the sheet at its physical width.
  // Template changes affect both this width and the title's wrap count.
  const root = document.createElement('div')
  root.className = `edition-${language}`
  root.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    'visibility:hidden',
    'pointer-events:none',
    `width:${mmToPx(blockWidth(block.span))}px`,
  ].join(';')

  const heading = document.createElement('h2')
  const sizeClass = isMalayalam
    ? 'text-[20pt]'
    : block.span === 3
      ? 'text-[22pt]'
      : block.span === 2
        ? 'text-[16pt]'
        : 'text-[13pt]'
  heading.className = `mt-1 font-serif leading-[1.1] ${sizeClass}`
  heading.textContent = displayTitle
  root.append(heading)
  document.body.append(root)

  const style = document.defaultView?.getComputedStyle(heading)
  const headingHeightPx = heading.getBoundingClientRect().height
  const marginTopPx = Number.parseFloat(style?.marginTop ?? '0') || 0
  root.remove()

  const measured = (headingHeightPx + marginTopPx) / PX_PER_MM
  const allowance = Number.isFinite(measured) && measured > 0 ? measured : fallback
  headlineHeightCache.set(cacheKey, allowance)
  return allowance
}

function buildCapacityTable(pages, language, titleSectionKey, sectionTitle) {
  const table = {}
  const perColumnTable = {}
  const isMalayalam = language === 'malayalam'
  const bodyPt = isMalayalam ? TYPE.malayalamBodyPt : TYPE.bodyPt
  const leading = isMalayalam ? TYPE.malayalamBodyLeading : TYPE.bodyLeading
  const bodyFont = isMalayalam
    ? `${mmToPx(ptToMm(bodyPt))}px "Anek Malayalam", sans-serif`
    : `${mmToPx(ptToMm(bodyPt))}px ${getComputedStyle(document.body).fontFamily || 'sans-serif'}`
  const sample = isMalayalam ? MALAYALAM_SAMPLE : ENGLISH_SAMPLE
  const lineHeightPx = mmToPx(ptToMm(bodyPt * leading))

  for (const page of pages) {
    page.rows.forEach((row, rowIndex) => {
      const height = rowHeight(page, rowIndex)

      for (const block of row.blocks) {
        const columns = COLUMNS[block.span]
        const columnWidthMm =
          (blockWidth(block.span) - GRID_GAP * (columns - 1)) / columns

        const textHeightMm =
          height -
          TYPE.labelHeight -
          headlineAllowanceMm(
            block,
            block.section_key === titleSectionKey ? sectionTitle : '',
            language,
          ) -
          TYPE.headlineGap

        const perColumn = charsThatFit({
          widthPx: mmToPx(columnWidthMm),
          heightPx: mmToPx(textHeightMm),
          font: bodyFont,
          lineHeightPx,
          sample,
        })

        // Fall back to the static value when the font cannot be measured.
        const measuredPerColumn = perColumn ?? block.charLimit / columns
        perColumnTable[block.section_key] = measuredPerColumn
        // This is the section's print capacity, so keep the full geometric
        // result. MAX_REQUESTABLE_CHARS is only an AI endpoint limit; applying
        // it here made large template rows look full in the editor even when
        // their printed boxes had room for substantially more copy.
        table[block.section_key] = measuredPerColumn * columns
      }
    })
  }
  return { table, perColumnTable }
}

// Key the measured table by actual geometry, so a changed row weight/span
// cannot reuse a stale table even if a caller retains the same template key.
const signatureOf = (pages) =>
  pages
    .map((page) =>
      `${page.page_number}:` +
      page.rows
        .map((row) =>
          `${row.weight}[${row.blocks
            .map((block) => `${block.section_key},${block.span},${block.size ?? ''},${block.charLimit ?? ''}`)
            .join(';')}]`,
        )
        .join('/'),
    )
    .join('|')

const capacitySignature = (pages, language, sectionKey, sectionTitle) =>
  `${language}:${document.fonts?.status ?? 'unavailable'}:${signatureOf(pages)}:${sectionKey}:${sectionTitle}`

/**
 * Characters that fit this section's printed box under the given arrangement,
 * capped to what the server can safely generate.
 *
 * `pages` matters: a template that gives a section a wider or taller box also
 * gives it a larger capacity, and the limit sent to /api/ai/expand has to
 * follow, or copy written for one layout will overrun another.
 *
 * Falls back to the static value in sections.js when there is no DOM to measure
 * the font with.
 */
export function printCapacityFor(sectionKey, pages = PAGES, language = 'english', sectionTitle = '') {
  if (typeof document === 'undefined') return null

  const signature = capacitySignature(pages, language, sectionKey, sectionTitle)
  if (!capacityTables.has(signature)) {
    const result = buildCapacityTable(pages, language, sectionKey, sectionTitle)
    capacityTables.set(signature, result.table)
    columnCapacityTables.set(signature, result.perColumnTable)
  }
  return capacityTables.get(signature)[sectionKey] ?? null
}

/** Estimated capacity for the requested number of leading text columns. */
export function printColumnsCapacityFor(
  sectionKey,
  columnCount,
  pages = PAGES,
  language = 'english',
  sectionTitle = '',
) {
  const block = pages.flatMap((page) => page.blocks).find((item) => item.section_key === sectionKey)
  if (!block) return null

  const columns = COLUMNS[block.span]
  const requestedCount = Number.isFinite(columnCount) ? columnCount : columns
  const count = Math.max(0, Math.min(columns, requestedCount))
  if (typeof document === 'undefined') {
    return Math.round(((block.charLimit ?? 2000) / columns) * count)
  }

  printCapacityFor(sectionKey, pages, language, sectionTitle)
  const signature = capacitySignature(pages, language, sectionKey, sectionTitle)
  const perColumn = columnCapacityTables.get(signature)?.[sectionKey]
  return Number.isFinite(perColumn)
    ? Math.round(perColumn * count)
    : Math.round(((block.charLimit ?? 2000) / columns) * count)
}

/**
 * Conservative fallback ratios for photo layouts whose section geometry is
 * unavailable (for example, a caller outside the normal page templates).
 */
export const PHOTO_CAPACITY_RATIOS = {
  firstNews: {
    3: 0.88,
    2: 0.84,
    1: 0.78,
  },
  otherNews: {
    3: 0.96,
    2: 0.92,
    1: 0.86,
  },
}

const placementFor = (sectionKey, pages) => {
  for (const page of pages) {
    const rowIndex = page.rows.findIndex((row) =>
      row.blocks.some((block) => block.section_key === sectionKey),
    )
    if (rowIndex < 0) continue
    const block = page.rows[rowIndex].blocks.find((candidate) => candidate.section_key === sectionKey)
    return { page, rowIndex, block }
  }
  return null
}

function bodyTextHeightMm(page, rowIndex, block, sectionTitle, language) {
  return Math.max(
    1,
    rowHeight(page, rowIndex) -
      TYPE.labelHeight -
      headlineAllowanceMm(block, sectionTitle, language) -
      TYPE.headlineGap -
      3, // section top padding and the body top margin
  )
}

function estimatedCaptionHeightMm(caption, widthMm, defaultLines) {
  const text = typeof caption === 'string' ? caption.trim() : ''
  const charsPerLine = Math.max(10, Math.floor(widthMm / 1.5))
  const lines = text ? Math.ceil(text.length / charsPerLine) : defaultLines
  return lines * ptToMm(6.8 * 1.15) + (text ? 0.8 : 0)
}

function leadPhotoGeometry(block, textHeightMm, caption = '') {
  const totalColumns = COLUMNS[block.span]
  const leftColumns = Math.max(1, totalColumns - 2)
  const rightColumns = totalColumns - leftColumns
  const columnWidthMm =
    (blockWidth(block.span) - GRID_GAP * (totalColumns - 1)) / totalColumns
  const photoWidthMm = columnWidthMm * rightColumns + GRID_GAP * (rightColumns - 1)
  const photoHeightMm = block.span === 3 ? 42 : block.span === 2 ? 36 : 28
  const captionHeightMm = estimatedCaptionHeightMm(caption, photoWidthMm, 1)
  const photoOccupancyMm = photoHeightMm + 1.2 + 0.6 + captionHeightMm
  const rightTextHeightMm = Math.max(0, textHeightMm - photoOccupancyMm)
  const leftArea = leftColumns * textHeightMm
  const rightArea = rightColumns * rightTextHeightMm
  const totalTextArea = leftArea + rightArea

  return {
    capacityRatio: totalTextArea / (totalColumns * textHeightMm),
    leftRatio: totalTextArea ? leftArea / totalTextArea : 1,
  }
}

function photoCapacityRatio({ block, textHeightMm, isFirstSection, caption = '' }) {
  const columns = COLUMNS[block.span]
  if (isFirstSection) {
    return leadPhotoGeometry(block, textHeightMm, caption).capacityRatio
  }

  const columnWidthMm =
    (blockWidth(block.span) - GRID_GAP * (columns - 1)) / columns
  const photoHeightMm = block.size === 'small' ? 24 : 33
  const captionHeightMm = estimatedCaptionHeightMm(caption, columnWidthMm, 2)
  const photoOccupancyMm = photoHeightMm + 1.5 + 0.8 + captionHeightMm
  const photoColumnTextHeightMm = Math.max(0, textHeightMm - photoOccupancyMm)
  const totalTextArea = (columns - 1) * textHeightMm + photoColumnTextHeightMm

  return totalTextArea / (columns * textHeightMm)
}

/**
 * Returns the effective character limit for a section, taking into account
 * whether an active photo ('ai' or 'upload') is present.
 *
 * When hasPhoto is false (photoMode === 'none'), restores the canonical base limit.
 */
export function effectiveCapacityFor({
  sectionKey,
  pages = PAGES,
  language = 'english',
  hasPhoto = false,
  isFirstSection = false,
  photoCaption = '',
  sectionTitle = '',
}) {
  const block = pages.flatMap((p) => p.blocks).find((b) => b.section_key === sectionKey)
  const base = printCapacityFor(sectionKey, pages, language, sectionTitle) ?? block?.charLimit ?? 2000

  if (!hasPhoto) return base

  const placement = placementFor(sectionKey, pages)
  const ratio = placement
    ? photoCapacityRatio({
        block: placement.block,
        textHeightMm: bodyTextHeightMm(
          placement.page,
          placement.rowIndex,
          placement.block,
          sectionTitle,
          language,
        ),
        isFirstSection,
        caption: photoCaption,
      })
    : (isFirstSection ? PHOTO_CAPACITY_RATIOS.firstNews : PHOTO_CAPACITY_RATIOS.otherNews)[block?.span ?? 2] ?? 0.8

  return Math.round(base * ratio)
}

/** Character capacity for the leading columns before copy flows under a lead photo. */
export function leadStoryLeftCharLimitFor({
  sectionKey,
  pages = PAGES,
  language = 'english',
  sectionTitle = '',
}) {
  const placement = placementFor(sectionKey, pages)
  if (!placement) return null

  const leftColumns = Math.max(1, COLUMNS[placement.block.span] - 2)
  return printColumnsCapacityFor(sectionKey, leftColumns, pages, language, sectionTitle)
}

/**
 * Calculates the balanced geometric text split ratio for a lead story with photo.
 * Ensures the text volume assigned to the columns underneath the photo matches
 * the physical area available, eliminating text cutoff.
 */
export function getLeadStoryLeftRatio(
  block,
  totalRows = 3,
  rowHeightMm,
  caption = '',
  sectionTitle = '',
  language = 'english',
) {
  if (block && Number.isFinite(rowHeightMm)) {
    const placement = { ...block, span: block.span ?? 3 }
    const bodyHeight = Math.max(
      1,
      rowHeightMm -
        TYPE.labelHeight -
        headlineAllowanceMm(placement, sectionTitle, language) -
        TYPE.headlineGap -
        3,
    )
    return leadPhotoGeometry(placement, bodyHeight, caption).leftRatio
  }

  // Fallback when a caller has no row geometry available.
  const ratios = { 3: totalRows === 2 ? 0.69 : 0.70, 2: totalRows === 2 ? 0.40 : 0.43, 1: 0.58 }
  return ratios[block?.span ?? 3] ?? 0.7
}

/**
 * Splits text for the lead section layout where a photo occupies the right 2 columns.
 * Left text fills the first columns (full height); right text flows underneath the photo.
 * Looks for natural paragraph, sentence, or word boundaries so text flows
 * seamlessly without awkward word breaks.
 */
export function splitLeadStoryText(
  text,
  span = 3,
  leftRatio = null,
  leftCharLimit = null,
  language = 'english',
) {
  if (!text || typeof text !== 'string') {
    return { leftText: '', rightText: '' }
  }

  const trimmed = text.trim()
  if (
    trimmed.length < 150 &&
    (!Number.isFinite(leftCharLimit) || trimmed.length <= leftCharLimit)
  ) {
    return { leftText: trimmed, rightText: '' }
  }

  // Default ratios based on section span:
  // span 3 (5 columns total: 3 left, 2 right under photo) -> ~78% left
  // span 2 (3 columns total: 1 left, 2 right under photo) -> ~50% left
  // span 1 (2 columns total: 1 left, 1 right under photo) -> ~68% left
  const defaultRatios = { 3: 0.78, 2: 0.50, 1: 0.68 }
  const ratio = leftRatio ?? defaultRatios[span] ?? 0.74

  if (Number.isFinite(leftCharLimit) && leftCharLimit > 0) {
    const sentenceEnds = sentenceEndOffsets(trimmed, language)
    const leftCapacity = Math.max(0, Math.min(trimmed.length, leftCharLimit))
    // Spread the available copy over both text areas according to their
    // printable area. The left columns still have a hard capacity, but filling
    // them completely before starting the text below the photo leaves that
    // second area blank for shorter stories.
    const balancedTarget = Math.min(
      leftCapacity,
      Math.round(trimmed.length * Math.max(0, Math.min(1, ratio))),
    )
    let splitIndex = sentenceEnds.filter((offset) => offset <= balancedTarget).at(-1)
    const beforeTarget = [...trimmed.slice(0, balancedTarget).matchAll(/\s/gu)].at(-1)
    const wordSplitIndex = beforeTarget ? beforeTarget.index + beforeTarget[0].length : 0

    // If the previous sentence ends far before the area-balanced point, split
    // at a word boundary near the target so the left and right text areas stay
    // filled in proportion to their available space.
    const sentenceGapTolerance = Math.max(24, Math.floor(balancedTarget * 0.025))
    if (
      wordSplitIndex &&
      (!splitIndex || wordSplitIndex - splitIndex > sentenceGapTolerance)
    ) {
      splitIndex = wordSplitIndex
    }

    // A long first sentence must not force the entire story into the full-height
    // columns. Continue that sentence below the photo at a safe text boundary.
    if (!splitIndex) {
      if (beforeTarget) {
        splitIndex = beforeTarget.index + beforeTarget[0].length
      } else {
        const afterLimit = trimmed.slice(balancedTarget).match(/\s/u)
        if (afterLimit) {
          splitIndex = balancedTarget + afterLimit.index + afterLimit[0].length
        } else if (typeof Intl.Segmenter === 'function') {
          try {
            const locale = language === 'malayalam' ? 'ml' : 'en'
            const segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' })
            for (const part of segmenter.segment(trimmed)) {
              const end = part.index + part.segment.length
              if (end > balancedTarget) break
              splitIndex = end
            }
          } catch {
            // Keep the ratio-based split below if grapheme segmentation is unavailable.
          }
        }
      }
    }

    if (splitIndex) {
      return {
        leftText: trimmed.slice(0, splitIndex).trimEnd(),
        rightText: trimmed.slice(splitIndex).trimStart(),
      }
    }
  }

  const targetLength = Math.round(trimmed.length * ratio)

  // 1. Check for paragraph break near target
  const pRange = 120
  const searchStartP = Math.max(0, targetLength - pRange)
  const searchEndP = Math.min(trimmed.length, targetLength + pRange)
  const pMatch = trimmed.slice(searchStartP, searchEndP).lastIndexOf('\n\n')
  if (pMatch !== -1) {
    const splitIndex = searchStartP + pMatch + 2
    return {
      leftText: trimmed.slice(0, splitIndex).trim(),
      rightText: trimmed.slice(splitIndex).trim(),
    }
  }

  // 2. Check for single newline
  const nMatch = trimmed.slice(searchStartP, searchEndP).lastIndexOf('\n')
  if (nMatch !== -1) {
    const splitIndex = searchStartP + nMatch + 1
    return {
      leftText: trimmed.slice(0, splitIndex).trim(),
      rightText: trimmed.slice(splitIndex).trim(),
    }
  }

  // 3. Prefer a complete sentence boundary near the target.
  const sRange = 70
  const searchStartS = Math.max(0, targetLength - sRange)
  const searchEndS = Math.min(trimmed.length, targetLength + sRange)
  const sub = trimmed.slice(searchStartS, searchEndS)
  let bestIdx = -1
  for (const match of sub.matchAll(SENTENCE_END)) {
    if (match.index > bestIdx) bestIdx = match.index + match[0].length
  }
  if (bestIdx !== -1) {
    const splitIndex = searchStartS + bestIdx
    return {
      leftText: trimmed.slice(0, splitIndex).trim(),
      rightText: trimmed.slice(splitIndex).trim(),
    }
  }

  // 4. Fall back to word boundary (space)
  const wRange = 40
  const searchStartW = Math.max(0, targetLength - wRange)
  const searchEndW = Math.min(trimmed.length, targetLength + wRange)
  const wMatch = trimmed.slice(searchStartW, searchEndW).lastIndexOf(' ')
  if (wMatch !== -1) {
    const splitIndex = searchStartW + wMatch + 1
    return {
      leftText: trimmed.slice(0, splitIndex).trim(),
      rightText: trimmed.slice(splitIndex).trim(),
    }
  }

  // Hard cut fallback
  return {
    leftText: trimmed.slice(0, targetLength).trim(),
    rightText: trimmed.slice(targetLength).trim(),
  }
}
