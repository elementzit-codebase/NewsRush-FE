import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  LogoutIcon,
  NewspaperMarkIcon,
  SettingsIcon,
  UsersIcon,
} from './Icons'

const NAV = [
  { to: '/', icon: HomeIcon, label: 'Workspace', end: true },
  { to: '/profile', icon: SettingsIcon, label: 'Profile' },
  { to: '/users', icon: UsersIcon, label: 'Users', systemOnly: true },
]

/**
 * Premium collapsible sidebar with seamless transition between expanded and compact icon rail.
 */
export default function Sidebar({ variant = 'default' }) {
  const { user, signOut } = useAuth()
  const items = NAV.filter((item) => !item.systemOnly || user?.is_system_user)
  const [signingOut, setSigningOut] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('newsrush_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('newsrush_sidebar_collapsed', String(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <aside
      aria-label="Sidebar navigation"
      className={[
        'relative flex shrink-0 flex-col border-r border-line bg-white select-none transition-all duration-300 ease-in-out',
        collapsed ? 'w-[74px]' : 'w-50',
        variant === 'panel' ? 'bg-white' : 'bg-white',
      ].join(' ')}
    >
      {/* Floating edge collapse toggle */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3.5 top-6 z-30 flex size-7 items-center justify-center rounded-full border border-line bg-white text-muted shadow-sm transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        {collapsed ? (
          <ChevronRightIcon className="size-4" />
        ) : (
          <ChevronLeftIcon className="size-4" />
        )}
      </button>

      {/* Brand Header */}
      <div className={`flex h-[76px] items-center ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <Link
          to="/"
          aria-label="NewsRush Home"
          className="group flex items-center gap-3 overflow-hidden rounded-xl transition"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white shadow-sm transition group-hover:bg-navy-800">
            <NewspaperMarkIcon className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0 transition-opacity duration-200">
              <span className="block text-[16px] font-bold tracking-tight text-navy-900">
                NewsRush
              </span>
              <span className="block text-[11px] font-medium text-muted">
                Edition Studio
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav aria-label="Main" className="space-y-1.5">
          {items.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={({ isActive }) =>
                [
                  'group relative flex items-center rounded-xl font-medium transition-all duration-150',
                  collapsed
                    ? 'mx-auto size-11 justify-center'
                    : 'gap-3 px-3.5 py-2.5 text-[14px]',
                  isActive
                    ? 'bg-brand-50 text-brand-600 font-semibold shadow-[inset_0_0_0_1px_rgba(47,107,246,0.12)]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900',
                ].join(' ')
              }
            >
              <Icon className="size-5 shrink-0 transition group-hover:scale-105" />
              {!collapsed && (
                <span className="truncate">{label}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer: Sign Out Button Only */}
      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          title="Sign out"
          aria-label="Sign out"
          className={[
            'flex items-center rounded-xl font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50',
            collapsed
              ? 'mx-auto size-11 justify-center'
              : 'w-full gap-3 px-3.5 py-2.5 text-[14px]',
          ].join(' ')}
        >
          <LogoutIcon className="size-5 shrink-0" />
          {!collapsed && <span className="truncate">{signingOut ? 'Signing out…' : 'Sign out'}</span>}
        </button>
      </div>
    </aside>
  )
}
