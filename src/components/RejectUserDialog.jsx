import { useEffect, useState } from 'react'
import { AlertTriangleIcon, XIcon } from './Icons'

/**
 * Modal confirmation dialog for rejecting a pending user registration.
 * Matches the NewsRush design system and accessibility standards.
 */
export default function RejectUserDialog({ user, onCancel, onConfirm }) {
  const [rejecting, setRejecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !rejecting) {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, rejecting])

  async function handleConfirm() {
    setError('')
    setRejecting(true)
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message || 'Failed to reject registration. Please try again.')
      setRejecting(false)
    }
  }

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'this user'

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy-900/40 backdrop-blur-[2px] p-6 transition-all duration-200"
      onClick={(event) => event.target === event.currentTarget && !rejecting && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reject-user-title"
        aria-describedby="reject-user-desc"
        className="w-full max-w-[460px] rounded-2xl border border-line bg-white p-7 shadow-2xl transition-all"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertTriangleIcon className="size-6" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={rejecting}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-muted transition hover:bg-navy-50 hover:text-ink disabled:opacity-50"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="mt-4">
          <h2 id="reject-user-title" className="text-[20px] font-bold text-navy-900">
            Reject Registration
          </h2>
          <p id="reject-user-desc" className="mt-2 text-[15px] leading-relaxed text-muted">
            Are you sure you want to reject the registration for{' '}
            <strong className="font-semibold text-ink">{fullName}</strong>
            {user?.email ? ` (${user.email})` : ''}?
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-red-100 bg-red-50/60 p-3.5">
          <p className="text-[13px] leading-normal text-red-800">
            This pending account will be removed and the user will not be able to sign in.
          </p>
        </div>

        {error && (
          <div role="alert" className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            <AlertTriangleIcon className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-7 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={rejecting}
            autoFocus
            className="rounded-xl border border-line px-5 py-2.5 text-[15px] font-medium text-ink transition hover:bg-navy-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={rejecting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm shadow-red-200 transition hover:bg-red-700 disabled:opacity-60"
          >
            {rejecting ? 'Rejecting…' : 'Reject Registration'}
          </button>
        </div>
      </div>
    </div>
  )
}
