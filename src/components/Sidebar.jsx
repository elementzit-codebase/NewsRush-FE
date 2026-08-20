import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  ChevronsRightIcon,
  DocIcon,
  FileTextIcon,
  GridIcon,
  HomeIcon,
  LogoutIcon,
  NewspaperMarkIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
} from './Icons'

const NAV = [
  { to: '/', icon: HomeIcon, label: 'Workspace', end: true },
  { to: '/create', icon: PlusIcon, label: 'Create new task' },
  { to: '/drafts', icon: DocIcon, label: 'Drafts' },
  { to: '/templates', icon: GridIcon, label: 'Templates' },
  { to: '/library', icon: FileTextIcon, label: 'Library' },
  { to: '/profile', icon: SettingsIcon, label: 'Your profile' },
  // Only system users can reach GET /api/users, so the link is hidden for
  // everyone else rather than leading to a rejection.
  { to: '/users', icon: UsersIcon, label: 'Users', systemOnly: true },
]

/**
 * Fixed icon rail. `variant="panel"` gives the tinted background used beside
 * the create screen's template list; the default sits on white.
 */
export default function Sidebar({ variant = 'default', onExpand }) {
  const { user, signOut } = useAuth()
  const items = NAV.filter((item) => !item.systemOnly || user?.is_system_user)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    // Guarded because logout revokes the refresh token server-side; a double
    // click would send the second request with a token already spent.
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <nav
      aria-label="Primary"
      className={[
        'flex w-[104px] shrink-0 flex-col items-center border-r border-line py-6',
        variant === 'panel' ? 'bg-white' : 'bg-white',
      ].join(' ')}
    >
      <NavLink
        to="/"
        aria-label="NewsCraft AI home"
        className="grid size-14 place-items-center rounded-2xl bg-navy-900 text-white transition hover:bg-navy-700"
      >
        <NewspaperMarkIcon className="size-7" />
      </NavLink>

      <ul className="mt-10 flex flex-1 flex-col items-center gap-3">
        {items.map(({ to, icon: Icon, label, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                [
                  'grid size-12 place-items-center rounded-2xl transition',
                  isActive
                    ? 'bg-brand-50 text-brand-500'
                    : 'text-muted hover:bg-navy-50 hover:text-ink',
                ].join(' ')
              }
            >
              <Icon className="size-6" />
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Sign out sits with the navigation, so it is reachable from every
          authenticated screen rather than only the workspace header. */}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        aria-label="Sign out"
        title="Sign out"
        className="mb-3 grid size-12 place-items-center rounded-2xl text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <LogoutIcon className="size-6" />
      </button>

      {/* <button
        type="button"
        onClick={onExpand}
        aria-label="Expand sidebar"
        className="grid size-11 place-items-center rounded-full border border-line text-muted transition hover:border-brand-500 hover:text-brand-500"
      >
        <ChevronsRightIcon className="size-5" />
      </button> */}
    </nav>
  )
}
