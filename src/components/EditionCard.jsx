import { Link } from 'react-router-dom'
import { ArrowRightIcon, CalendarIcon, PrinterIcon, TrashIcon } from './Icons'
import NewspaperThumb from './NewspaperThumb'
import StatusBadge from './StatusBadge'
import { artFor } from '../data/editions'
import { TOTAL_SECTIONS } from '../data/sections'

// The backend sends a plain calendar date; anchoring to midnight keeps it from
// slipping a day when the browser is behind UTC.
const formatDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

/**
 * One edition in the workspace. `layout="list"` lays the same content out in a
 * single row for the list-view toggle.
 */
export default function EditionCard({ edition, completed = 0, layout = 'grid', onOpen, onDelete }) {
  const isList = layout === 'list'
  const percent = Math.round((completed / TOTAL_SECTIONS) * 100)

  return (
    <article
      className={[
        'group rounded-2xl border border-line bg-white p-5 transition hover:border-brand-100 hover:shadow-[0_8px_28px_-18px_rgba(15,32,68,0.35)]',
        isList ? 'flex items-center gap-6' : 'flex flex-col',
      ].join(' ')}
    >
      <div className={isList ? 'flex flex-1 items-start gap-5' : 'flex items-start gap-5'}>
        <NewspaperThumb
          masthead={edition.newspaper_name}
          art={artFor(edition.id)}
          className={isList ? 'h-24 w-[68px] shrink-0' : 'h-[132px] w-[100px] shrink-0'}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm font-medium text-brand-500">{edition.edition_label}</span>
            <button
              type="button"
              onClick={() => onDelete?.(edition)}
              aria-label={`Delete ${edition.newspaper_name}`}
              title="Delete edition"
              className="-mr-1 -mt-1 rounded-lg p-1 text-muted transition hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon className="size-5" />
            </button>
          </div>

          <h3 className="mt-2 text-[19px] leading-snug font-bold text-ink">
            <button type="button" onClick={() => onOpen?.(edition)} className="text-left hover:text-brand-600">
              {edition.newspaper_name}
            </button>
          </h3>

          <p className="mt-2 inline-flex items-center gap-2 text-[15px] text-muted">
            <CalendarIcon className="size-4" />
            {formatDate(edition.date)}
          </p>

          {/* Progress toward the 19 sections /validate requires before print. */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[13px] text-muted">
              <span>
                {completed} of {TOTAL_SECTIONS} sections
              </span>
              <span className="tabular-nums">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={completed}
              aria-valuemin={0}
              aria-valuemax={TOTAL_SECTIONS}
              aria-label="Sections completed"
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy-50"
            >
              <div
                className={`h-full rounded-full ${percent === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className={[
          'flex items-center justify-between gap-4',
          isList ? 'w-[280px] shrink-0' : 'mt-5 border-t border-line pt-4',
        ].join(' ')}
      >
        <StatusBadge status={edition.status} />
        <div className="flex items-center gap-4">
          {/* Offered once every section is done, so a finished edition can go
              straight to print without reopening the editor. */}
          {completed === TOTAL_SECTIONS && (
            <Link
              to={`/print?edition=${edition.id}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-600"
            >
              <PrinterIcon className="size-4" />
              Print
            </Link>
          )}
          <button
            type="button"
            onClick={() => onOpen?.(edition)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 transition hover:text-brand-500"
          >
            Open editor
            <ArrowRightIcon className="size-4" />
          </button>
        </div>
      </div>
    </article>
  )
}
