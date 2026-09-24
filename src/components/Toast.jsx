import { useEffect } from 'react'
import { AlertTriangleIcon, CheckIcon, InfoIcon, XIcon } from './Icons'

/**
 * Modern floating Toast Notification.
 * Supports 'success', 'error', and 'info' variants with auto-dismiss.
 */
export default function Toast({
  type = 'success',
  message,
  onClose,
  duration = 4000,
  className = '',
}) {
  useEffect(() => {
    if (!duration || !onClose) return undefined
    const timer = setTimeout(() => {
      onClose()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!message) return null

  const isSuccess = type === 'success'
  const isError = type === 'error'

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3.5 rounded-2xl border px-5 py-3.5 shadow-2xl transition-all duration-300 animate-fadeIn max-w-[90vw] sm:max-w-md',
        isSuccess
          ? 'border-emerald-200 bg-white text-emerald-950 shadow-emerald-500/15'
          : isError
            ? 'border-rose-200 bg-white text-rose-950 shadow-rose-500/15'
            : 'border-brand-200 bg-white text-brand-950 shadow-brand-500/15',
        className,
      ].join(' ')}
    >
      <div
        className={[
          'grid size-8 shrink-0 place-items-center rounded-xl',
          isSuccess
            ? 'bg-emerald-100 text-emerald-700'
            : isError
              ? 'bg-rose-100 text-rose-700'
              : 'bg-brand-100 text-brand-700',
        ].join(' ')}
      >
        {isSuccess ? (
          <CheckIcon className="size-4.5" />
        ) : isError ? (
          <AlertTriangleIcon className="size-4.5" />
        ) : (
          <InfoIcon className="size-4.5" />
        )}
      </div>

      <div className="min-w-0 pr-2">
        <p className="text-[14px] font-medium leading-snug">{message}</p>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink active:scale-95"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}
