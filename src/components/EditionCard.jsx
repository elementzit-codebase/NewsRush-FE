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

  if (isList) {
    return (
      <article className="group flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-5 lg:gap-6 rounded-2xl border border-line bg-white p-3.5 sm:px-5 sm:py-3.5 transition hover:border-brand-200 hover:shadow-[0_4px_20px_-10px_rgba(15,32,68,0.15)]">
        {/* Column 1: Thumbnail & Edition Info (Flexible width) */}
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
          <NewspaperThumb
            masthead={edition.newspaper_name}
            art={artFor(edition.id)}
            className="h-14 w-11 sm:h-16 sm:w-12 shrink-0 rounded-md shadow-2xs"
          />

          <div className="min-w-0 flex-1">
            {/* Label + Language Tag + Date */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] font-semibold text-brand-600 truncate">
                {edition.edition_label}
              </span>
              {edition.language && (
                <span className="shrink-0 rounded-md bg-canvas px-1.5 py-0.5 text-[10px] font-semibold capitalize text-muted border border-line">
                  {edition.language}
                </span>
              )}
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-[12px] text-muted whitespace-nowrap">
                <CalendarIcon className="size-3 shrink-0" />
                <span>{formatDate(edition.date)}</span>
              </span>
            </div>

            {/* Newspaper Name */}
            <h3 className="text-[15px] sm:text-[16px] font-bold text-ink leading-tight mt-0.5">
              <button
                type="button"
                onClick={() => onOpen?.(edition)}
                className="text-left line-clamp-1 transition hover:text-brand-600"
                title={edition.newspaper_name}
              >
                {edition.newspaper_name}
              </button>
            </h3>
          </div>
        </div>

        {/* Column 2: Progress Column (Desktop / Tablet) */}
        <div className="hidden md:flex flex-col gap-1 w-40 lg:w-48 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span className="whitespace-nowrap font-medium">
              {completed}/{TOTAL_SECTIONS} sections
            </span>
            <span className="font-semibold tabular-nums text-slate-700">{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={TOTAL_SECTIONS}
            aria-label="Sections completed"
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${percent === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Mobile-only progress bar */}
        <div className="flex md:hidden flex-col gap-1 w-full">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>{completed}/{TOTAL_SECTIONS} sections</span>
            <span className="font-semibold text-slate-700">{percent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${percent === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Column 3: Status Badge (Fixed width to prevent shifting across rows) */}
        <div className="hidden md:flex items-center justify-start w-28 shrink-0">
          <StatusBadge status={edition.status} />
        </div>

        {/* Column 4: Actions (Fixed slot widths so buttons never jump around!) */}
        <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-[220px] shrink-0 border-t md:border-t-0 border-line/60 pt-2.5 md:pt-0">
          {/* Mobile status badge */}
          <div className="md:hidden">
            <StatusBadge status={edition.status} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Print Button Slot: fixed width w-[68px] so absence doesn't shift Open Editor! */}
            <div className={completed === TOTAL_SECTIONS ? 'w-[68px] flex items-center justify-end shrink-0' : 'hidden md:flex w-[68px] shrink-0'} aria-hidden={completed !== TOTAL_SECTIONS}>
              {completed === TOTAL_SECTIONS && (
                <Link
                  to={`/print?edition=${edition.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-50 transition whitespace-nowrap"
                >
                  <PrinterIcon className="size-3.5 shrink-0" />
                  <span>Print</span>
                </Link>
              )}
            </div>

            {/* Open Editor Button */}
            <button
              type="button"
              onClick={() => onOpen?.(edition)}
              className="inline-flex items-center gap-1 rounded-xl bg-navy-50 hover:bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-600 transition hover:text-brand-700 whitespace-nowrap active:scale-95"
            >
              <span>Open editor</span>
              <ArrowRightIcon className="size-3.5 shrink-0" />
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => onDelete?.(edition)}
              aria-label={`Delete ${edition.newspaper_name}`}
              title="Delete edition"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-95"
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      className="group flex flex-col justify-between rounded-2xl border border-line bg-white p-4 sm:p-4.5 transition hover:border-brand-200 hover:shadow-[0_8px_28px_-18px_rgba(15,32,68,0.25)]"
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        <NewspaperThumb
          masthead={edition.newspaper_name}
          art={artFor(edition.id)}
          className="h-[120px] w-[90px] shrink-0"
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

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3.5">
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
