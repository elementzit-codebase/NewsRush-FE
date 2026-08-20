import { DEFAULT_TEMPLATE } from '../data/templates'

/**
 * Per-edition template choices, kept in the browser.
 *
 * The backend has no field for a layout: `EditionUpdate` accepts only
 * newspaper_name, date, edition_label and status. Rather than smuggle layout
 * data into one of those, the choice lives client-side — so it is per browser,
 * and a colleague opening the same edition sees the default arrangement. The
 * copy itself is always on the server; only the arrangement is local.
 */
const key = (editionId) => `newsrush.templates.${editionId}`

/** @returns {{[pageNumber: string]: string}} */
export function readTemplates(editionId) {
  if (!editionId) return {}
  try {
    const raw = localStorage.getItem(key(editionId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    // Corrupt or unavailable storage falls back to the default layout.
    return {}
  }
}

export function writeTemplate(editionId, pageNumber, templateKey) {
  const next = { ...readTemplates(editionId), [pageNumber]: templateKey }
  try {
    localStorage.setItem(key(editionId), JSON.stringify(next))
  } catch {
    // Private browsing or a full quota: the choice still applies this session.
  }
  return next
}

export const templateKeyFor = (selection, pageNumber) =>
  selection[pageNumber] ?? DEFAULT_TEMPLATE
