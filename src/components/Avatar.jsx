import { API_BASE } from '../lib/api'

/**
 * Profile picture with an initials fallback. `profile_pic` comes back as a
 * server-relative path (`/uploads/profile-pics/…`), which resolves through the
 * dev proxy in development and against `API_BASE` when one is configured.
 */
export default function Avatar({ user, className = '' }) {
  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase()

  if (user?.profile_pic) {
    return (
      <img
        src={`${API_BASE}${user.profile_pic}`}
        alt=""
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-navy-900 font-semibold text-white ${className}`}
    >
      {initials || 'U'}
    </span>
  )
}
