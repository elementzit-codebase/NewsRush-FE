/**
 * Single seam between the UI and the FastAPI backend.
 *
 * Every data route (`/api/editions`, `/api/ai`, most of `/api/users`) sits
 * behind `get_current_user`, so requests carry a bearer access token. Access
 * tokens are short-lived (15 minutes by default), so a 401 triggers one refresh
 * attempt against `/api/auth/refresh` and a replay of the original request.
 *
 * `API_BASE` is empty by default: the Vite dev server proxies `/api` to the
 * backend, which keeps requests same-origin and out of the CORS allow-list.
 */

export const API_BASE = import.meta.env.VITE_API_BASE ?? ''

const ACCESS_KEY = 'newsrush.access_token'
const REFRESH_KEY = 'newsrush.refresh_token'

/* ------------------------------------------------------------ token store */

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY)
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY)

export function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem(ACCESS_KEY, access_token)
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

/** Notified when the session dies, so the app can drop to the login screen. */
let onSessionExpired = () => {}
export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler
}

/* ---------------------------------------------------------------- errors */

/** FastAPI reports errors as `detail`, either a string or a 422 error array. */
function describeError(payload, status) {
  const detail = payload?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        // 422 entries carry the offending field in `loc`; naming it is far more
        // useful than "value is not a valid email address" on its own.
        const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : null
        return field && field !== 'body' ? `${field}: ${item.msg}` : item.msg
      })
      .join(', ')
  }
  return `Request failed (${status}).`
}

async function readError(response) {
  try {
    return describeError(await response.json(), response.status)
  } catch {
    return `Request failed (${response.status}).`
  }
}

/* --------------------------------------------------------------- refresh */

// A single in-flight refresh is shared, so parallel 401s (the dashboard fires
// several requests at once) do not each rotate the refresh token.
let refreshInFlight = null

async function refreshAccessToken() {
  const refresh_token = getRefreshToken()
  if (!refresh_token) return false

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token }),
      })
      if (!response.ok) return false
      setTokens(await response.json())
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

/* --------------------------------------------------------------- request */

async function send(path, { method, body, isForm }) {
  const headers = {}
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  // FormData sets its own multipart boundary, so the header is left alone.
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
}

async function request(path, { method = 'GET', body, isForm = false, auth = true } = {}) {
  let response
  try {
    response = await send(path, { method, body, isForm })
  } catch {
    throw new Error('Cannot reach the server. Is the backend running on port 8000?')
  }

  // One retry after refreshing, but never for the auth routes themselves —
  // a failed login is a real 401, not an expired session.
  if (response.status === 401 && auth) {
    if (await refreshAccessToken()) {
      response = await send(path, { method, body, isForm })
    } else {
      clearTokens()
      onSessionExpired()
      throw new Error('Your session has expired. Please sign in again.')
    }
  }

  if (!response.ok) throw new Error(await readError(response))
  if (response.status === 204) return null
  return response.json()
}

/* ------------------------------------------------------------ pagination */

// The list routes return {items, total, page, page_size, total_pages} and cap
// page_size at 100. The workspace searches, filters and sorts across the whole
// collection, and the server offers no query parameters for any of that, so the
// pages are walked and recombined here rather than paginating in the UI.
const MAX_PAGE_SIZE = 100

async function fetchAllPages(path) {
  const separator = path.includes('?') ? '&' : '?'
  const query = (page) => `${path}${separator}page=${page}&page_size=${MAX_PAGE_SIZE}`

  const first = await request(query(1))
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page += 1) {
    items.push(...(await request(query(page))).items)
  }
  return items
}

/* ------------------------------------------------------------------ auth */

/** POST /api/auth/register — creates a user that a system user must approve. */
export const register = (data) =>
  request('/api/auth/register', { method: 'POST', body: data, auth: false })

/** POST /api/auth/login — returns both tokens plus the user record. */
export async function login({ email, password }) {
  const session = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  })
  setTokens(session)
  return session
}

/** POST /api/auth/logout — revokes the refresh token server-side. */
export async function logout() {
  const refresh_token = getRefreshToken()
  try {
    if (refresh_token) {
      await request('/api/auth/logout', { method: 'POST', body: { refresh_token }, auth: false })
    }
  } finally {
    // The local session is dropped even if the server call fails.
    clearTokens()
  }
}

/**
 * POST /api/auth/forgot-password — issues a single-use reset token.
 * When Microsoft Graph mail is not configured the server returns the email
 * payload (including `reset_url`) instead of sending it.
 */
