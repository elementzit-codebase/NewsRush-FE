import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Avatar from './Avatar'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  NewspaperMarkIcon,
  SettingsIcon,
  UsersIcon,
  XIcon,
} from './Icons'

const NAV = [
  { to: '/', icon: HomeIcon, label: 'Workspace', end: true },
  { to: '/profile', icon: SettingsIcon, label: 'Profile' },
  { to: '/users', icon: UsersIcon, label: 'Users', systemOnly: true },
]

/**
 * Premium responsive sidebar that serves as:
 * - A sleek, sticky top navbar with a slide-over drawer on mobile (< md)
 * - A collapsible left icon/label rail on desktop (>= md)
 */
export default function Sidebar({
  variant = 'default',
  mobileRightAction = null,
  mobileSubtitle = null,
  mobileBadge = null,
}) {
  const { user, signOut } = useAuth()
  const items = NAV.filter((item) => !item.systemOnly || user?.is_system_user)
  const [signingOut, setSigningOut] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('newsrush_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  // Prevent background scrolling and handle Escape key when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setMobileOpen(false)
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        document.body.style.overflow = ''
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [mobileOpen])

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
    <>
      {/* ----------------- MOBILE TOP NAVBAR (Visible on < md) ----------------- */}
      <header className="sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-slate-50/70 text-slate-700 transition hover:bg-slate-100 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/20 active:scale-95"
          >
            <MenuIcon className="size-5" />
          </button>

          <Link
            to="/"
            aria-label="NewsRush Home"
            className="flex items-center gap-2.5 overflow-hidden rounded-xl transition min-w-0"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white shadow-xs">
              <NewspaperMarkIcon className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="block text-[15px] font-bold tracking-tight text-navy-900 leading-tight">
                  NewsRush
                </span>
                {mobileBadge && (
                  <span className="inline-flex items-center rounded bg-brand-50 px-1.5 py-0.2 text-[10px] font-bold text-brand-600 uppercase border border-brand-200/60">
                    {mobileBadge}
                  </span>
                )}
              </div>
              <span className="block truncate text-[10px] font-medium text-muted leading-tight">
                {mobileSubtitle || 'Edition Studio'}
              </span>
            </div>
          </Link>
        </div>

        {/* Right side custom action or user profile avatar link */}
        <div className="flex items-center gap-2 shrink-0">
          {mobileRightAction || (
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-slate-50"
              title="Your profile"
            >
              <Avatar user={user} className="size-8 text-[12px]" />
            </Link>
          )}
        </div>
      </header>

      {/* ----------------- MOBILE DRAWER / OVERLAY ----------------- */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-navy-950/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative flex h-full w-[290px] max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out animate-in slide-in-from-left">
            {/* Drawer Header */}
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white shadow-xs">
                  <NewspaperMarkIcon className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[15px] font-bold tracking-tight text-navy-900 leading-tight">
                    NewsRush
                  </span>
                  <span className="block text-[10px] font-medium text-muted leading-tight">
                    Edition Studio
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="flex size-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            {/* User Profile Card inside Drawer */}
            <div className="border-b border-line p-4 bg-slate-50/60">
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl transition hover:opacity-80"
              >
                <Avatar user={user} className="size-10 text-[14px]" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-navy-900 truncate">
                    {user?.first_name} {user?.last_name}
                  </span>
                  <span className="block text-[11px] font-medium text-muted truncate">
                    {user?.email}
                  </span>
                  <span className="mt-1 inline-flex items-center rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 border border-brand-100">
                    {user?.is_system_user ? 'System user' : 'Editor'}
                  </span>
                </div>
              </Link>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <nav aria-label="Mobile Navigation" className="space-y-1.5">
                {items.map(({ to, icon: Icon, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-medium transition',
                        isActive
                          ? 'bg-brand-50 text-brand-600 font-semibold shadow-[inset_0_0_0_1px_rgba(47,107,246,0.12)]'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900',
                      ].join(' ')
                    }
                  >
                    <Icon className="size-5 shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Drawer Footer: Sign out button */}
            <div className="border-t border-line p-3">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  handleSignOut()
                }}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <LogoutIcon className="size-5 shrink-0" />
                <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- DESKTOP SIDEBAR (Visible on >= md) ----------------- */}
      <aside
        aria-label="Sidebar navigation"
        className={[
          'sticky top-0 h-screen max-h-screen z-40 hidden md:flex shrink-0 flex-col border-r border-line bg-white select-none transition-all duration-300 ease-in-out',
          collapsed ? 'w-[76px]' : 'w-47',
          variant === 'panel' ? 'bg-white' : 'bg-white',
        ].join(' ')}
      >
        {/* Floating edge collapse toggle */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-[22px] z-30 flex size-6.5 items-center justify-center rounded-full border border-line bg-white text-muted shadow-sm transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          {collapsed ? (
            <ChevronRightIcon className="size-3.5" />
          ) : (
            <ChevronLeftIcon className="size-3.5" />
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
    </>
  )
}
