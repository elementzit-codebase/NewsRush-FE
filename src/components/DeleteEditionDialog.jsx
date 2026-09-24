import { useEffect, useState } from 'react'
import { AlertTriangleIcon, TrashIcon, XIcon } from './Icons'

/**
 * Modal confirmation dialog for deleting an edition.
 * Matches the NewsRush design system and accessibility standards.
 */
export default function DeleteEditionDialog({ edition, onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !deleting) {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, deleting])

  async function handleConfirm() {
    setError('')
    setDeleting(true)
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message || 'Failed to delete edition. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy-900/40 backdrop-blur-[2px] p-6 transition-all duration-200"
      onClick={(event) => event.target === event.currentTarget && !deleting && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-edition-title"
        aria-describedby="delete-edition-desc"
        className="w-full max-w-[480px] rounded-2xl border border-line bg-white p-7 shadow-2xl transition-all"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertTriangleIcon className="size-6" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-muted transition hover:bg-navy-50 hover:text-ink disabled:opacity-50"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="mt-4">
          <h2 id="delete-edition-title" className="text-[20px] font-bold text-navy-900">
            Delete Edition
          </h2>
          <p id="delete-edition-desc" className="mt-2 text-[15px] leading-relaxed text-muted">
            Are you sure you want to delete{' '}
            {edition?.newspaper_name ? (
              <strong className="font-semibold text-ink">“{edition.newspaper_name}”</strong>
            ) : (
              'this edition'
            )}
            {edition?.edition_label ? ` (${edition.edition_label})` : ''}? This will permanently delete all pages and sections associated with it.
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
            disabled={deleting}
            autoFocus
            className="rounded-xl border border-line px-5 py-2.5 text-[15px] font-medium text-ink transition hover:bg-navy-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm shadow-red-200 transition hover:bg-red-700 disabled:opacity-60"
          >
            <TrashIcon className="size-4" />
            {deleting ? 'Deleting…' : 'Delete Edition'}
          </button>
        </div>
      </div>
    </div>
  )
}
