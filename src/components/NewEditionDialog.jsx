import { useEffect, useState } from 'react'

/** The server stores `date` as a calendar date, so the input value is used raw. */
const today = () => new Date().toISOString().slice(0, 10)

const LABEL_SUGGESTIONS = ['Evening', 'Morning', 'City', 'Weekend', 'Special']

/** Fixed for every edition; not exposed in the form. */
const NEWSPAPER_NAME = 'NewsRush Daily'

/**
 * Collects the fields `POST /api/editions` requires. `newspaper_name` is fixed
 * (see NEWSPAPER_NAME) and not shown; the rest match the request body exactly.
 */
export default function NewEditionDialog({ onCancel, onCreate }) {
  const [date, setDate] = useState(today)
  const [editionLabel, setEditionLabel] = useState('Evening')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onCreate({
        newspaper_name: NEWSPAPER_NAME,
        date,
        edition_label: editionLabel.trim(),
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy-900/40 p-6"
      onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-edition-title"
        className="w-full max-w-[460px] rounded-2xl border border-line bg-white p-7 shadow-xl"
      >
        <h2 id="new-edition-title" className="text-[22px] font-bold text-navy-900">
          New Edition
        </h2>
        <p className="mt-1.5 text-[15px] text-muted">
          Four pages and nineteen sections are created as you fill them in.
        </p>

        <label className="mt-6 block">
          <span className="text-[14px] font-medium text-ink">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            autoFocus
            className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-[15px] outline-none focus:border-brand-500"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-[14px] font-medium text-ink">Edition label</span>
          <input
            value={editionLabel}
            onChange={(e) => setEditionLabel(e.target.value)}
            required
            maxLength={100}
            list="edition-labels"
            className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-[15px] outline-none focus:border-brand-500"
          />
          <datalist id="edition-labels">
            {LABEL_SUGGESTIONS.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </label>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </p>
        )}

        <div className="mt-7 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line px-5 py-3 text-[15px] font-medium text-ink transition hover:bg-navy-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-500 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create edition'}
          </button>
        </div>
      </form>
    </div>
  )
}
