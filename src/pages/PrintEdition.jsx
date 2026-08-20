import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRightIcon, CheckIcon } from '../components/Icons'
import { PAGES, TOTAL_SECTIONS } from '../data/sections'
import { COLUMNS, GRID_GAP, SHEET, SHEET_PADDING } from '../data/printGeometry'
import { printCapacityFor } from '../lib/capacity'
import * as api from '../lib/api'

/**
 * Print-ready view of a finished edition.
 *
 * The four sheets are laid out at tabloid size (289mm x 380mm) and handed to
 * the browser's own print pipeline, so "Save as PDF" produces selectable vector
 * text with no PDF library involved. On screen the same sheets render scaled
 * down as a preview; @page and the print rules in index.css take over when
 * printing.
 */

const formatLongDate = (iso) => {
  const date = iso ? new Date(`${iso}T00:00:00`) : new Date()
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function PrintEdition() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editionId = searchParams.get('edition')

  const [edition, setEdition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [completing, setCompleting] = useState(false)
  // Kept apart from `error`, which replaces the whole page: a failed status
  // update should not throw away the sheets the user is about to print.
  const [completeError, setCompleteError] = useState('')

  async function markCompleted() {
    setCompleting(true)
    setCompleteError('')
    try {
      const updated = await api.updateEdition(editionId, { status: 'completed' })
      // The PATCH response omits sections, so only the status is merged in.
      setEdition((current) => ({ ...current, status: updated.status }))
    } catch (err) {
      setCompleteError(err.message)
    } finally {
      setCompleting(false)
    }
  }

  useEffect(() => {
    if (!editionId) {
      navigate('/', { replace: true })
      return undefined
    }
    let active = true
    api
      .getEdition(editionId)
      .then((detail) => active && setEdition(detail))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [editionId, navigate])

  const sections = useMemo(() => {
    const map = {}
    for (const section of edition?.sections ?? []) {
      map[section.section_key] = section
    }
    return map
  }, [edition])

  // The same rule the server's /validate applies, checked here so the page can
  // explain exactly what is missing instead of printing a half-empty paper.
  const missing = useMemo(
    () =>
      PAGES.flatMap((page) => page.blocks).filter((block) => {
        const section = sections[block.section_key]
        return !(section?.title && section?.content && section.status === 'completed')
      }),
    [sections],
  )

  // Sections well short of their box print with visible white space beneath
  // them. Not a blocker — a writer may want a short piece — but worth saying
  // before the paper is committed to print.
  const thin = useMemo(
    () =>
      PAGES.flatMap((page) => page.blocks)
        .map((block) => {
          const section = sections[block.section_key]
          const capacity = printCapacityFor(block.section_key) ?? block.charLimit
          const length = section?.content?.length ?? 0
          return { block, capacity, length, fill: length / capacity }
        })
        .filter((entry) => entry.length > 0 && entry.fill < 0.6),
    [sections],
  )

  if (loading) {
    return <Centered>Loading edition…</Centered>
  }

  if (error) {
    return (
      <Centered>
        <p role="alert" className="font-semibold text-red-700">
          {error}
        </p>
        <Link to="/" className="mt-4 inline-block text-brand-600 hover:text-brand-500">
          Back to workspace
        </Link>
      </Centered>
    )
  }

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      {/* Toolbar. `no-print` keeps it out of the printed sheets. */}
      <header className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-8 py-5">
        <div>
          <nav aria-label="Breadcrumb" className="text-[14px] text-muted">
            <Link to="/" className="hover:text-ink">
              Workspace
            </Link>
            <span className="px-2 text-slate-300">/</span>
            <Link to={`/create?edition=${editionId}`} className="hover:text-ink">
              {edition?.newspaper_name}
            </Link>
            <span className="px-2 text-slate-300">/</span>
            <span className="text-ink">Print</span>
          </nav>
          <p className="mt-1 text-[15px] text-muted">
            Tabloid, 289 × 380 mm · 4 pages · choose “Save as PDF” in the print dialog.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/create?edition=${editionId}`}
            className="rounded-xl border border-line px-5 py-3 text-[15px] font-medium text-ink transition hover:bg-navy-50"
          >
            Back to editor
          </Link>
          {/* Nothing server-side ever sets `completed` — validate only promotes
              an edition to `ready` — so archiving it is a client action. */}
          {edition?.status === 'completed' ? (
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-[15px] font-semibold text-emerald-700">
              <CheckIcon className="size-5" />
              Completed
            </span>
          ) : (
            <button
              type="button"
              onClick={markCompleted}
              disabled={missing.length > 0 || completing}
              title="Archive this edition as completed"
              className="rounded-xl border border-line px-5 py-3 text-[15px] font-medium text-ink transition hover:bg-navy-50 disabled:opacity-50"
            >
              {completing ? 'Marking…' : 'Mark completed'}
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            disabled={missing.length > 0}
            className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            <CheckIcon className="size-5" />
            Print / Save as PDF
          </button>
        </div>
      </header>

      {completeError && (
        <p
          role="alert"
          className="no-print mx-auto mt-6 max-w-[900px] rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[15px] text-red-700"
        >
          {completeError}
        </p>
      )}

      {missing.length > 0 && (
        <div className="no-print mx-auto mt-6 max-w-[900px] rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[15px] text-amber-900">
          <p className="font-semibold">
            {missing.length} of {TOTAL_SECTIONS} sections are not complete yet, so printing is
            disabled.
          </p>
          <p className="mt-1">
            {missing.map((block) => `p${block.page_number} ${block.section_name}`).join(', ')}
          </p>
          <Link
            to={`/create?edition=${editionId}`}
            className="mt-3 inline-flex items-center gap-2 font-medium text-brand-600 hover:text-brand-500"
          >
            Finish them in the editor
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      )}

      {missing.length === 0 && thin.length > 0 && (
        <div className="no-print mx-auto mt-6 max-w-[900px] rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[15px] text-amber-900">
          <p className="font-semibold">
            {thin.length} section{thin.length === 1 ? '' : 's'} will leave white space — the text
            fills less than 60% of the box.
          </p>
          <p className="mt-1">
            {thin
              .map(
                ({ block, length, capacity }) =>
                  `${block.section_name} (${Math.round((length / capacity) * 100)}%)`,
              )
              .join(', ')}
          </p>
          <Link
            to={`/create?edition=${editionId}`}
            className="mt-3 inline-flex items-center gap-2 font-medium text-brand-600 hover:text-brand-500"
          >
            Use “Fill thin sections” in the editor
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      )}

      <div className="flex flex-col items-center gap-8 px-6 py-8 print:gap-0 print:p-0">
        {PAGES.map((page) => (
          <Sheet key={page.page_number} page={page} edition={edition} sections={sections} />
        ))}
      </div>
    </div>
  )
}

function Sheet({ page, edition, sections }) {
  const isFront = page.page_number === 1

  return (
    <article
      className="print-sheet bg-white text-black shadow-[0_10px_40px_-24px_rgba(15,32,68,0.5)] print:shadow-none"
      style={{
        width: SHEET.width + 'mm',
        height: SHEET.height + 'mm',
        padding: SHEET_PADDING + 'mm',
      }}
    >
      <header className={isFront ? 'border-b-[3px] border-black pb-2' : 'border-b border-black pb-1.5'}>
        {isFront ? (
          <>
            <div className="flex items-end justify-between border-b border-black pb-1 text-[9pt]">
              <span>{formatLongDate(edition?.date)}</span>
              <span className="uppercase">{edition?.edition_label} Edition</span>
            </div>
            <h1 className="mt-2 text-center font-serif text-[42pt] leading-none tracking-tight">
              {edition?.newspaper_name}
            </h1>
            <p className="mt-1.5 text-center text-[8pt] tracking-[0.3em] uppercase">
              Your trusted source for breaking news
            </p>
          </>
        ) : (
          <div className="flex items-end justify-between text-[9pt]">
            <span className="font-serif text-[14pt] leading-none">{edition?.newspaper_name}</span>
            <span className="uppercase">
              {page.name} · Page {page.page_number}
            </span>
          </div>
        )}
      </header>

      {/* Rows take a fixed share of the sheet, mirroring the editor's canvas. */}
      <div
        className="print-grid"
        style={{
          gap: GRID_GAP + 'mm',
          gridTemplateRows: page.rows.map((row) => `${row.weight}fr`).join(' '),
        }}
      >
        {page.rows.flatMap((row) =>
          row.blocks.map((block) => {
            const section = sections[block.section_key]
            return (
              <section
                key={block.section_key}
                className="min-h-0 overflow-hidden border-t border-black/30 pt-1.5"
                style={{ gridColumn: `span ${block.span} / span ${block.span}` }}
              >
                <p className="text-[7.5pt] font-bold tracking-[0.12em] uppercase">
                  {block.section_name}
                </p>
                <h2
                  className={`mt-1 font-serif leading-[1.1] ${
                    block.span === 3 ? 'text-[22pt]' : block.span === 2 ? 'text-[16pt]' : 'text-[13pt]'
                  }`}
                >
                  {section?.title}
                </h2>
                <div
                  className="mt-1.5 text-justify text-[8.5pt] leading-[1.35] hyphens-auto"
                  style={{ columnCount: COLUMNS[block.span], columnGap: GRID_GAP + 'mm', columnRule: '0.4pt solid rgba(0,0,0,0.25)' }}
                >
                  {section?.content}
                </div>
              </section>
            )
          }),
        )}
      </div>

      <footer className="mt-auto border-t border-black pt-1 text-[7.5pt]">
        <div className="flex justify-between">
          <span>
            {edition?.newspaper_name} · {formatLongDate(edition?.date)}
          </span>
          <span>Page {page.page_number} of {PAGES.length}</span>
        </div>
      </footer>
    </article>
  )
}

function Centered({ children }) {
  return <div className="grid min-h-screen place-items-center bg-white px-6 text-center text-muted">{children}</div>
}
