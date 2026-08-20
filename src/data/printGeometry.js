/**
 * Geometry of the printed tabloid sheet, in millimetres.
 *
 * This is the single source of truth for the printed page: PrintEdition.jsx
 * lays the sheets out from it, and lib/capacity.js works out how much text fits
 * in each block from it. Keeping one copy matters — when the capacity maths and
 * the layout disagree, the AI is asked for the wrong amount of copy and the
 * page prints half empty, which is exactly the bug this replaced.
 *
 * The one value that cannot be read from here is `@page { size: ... }` in
 * index.css, which has to be a static literal. It must match SHEET.
 */

export const SHEET = { width: 289, height: 380 }
export const SHEET_PADDING = 10
export const GRID_GAP = 4
export const GRID_COLUMNS = 3

/** Space the grid gives up to the furniture above and below it. */
export const CHROME = {
  // Page 1 carries the full masthead; later pages a single running line.
  mastheadHeight: 26,
  runningHeadHeight: 8,
  footerHeight: 6,
  // The grid's own margin above and below.
  gridMargin: 3,
}

/**
 * Columns a block's body text splits into, by its span on the 3-column grid.
 * A newspaper reads as narrow measures, so even a one-third block splits in two.
 */
export const COLUMNS = { 1: 2, 2: 3, 3: 5 }

/** Type sizes in points. Headline size varies with how wide the block is. */
export const TYPE = {
  bodyPt: 8.5,
  bodyLeading: 1.35,
  labelHeight: 3.5,
  headlinePt: { 1: 13, 2: 16, 3: 22 },
  // Headlines wrap to a second line often enough that reserving one line would
  // push body text out of the box.
  headlineAllowance: { 1: 10, 2: 10, 3: 12 },
  // Gap between the headline and the body columns.
  headlineGap: 2,
}

export const MM_PER_PT = 0.3528
/** CSS reference pixels per millimetre, at the 96dpi CSS standard. */
export const PX_PER_MM = 96 / 25.4

export const mmToPx = (mm) => mm * PX_PER_MM
export const ptToMm = (pt) => pt * MM_PER_PT

/** Width available to the grid, once the sheet's padding is removed. */
export const contentWidth = () => SHEET.width - SHEET_PADDING * 2

/** Width of a block spanning `span` of the three columns. */
export function blockWidth(span) {
  const column = (contentWidth() - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS
  return column * span + GRID_GAP * (span - 1)
}

/** Height the block grid occupies on a given page. */
export function gridHeight(pageNumber) {
  const head = pageNumber === 1 ? CHROME.mastheadHeight : CHROME.runningHeadHeight
  return (
    SHEET.height - SHEET_PADDING * 2 - head - CHROME.footerHeight - CHROME.gridMargin * 2
  )
}

/**
 * Height of one row, from its share of the page's row weights.
 * @param {{page_number: number, rows: {weight: number}[]}} page
 */
export function rowHeight(page, rowIndex) {
  const weights = page.rows.map((row) => row.weight)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const available = gridHeight(page.page_number) - GRID_GAP * (page.rows.length - 1)
  return (weights[rowIndex] / total) * available
}
