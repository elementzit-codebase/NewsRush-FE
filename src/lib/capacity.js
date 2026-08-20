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
  TYPE,
  blockWidth,
  mmToPx,
  ptToMm,
  rowHeight,
} from '../data/printGeometry'
import { PAGES } from '../data/sections'

// A pangram plus digits and punctuation, so the average leans neither narrow
// nor wide. Widths are cached per font string — measuring is not free.
const SAMPLE =
  'The quick brown fox jumps over the lazy dog; 0123456789, and then it rested.'

const widthCache = new Map()
let scratchCanvas = null

function averageCharWidth(font) {
  const cached = widthCache.get(font)
  if (cached) return cached

  // No canvas outside a browser; callers fall back to the static table.
  if (typeof document === 'undefined') return 0

  scratchCanvas ??= document.createElement('canvas')
  const ctx = scratchCanvas.getContext('2d')
  ctx.font = font
  const width = ctx.measureText(SAMPLE).width / SAMPLE.length

  if (!Number.isFinite(width) || width <= 0) return 0
  widthCache.set(font, width)
  return width
}

/**
 * Characters that fit in a rectangle of body text.
 * @returns {number|null} null when the font cannot be measured
 */
export function charsThatFit({ widthPx, heightPx, font, lineHeightPx }) {
  const charWidth = averageCharWidth(font)
  if (!charWidth || widthPx <= 0 || heightPx <= 0 || lineHeightPx <= 0) return null

  const lines = Math.floor(heightPx / lineHeightPx)
  const perLine = Math.floor(widthPx / charWidth)
  if (lines < 1 || perLine < 1) return null

  return lines * perLine
}

/**
 * The server targets 92% of the limit it is given and caps generation at
 * `max_tokens: 1500`. Asking for the full 4,995 characters the biggest blocks
 * hold would put the response near that ceiling, and a reply truncated
 * mid-JSON makes the server fall back to returning raw text. Capping here keeps
 * generation comfortably inside the ceiling; the two largest blocks print
 * around 85% full rather than 100%.
 */
export const MAX_REQUESTABLE_CHARS = 4200

// Geometry is constant for a given set of templates, so each arrangement is
// measured once and cached under its own signature.
const capacityTables = new Map()

function buildCapacityTable(pages) {
  const table = {}
  const bodyFont = `${mmToPx(ptToMm(TYPE.bodyPt))}px ${
    getComputedStyle(document.body).fontFamily || 'sans-serif'
  }`
  const lineHeightPx = mmToPx(ptToMm(TYPE.bodyPt * TYPE.bodyLeading))

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
          TYPE.headlineAllowance[block.span] -
          TYPE.headlineGap

        const perColumn = charsThatFit({
          widthPx: mmToPx(columnWidthMm),
          heightPx: mmToPx(textHeightMm),
          font: bodyFont,
          lineHeightPx,
        })

        // Fall back to the static value when the font cannot be measured.
        table[block.section_key] = perColumn
          ? Math.min(perColumn * columns, MAX_REQUESTABLE_CHARS)
          : Math.min(block.charLimit, MAX_REQUESTABLE_CHARS)
      }
    })
  }
  return table
}

// Two arrangements differ only by which template each page uses.
const signatureOf = (pages) =>
  pages.map((page) => `${page.page_number}:${page.templateKey ?? 'default'}`).join('|')

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
export function printCapacityFor(sectionKey, pages = PAGES) {
  if (typeof document === 'undefined') return null

  const signature = signatureOf(pages)
  if (!capacityTables.has(signature)) {
    capacityTables.set(signature, buildCapacityTable(pages))
  }
  return capacityTables.get(signature)[sectionKey] ?? null
}
