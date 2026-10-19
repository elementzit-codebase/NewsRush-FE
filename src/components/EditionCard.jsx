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
        'group rounded-2xl border border-line bg-white p-4 sm:p-4.5 transition hover:border-brand-200 hover:shadow-[0_8px_28px_-18px_rgba(15,32,68,0.25)]',
        isList ? 'flex items-center gap-6' : 'flex flex-col justify-between',
      ].join(' ')}
    >
      <div className={isList ? 'flex flex-1 items-start gap-4 sm:gap-5' : 'flex items-start gap-3.5 sm:gap-4'}>
        <NewspaperThumb
          masthead={edition.newspaper_name}
          art={artFor(edition.id)}
          className={isList ? 'h-24 w-[68px] shrink-0' : 'h-[120px] w-[90px] shrink-0'}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] font-semibold text-brand-600 truncate">{edition.edition_label}</span>
              {edition.language && (
                <span className="shrink-0 rounded-md bg-canvas px-1.5 py-0.5 text-[10px] font-semibold capitalize text-muted border border-line">
                  {edition.language}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDelete?.(edition)}
              aria-label={`Delete ${edition.newspaper_name}`}
              title="Delete edition"
              className="-mr-1 -mt-1 rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon className="size-4" />
            </button>
          </div>

          <h3 className="mt-1 text-[17px] leading-snug font-bold text-ink">
            <button
              type="button"
              onClick={() => onOpen?.(edition)}
              className="text-left line-clamp-1 transition hover:text-brand-600"
              title={edition.newspaper_name}
            >
              {edition.newspaper_name}
            </button>
          </h3>

          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] text-muted">
            <CalendarIcon className="size-3.5 shrink-0" />
            <span className="whitespace-nowrap">{formatDate(edition.date)}</span>
          </p>

          {/* Progress toward the 19 sections /validate requires before print. */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[12px] text-muted">
              <span className="whitespace-nowrap">
                {completed} of {TOTAL_SECTIONS} sections
              </span>
              <span className="font-semibold tabular-nums text-slate-700">{percent}%</span>
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
                className={`h-full rounded-full transition-all duration-300 ${percent === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className={[
          'flex items-center justify-between gap-2',
          isList ? 'w-[280px] shrink-0' : 'mt-4 border-t border-line pt-3.5',
        ].join(' ')}
      >
        <StatusBadge status={edition.status} />
        <div className="flex items-center gap-3 shrink-0">
          {/* Offered once every section is done, so a finished edition can go
              straight to print without reopening the editor. */}
          {completed === TOTAL_SECTIONS && (
            <Link
              to={`/print?edition=${edition.id}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 transition hover:text-emerald-800 whitespace-nowrap"
            >
              <PrinterIcon className="size-3.5 shrink-0" />
              <span>Print</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => onOpen?.(edition)}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 transition hover:text-brand-700 whitespace-nowrap"
          >
            <span>Open editor</span>
            <ArrowRightIcon className="size-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </article>
  )
}
