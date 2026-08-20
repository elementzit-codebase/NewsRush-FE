/**
 * Edition presentation metadata. The four status values are exactly the ones
 * the backend stores on `editions.status`; `ready` is set by the server when
 * /validate finds all 19 sections completed.
 */
export const STATUS_LABELS = {
  draft: 'Draft',
  in_progress: 'In Progress',
  ready: 'Ready to Print',
  completed: 'Completed',
}

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Completed' },
]

export const SORT_OPTIONS = [
  { key: 'latest', label: 'Latest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'title', label: 'Name (A-Z)' },
]

const ART_KEYS = ['city', 'tech', 'green', 'people']

/**
 * Picks a stable thumbnail palette from the edition's UUID, so a given edition
 * always draws the same cover without the server storing anything for it.
 */
export function artFor(id = '') {
  let sum = 0
  for (const char of id) sum += char.charCodeAt(0)
  return ART_KEYS[sum % ART_KEYS.length]
}
