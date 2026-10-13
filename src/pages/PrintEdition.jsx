import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRightIcon, CheckIcon } from '../components/Icons'
import { TOTAL_SECTIONS } from '../data/sections'
import { COLUMNS, GRID_GAP, SHEET, SHEET_PADDING } from '../data/printGeometry'
import { printCapacityFor } from '../lib/capacity'
import { buildPages } from '../data/templates'
import { readTemplates } from '../lib/templateStore'
import { formatMalayalamNewspaperText, isMalayalamEdition } from '../lib/malayalamTypography'
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

// Copyfitting bounds, in points. BASE is the size the capacity maths assumes;
// the fitter grows towards MAX when there is room, and falls back towards FLOOR
// when a section has more copy than its box holds — clipping a sentence is
// worse than setting it slightly small.
const BODY_PT_BASE = 8.5
const BODY_PT_MAX = 11
const BODY_PT_FLOOR = 7
const BODY_PT_STEP = 0.25

// Malayalam characters and ligatures occupy slightly more visual width, so a slightly
// larger base point and tighter leading prevents awkward word justification gaps.
const MALAYALAM_BODY_PT_BASE = 8.8
const MALAYALAM_BODY_PT_MAX = 9.8
const MALAYALAM_BODY_PT_FLOOR = 7.8

// Leading is opened per section to close the gap the shared size cannot, since
// it cannot rise past the fullest section. The base matches the capacity maths;
// the ceiling keeps a sparse column from reading as airy.
const BODY_LEADING_BASE = 1.35
const BODY_LEADING_MAX = 1.9
const BODY_LEADING_STEP = 0.05

const MALAYALAM_LEADING_BASE = 1.40
const MALAYALAM_LEADING_MAX = 1.50

