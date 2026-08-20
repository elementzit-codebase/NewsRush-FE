import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import * as api from './api'

const AuthContext = createContext(null)

const USER_KEY = 'newsrush.user'

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  // The cached user paints the shell immediately; the tokens are what actually
  // authorise anything, and they are re-checked against /api/users/me below.
  const [user, setUser] = useState(readStoredUser)
  const [ready, setReady] = useState(false)

  const applyUser = useCallback((next) => {
    setUser(next)
    if (next) localStorage.setItem(USER_KEY, JSON.stringify(next))
    else localStorage.removeItem(USER_KEY)
  }, [])

  // A refresh token that has expired or been revoked can only be discovered by
  // using it, so the api layer reports the failure here.
  useEffect(() => {
    api.setSessionExpiredHandler(() => applyUser(null))
  }, [applyUser])

  // Confirm a stored session is still good before trusting it.
  useEffect(() => {
    if (!api.getAccessToken()) {
      setReady(true)
      return
    }
    let active = true
    api
      .getMe()
      .then((me) => active && applyUser(me))
      .catch(() => active && applyUser(null))
      .finally(() => active && setReady(true))
    return () => {
      active = false
    }
  }, [applyUser])

  const signIn = useCallback(
    async (credentials) => {
      const session = await api.login(credentials)
      applyUser(session.user)
      return session
    },
    [applyUser],
  )

  const signOut = useCallback(async () => {
    await api.logout()
    applyUser(null)
  }, [applyUser])

  const value = useMemo(
    () => ({ user, ready, signIn, signOut, refreshUser: applyUser }),
    [user, ready, signIn, signOut, applyUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}

/**
 * Routes the backend restricts to system users (`require_system_user`).
 * Kept beside the guards so the list cannot drift from what they enforce.
 */
const SYSTEM_ONLY_PATHS = ['/users']

/**
 * Whether a signed-in user may open a path.
 *
 * Used after login to vet the remembered destination: signing out of a
 * system-only page stores it as "where you were headed", and the next person to
 * sign in — possibly a different, non-system user — would otherwise be sent
 * straight to a page they cannot open.
 */
export function canAccessPath(path, user) {
  if (!path) return false
  const systemOnly = SYSTEM_ONLY_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )
  return !systemOnly || Boolean(user?.is_system_user)
}

/** Redirects to the login screen, remembering where the user was headed. */
export function RequireAuth({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  // Waiting for the /me check; rendering the app now would flash the login page.
  if (!ready) return <FullPageMessage>Checking your session…</FullPageMessage>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

/** Guards the routes the backend restricts to system users. */
export function RequireSystemUser({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <FullPageMessage>Checking your session…</FullPageMessage>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!user.is_system_user) {
    return (
      <FullPageMessage>
        This area is limited to system users. Ask a system user for access.
      </FullPageMessage>
    )
  }
  return children
}

function FullPageMessage({ children }) {
  return (
    <div className="grid min-h-screen place-items-center bg-white px-6 text-center text-muted">
      <p>{children}</p>
    </div>
  )
}
