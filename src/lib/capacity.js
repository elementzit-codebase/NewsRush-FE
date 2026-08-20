/**
 * Works out how much text actually fits inside a rendered canvas block, so the
 * character limit sent to /api/ai/expand describes the real slot on the page
 * rather than a number guessed at design time.
 *
 * The measurement is geometric: the body text's own computed font gives an
 * average glyph width, the block's width gives characters per line, and the
 * block's *designed* height (its CSS min-height, not its grown height) gives
 * the number of lines available below the label and headline.
 */

// A pangram plus digits and punctuation, so the average leans neither narrow
// nor wide. Widths are cached per font string — measuring is not free.
const SAMPLE =
  'The quick brown fox jumps over the lazy dog; 0123456789, and then it rested.'

const widthCache = new Map()
let scratchCanvas = null

function averageCharWidth(font) {
  const cached = widthCache.get(font)
  if (cached) return cached

  scratchCanvas ??= document.createElement('canvas')
  const ctx = scratchCanvas.getContext('2d')
  ctx.font = font
  const width = ctx.measureText(SAMPLE).width / SAMPLE.length

  if (!Number.isFinite(width) || width <= 0) return 0
  widthCache.set(font, width)
  return width
}

/**
 * @param {HTMLElement} blockEl  the block container (carries the min-height)
 * @param {HTMLElement} bodyEl   the element the body copy renders into
 * @returns {number|null} characters that fit, or null if it cannot be measured
 */
export function measureCapacity(blockEl, bodyEl) {
  if (!blockEl || !bodyEl) return null

  const bodyStyle = getComputedStyle(bodyEl)
  const font = `${bodyStyle.fontStyle} ${bodyStyle.fontWeight} ${bodyStyle.fontSize} ${bodyStyle.fontFamily}`
  const charWidth = averageCharWidth(font)
  if (!charWidth) return null

  const lineHeight = parseFloat(bodyStyle.lineHeight)
  const width = bodyEl.clientWidth
  if (!Number.isFinite(lineHeight) || lineHeight <= 0 || width <= 0) return null

  const blockStyle = getComputedStyle(blockEl)

  // The slot's designed height. Once a block is filled its box grows past this,
  // so measuring the live height would let each generation justify the last.
  const designedHeight = parseFloat(blockStyle.minHeight)
  if (!Number.isFinite(designedHeight) || designedHeight <= 0) return null

  // Distance from the top of the block to the top of the body covers the
  // padding, the section label and the headline — whatever height they took.
  const offsetToBody = bodyEl.getBoundingClientRect().top - blockEl.getBoundingClientRect().top
  const paddingBottom = parseFloat(blockStyle.paddingBottom) || 0
  const available = designedHeight - offsetToBody - paddingBottom

  const lines = Math.floor(available / lineHeight)
  const charsPerLine = Math.floor(width / charWidth)
  if (lines < 1 || charsPerLine < 1) return null

  return lines * charsPerLine
}