export const forgotPassword = (email) =>
  request('/api/auth/forgot-password', { method: 'POST', body: { email }, auth: false })

/** POST /api/auth/reset-password — consumes the token from the reset link. */
export const resetPassword = ({ token, newPassword }) =>
  request('/api/auth/reset-password', {
    method: 'POST',
    body: { token, new_password: newPassword },
    auth: false,
  })

/* ----------------------------------------------------------------- users */

/** GET /api/users/me — the signed-in user. */
export const getMe = () => request('/api/users/me')

/** GET /api/users — system users only. `status` is all | pending | approved. */
export const listUsers = (status = 'all') =>
  fetchAllPages(`/api/users?approval_status=${encodeURIComponent(status)}`)

/** PATCH /api/users/{id}/approve — system users only. */
export const approveUser = (userId) => request(`/api/users/${userId}/approve`, { method: 'PATCH' })

/** PATCH /api/users/{id}/reject — system users only. */
export const rejectUser = (userId) => request(`/api/users/${userId}/reject`, { method: 'PATCH' })

/** PATCH /api/users/me/password */
export const changePassword = ({ currentPassword, newPassword }) =>
  request('/api/users/me/password', {
    method: 'PATCH',
    body: { current_password: currentPassword, new_password: newPassword },
  })

/** PUT /api/users/me/profile-pic — JPEG, PNG or WebP, up to 5 MB. */
export function uploadProfilePicture(file) {
  const form = new FormData()
  form.append('file', file)
  return request('/api/users/me/profile-pic', { method: 'PUT', body: form, isForm: true })
}

/** DELETE /api/users/me/profile-pic */
export const removeProfilePicture = () =>
  request('/api/users/me/profile-pic', { method: 'DELETE' })

/* -------------------------------------------------------------- editions */

/** GET /api/editions — only the signed-in user's editions, newest date first. */
export const listEditions = () => fetchAllPages('/api/editions')

/**
 * GET /api/editions/{id} — the edition plus its saved sections. The embedded
 * `sections` list is complete; only the standalone sections route is paginated.
 */
export const getEdition = (editionId) => request(`/api/editions/${editionId}`)

/**
 * POST /api/editions
 * @param {{newspaper_name: string, date: string, edition_label: string, status?: string}} edition
 *   `date` must be an ISO calendar date (YYYY-MM-DD).
 */
export const createEdition = (edition) =>
  request('/api/editions', { method: 'POST', body: { status: 'draft', ...edition } })

/** PATCH /api/editions/{id} — every field is optional. */
export const updateEdition = (editionId, changes) =>
  request(`/api/editions/${editionId}`, { method: 'PATCH', body: changes })

/** DELETE /api/editions/{id} — cascades to the edition's sections. */
export const deleteEdition = (editionId) =>
  request(`/api/editions/${editionId}`, { method: 'DELETE' })

/**
 * GET /api/editions/{id}/validate
 * Returns `{ all_completed, incomplete_sections[] }`. The server also promotes
 * the edition to `ready` (or back to `in_progress`) as a side effect, so call
 * this after saving to keep the dashboard badge honest.
 */
export const validateEdition = (editionId) => request(`/api/editions/${editionId}/validate`)

/* -------------------------------------------------------------- sections */

/** GET /api/editions/{id}/sections — only sections that have been saved exist. */
export const listSections = (editionId) => fetchAllPages(`/api/editions/${editionId}/sections`)

/**
 * PUT /api/editions/{id}/sections/{key} — creates or updates in one call.
 * The server rejects the request unless `section.section_key` matches the path,
 * so the key is taken from the payload rather than passed separately.
 */
export const saveSection = (editionId, section) =>
  request(`/api/editions/${editionId}/sections/${section.section_key}`, {
    method: 'PUT',
    body: section,
  })

/* --------------------------------------------------------------------- ai */

/**
 * POST /api/ai/expand — grows a summary into a column-fitting article.
 * @returns {Promise<{expanded_content: string, generated_title: string}>}
 */
export const expandContent = ({ summary, characterLimit }) =>
  request('/api/ai/expand', {
    method: 'POST',
    body: { summary, character_limit: characterLimit },
  })

/**
 * POST /api/ai/headline — writes a headline for an existing body.
 * @returns {Promise<{headline: string}>}
 */
export const generateHeadline = ({ content }) =>
  request('/api/ai/headline', { method: 'POST', body: { content } })
