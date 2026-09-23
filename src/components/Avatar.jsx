import { useEffect, useState } from 'react'
import { API_BASE } from '../lib/api'

/**
 * Profile picture with an initials fallback and broken image error handling.
 */
export default function Avatar({ user, className = '' }) {
  const [imgError, setImgError] = useState(false)
  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase()

  let picUrl = null
  if (user?.profile_pic) {
    if (
      user.profile_pic.startsWith('http://') ||
      user.profile_pic.startsWith('https://') ||
      user.profile_pic.startsWith('data:') ||
      user.profile_pic.startsWith('blob:')
    ) {
      picUrl = user.profile_pic
    } else {
      const cleanBase = (API_BASE || '').replace(/\/+$/, '')
      const cleanPath = user.profile_pic.startsWith('/') ? user.profile_pic : `/${user.profile_pic}`
      picUrl = cleanBase ? `${cleanBase}${cleanPath}` : cleanPath
    }
  }

  // Reset image error state whenever the profile picture changes
  useEffect(() => {
    setImgError(false)
  }, [user?.profile_pic])

  if (picUrl && !imgError) {
    return (
      <img
        src={picUrl}
        alt={`${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Avatar'}
        onError={() => setImgError(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-navy-900 font-semibold text-white select-none ${className}`}
    >
      {initials || 'U'}
    </span>
  )
}