const formatLongDate = (iso) => {
  const date = iso ? new Date(`${iso}T00:00:00`) : new Date()
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Filename the "Save as PDF" dialog pre-fills. Browsers seed it from
 * `document.title`, so PrintEdition swaps the title to this for the duration of
 * the print call. Characters illegal in filenames are stripped.
 */
const pdfFileName = (edition) =>
  [
    edition?.newspaper_name,
    edition?.edition_label && `${edition.edition_label} Edition`,
    edition?.date,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/[\\/:*?"<>|]+/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'edition'

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

  // The layout the editor was using, so the printed sheet matches the preview.
  const pages = useMemo(() => buildPages(readTemplates(editionId)), [editionId])

  // Holds the fitted body size for every sheet at once.
  const sheetsRef = useRef(null)

  // The browser's "Save as PDF" dialog seeds its filename from document.title.
  // Setting it for the whole time this page is mounted means both the Print
  // button and a plain Ctrl/Cmd+P get the "<name> - <label> - <date>" filename,
  // with no timing race against the print dialog.
  useEffect(() => {
    if (!edition) return undefined
    const previousTitle = document.title
    document.title = pdfFileName(edition)
    return () => {
      document.title = previousTitle
    }
  }, [edition])

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
      pages.flatMap((page) => page.blocks).filter((block) => {
        const section = sections[block.section_key]
        return !(section?.title && section?.content && section.status === 'completed')
      }),
    [pages, sections],
  )

  // Sections well short of their box print with visible white space beneath
  // them. Not a blocker — a writer may want a short piece — but worth saying
  // before the paper is committed to print.
  const thin = useMemo(
    () =>
      pages.flatMap((page) => page.blocks)
        .map((block) => {
          const section = sections[block.section_key]
          const capacity = printCapacityFor(block.section_key, pages) ?? block.charLimit
          const length = section?.content?.length ?? 0
          return { block, capacity, length, fill: length / capacity }
        })
        .filter((entry) => entry.length > 0 && entry.fill < 0.6),
    [pages, sections],
  )

  // Refits whenever the edition's copy changes.
  useCopyfit(sheetsRef, edition)

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

      {/* The fitted body size lands on this element as --body-pt, so every
          sheet below inherits exactly the same size. */}
      <div
        ref={sheetsRef}
        style={{ '--body-pt': `${BODY_PT_BASE}pt` }}
        className="flex flex-col items-center gap-8 px-6 py-8 print:gap-0 print:p-0"
      >
        {pages.map((page) => (
          <Sheet
            key={page.page_number}
            page={page}
            totalPages={pages.length}
            edition={edition}
            sections={sections}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * The letter cut by thin vertical white gaps so it reads as sliced type. The
 * gaps are white bars laid over the glyph; the masthead sits on white, so only
 * the part crossing the letter shows.
 */
function SlicedLetter({ char }) {
  const cuts = ['30%', '54%', '78%']
  return (
    <span className="relative inline-block not-italic">
      {char}
      {/* The cuts live in their own clipped overlay so they stay within this
          letter's box — the glyph itself above is untouched and keeps its
          full height. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {cuts.map((left, i) => (
          <span
            key={i}
            className="absolute -inset-y-[0.6em] w-[0.05em] bg-white"
            style={{ left, transform: 'rotate(45deg)' }}
          />
        ))}
      </span>
    </span>
  )
}

/**
 * The mid-word "R" in "NewsRush" is rendered as sliced type — a small logo
 * accent. Only an interior "R" is treated; every other letter is left alone.
 */
function LogoWord({ word }) {
  return [...word].map((char, i) =>
    i > 0 && char === 'R' ? <SlicedLetter key={i} char={char} /> : char,
  )
}

/**
 * Renders the paper's name with its last word set smaller and italic — the
 * house style for the "… Daily" suffix — and any mid-word capital rendered as a
 * logo mark. Sizes are relative (em), so this works at both the front-page
 * masthead and the running-head sizes. A single-word name keeps the logo mark
 * but no italic suffix.
 */
function Masthead({ name }) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const last = words.length - 1
  return words.map((word, i) => (
    <Fragment key={i}>
      {i > 0 && ' '}
      <span className={words.length > 1 && i === last ? 'text-[0.7em] italic' : undefined}>
        <LogoWord word={word} />
      </span>
    </Fragment>
  ))
}

function Sheet({ page, totalPages, edition, sections }) {
  const isFront = page.page_number === 1
  const isMalayalam = isMalayalamEdition(edition)

  return (
    <article
      className={`print-sheet bg-white text-black shadow-[0_10px_40px_-24px_rgba(15,32,68,0.5)] print:shadow-none ${
        isMalayalam ? 'edition-malayalam' : ''
      }`}
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
              <Masthead name={edition?.newspaper_name} />
            </h1>
            <p className="mt-1.5 text-center text-[8pt] tracking-[0.3em] uppercase">
              Your trusted source for breaking news
            </p>
          </>
        ) : (
          <div className="flex items-end justify-between text-[9pt]">
            <span className="font-serif text-[14pt] leading-none">
              <Masthead name={edition?.newspaper_name} />
            </span>
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
                className="flex min-h-0 flex-col overflow-hidden border-t border-black/30 pt-1.5"
                style={{ gridColumn: `span ${block.span} / span ${block.span}` }}
              >
                <p className="text-[7.5pt] font-bold tracking-[0.12em] uppercase">
                  {section?.section_name?.trim() || block.section_name}
                </p>
                <h2 className="mt-1 font-serif text-[20pt] leading-[1.1]">
                  {isMalayalam ? formatMalayalamNewspaperText(section?.title) : section?.title}
                </h2>
                <BodyColumns
                  columns={COLUMNS[block.span]}
                  text={section?.content ?? ''}
                  isMalayalam={isMalayalam}
                />
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
          <span>Page {page.page_number} of {totalPages}</span>
        </div>
      </footer>
    </article>
  )
}

/**
 * Fits one body size for the whole edition.
 *
 * Body text is one size throughout, as in any newspaper — sizing each block
 * independently left the paper set in a jumble of point sizes.
 *
 * The subtlety is over-long sections. A section carrying slightly more copy
 * than its box holds (crime_civic ran to 103% of capacity) cannot fit at any
 * shared size, and letting it drive the shared decision dragged the entire
 * edition down to the minimum and left every other page half empty. So a
 * section that overflows even at the base size is set aside: the shared size is
 * fitted to the rest, and the overflowing one is shrunk on its own until its
 * copy fits. One block in slightly smaller type is a far smaller price than a
 * whole paper of undersized text.
 */
function useCopyfit(containerRef, edition) {
  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    const isMalayalam = isMalayalamEdition(edition)
    const ptBase = isMalayalam ? MALAYALAM_BODY_PT_BASE : BODY_PT_BASE
    const ptMax = isMalayalam ? MALAYALAM_BODY_PT_MAX : BODY_PT_MAX
    const ptFloor = isMalayalam ? MALAYALAM_BODY_PT_FLOOR : BODY_PT_FLOOR
    const leadingBase = isMalayalam ? MALAYALAM_LEADING_BASE : BODY_LEADING_BASE
    const leadingMax = isMalayalam ? MALAYALAM_LEADING_MAX : BODY_LEADING_MAX

    const bodies = () => Array.from(root.querySelectorAll('[data-copyfit]'))

    /**
     * A fixed-height multi-column box does not overflow downwards — the browser
     * lays surplus text into further columns to the *right*, past the edge. So
     * overflow is `scrollWidth`, not `scrollHeight`; testing the height
     * silently reported "it fits" and let text spill into clipped columns.
     */
    const overflowing = (el) => el.scrollWidth > el.clientWidth + 1

    const apply = (pt) => root.style.setProperty('--body-pt', `${pt}pt`)

    const fit = () => {
      const all = bodies()
      if (!all.length) return

      // Drop any per-section font size overrides so EVERY section strictly shares the same font size
      all.forEach((el) => {
        el.style.fontSize = ''
      })

      // Strictly uniform font size across all blocks in the entire edition.
      // No section is ever set to a different font size than another section.
      let size = ptBase
      apply(size)

      // Find the uniform font size where all blocks fit without overflowing
      while (size > ptFloor && all.some(overflowing)) {
        size -= BODY_PT_STEP
        apply(size)
      }

      // Strictly ensure NO section ever has an individual font size override
      all.forEach((el) => {
        el.style.fontSize = ''
      })

      if (isMalayalam) {
        // Uniform tight leading for Malayalam
        all.forEach((el) => {
          el.style.lineHeight = String(leadingBase)
        })
      } else {
        // Vertical justification via leading for English (closes white space without changing font size)
        for (const el of all) {
          let leading = leadingBase
          el.style.lineHeight = String(leading)
          while (leading < leadingMax) {
            const next = +(leading + BODY_LEADING_STEP).toFixed(2)
            el.style.lineHeight = String(next)
            if (overflowing(el)) {
              el.style.lineHeight = String(leading)
              break
            }
            leading = next
          }
        }
      }
    }

    fit()

    if (isMalayalam && typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(fit)
    }

    // Column widths change when the preview is scaled or the window resized.
    const observer = new ResizeObserver(fit)
    observer.observe(root)
    return () => observer.disconnect()
  }, [containerRef, edition])
}

/**
 * Body copy in newspaper columns. The point size is deliberately not set here:
 * every section inherits the one edition-wide size fitted by `useCopyfit`.
 */
function BodyColumns({ columns, text, isMalayalam }) {
  const formattedText = useMemo(() => {
    if (!isMalayalam || !text) return text
    return formatMalayalamNewspaperText(text)
  }, [text, isMalayalam])

  if (isMalayalam) {
    return (
      <div
        data-copyfit
        className="mt-1.5 min-h-0 flex-1 overflow-hidden"
        style={{
          fontSize: 'var(--body-pt)',
          lineHeight: MALAYALAM_LEADING_BASE,
          columnCount: columns,
          columnGap: GRID_GAP + 'mm',
          columnRule: '0.4pt solid rgba(0,0,0,0.25)',
          textAlign: 'justify',
          textJustify: 'inter-word',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          lineBreak: 'loose',
          hyphens: 'none',
        }}
      >
        {formattedText}
      </div>
    )
  }

  // Exact original English implementation
  return (
    <div
      data-copyfit
      className="mt-1.5 min-h-0 flex-1 overflow-hidden text-justify hyphens-auto"
      style={{
        fontSize: 'var(--body-pt)',
        lineHeight: BODY_LEADING_BASE,
        columnCount: columns,
        columnGap: GRID_GAP + 'mm',
        columnRule: '0.4pt solid rgba(0,0,0,0.25)',
      }}
    >
      {text}
    </div>
  )
}

function Centered({ children }) {
  return <div className="grid min-h-screen place-items-center bg-white px-6 text-center text-muted">{children}</div>
}
