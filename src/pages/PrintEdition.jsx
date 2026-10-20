import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRightIcon, CheckIcon } from '../components/Icons'
import { TOTAL_SECTIONS } from '../data/sections'
import { COLUMNS, GRID_GAP, SHEET, SHEET_PADDING, TYPE, rowHeight } from '../data/printGeometry'
import {
  effectiveCapacityFor,
  getLeadStoryLeftRatio,
  leadStoryLeftCharLimitFor,
  MIN_FILL_RATIO,
  sentenceEndOffsets,
  splitLeadStoryText,
} from '../lib/capacity'
import { buildPages } from '../data/templates'
import { readTemplates } from '../lib/templateStore'
import { formatMalayalamNewspaperText, isMalayalamEdition } from '../lib/malayalamTypography'
import { cleanSectionContent, cleanSectionTitle } from '../lib/contentSanitizer'
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

// Copyfitting bounds, in points. Sizing is strictly uniform across all sections
// in the edition, matching authentic newspaper typography.
const EMPTY_PRINT_CONTENTS = {}

const bodyOverflows = (element) =>
  element.scrollWidth - element.clientWidth > 1.5 ||
  element.scrollHeight - element.clientHeight > 1.5

function setBodyText(element, text, isMalayalam) {
  const figure = Array.from(element.children).find((child) => child.tagName === 'FIGURE')
  for (const child of Array.from(element.childNodes)) {
    if (child !== figure) child.remove()
  }
  const displayText = isMalayalam ? formatMalayalamNewspaperText(text) : text
  if (displayText) element.append(document.createTextNode(displayText))
}

/** Tests the exact fixed-size PDF body boxes and returns only complete sentences that fit. */
function fittedSentencePrefix({
  sectionElement,
  block,
  content,
  isLeadPhoto,
  leftRatio,
  leftCharLimit,
  isMalayalam,
}) {
  const bodies = Array.from(sectionElement.querySelectorAll('[data-copyfit]'))
  if (!bodies.length || !bodies.some(bodyOverflows)) return content

  const showText = (candidate) => {
    if (isLeadPhoto) {
      const split = splitLeadStoryText(
        candidate,
        block.span,
        leftRatio,
        leftCharLimit,
        isMalayalam ? 'malayalam' : 'english',
      )
      setBodyText(bodies[0], split.leftText, isMalayalam)
      if (bodies[1]) setBodyText(bodies[1], split.rightText, isMalayalam)
    } else {
      setBodyText(bodies[0], candidate, isMalayalam)
    }
  }

  let fitted = ''
  const ends = sentenceEndOffsets(content, isMalayalam ? 'malayalam' : 'english')
  for (let index = ends.length - 1; index >= 0; index -= 1) {
    const candidate = content.slice(0, ends[index]).trimEnd()
    if (!candidate || candidate.length >= content.length) continue
    showText(candidate)
    if (bodies.every((body) => !bodyOverflows(body))) {
      fitted = candidate
      break
    }
  }

  const original = isLeadPhoto
    ? splitLeadStoryText(
        content,
        block.span,
        leftRatio,
        leftCharLimit,
        isMalayalam ? 'malayalam' : 'english',
      )
    : { leftText: content, rightText: '' }
  setBodyText(bodies[0], original.leftText, isMalayalam)
  if (bodies[1]) setBodyText(bodies[1], original.rightText, isMalayalam)
  return fitted
}

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
  const [fontMetricsReady, setFontMetricsReady] = useState(
    () => typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded',
  )
  const [printFit, setPrintFit] = useState({ editionId: null, contents: EMPTY_PRINT_CONTENTS, ready: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [completing, setCompleting] = useState(false)
  // Kept apart from `error`, which replaces the whole page: a failed status
  // update should not throw away the sheets the user is about to print.
  const [completeError, setCompleteError] = useState('')

  // The layout the editor was using, so the printed sheet matches the preview.
  const pages = useMemo(() => buildPages(readTemplates(editionId)), [editionId])

  // Holds the fixed-size sheets while their actual copy is measured.
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

  const printContents = printFit.editionId === editionId ? printFit.contents : EMPTY_PRINT_CONTENTS
  const printFitReady = printFit.editionId === editionId && printFit.ready
  const printSections = useMemo(() => {
    if (!Object.keys(printContents).length) return sections
    const fitted = { ...sections }
    for (const [key, content] of Object.entries(printContents)) {
      if (fitted[key]) fitted[key] = { ...fitted[key], content }
    }
    return fitted
  }, [printContents, sections])
  const capacityLanguage = isMalayalamEdition(edition) ? 'malayalam' : 'english'

  useLayoutEffect(() => {
    if (!edition || !sheetsRef.current) return undefined
    let active = true

    const measurePrintCopy = async () => {
      if (document.fonts?.ready) await document.fonts.ready
      if (!active) return
      setFontMetricsReady(true)

      const root = sheetsRef.current
      if (!root) return
      const elementsByKey = new Map(
        Array.from(root.querySelectorAll('[data-section-key]')).map((element) => [
          element.dataset.sectionKey,
          element,
        ]),
      )
      const nextContents = { ...printContents }
      const isMalayalam = isMalayalamEdition(edition)

      for (const page of pages) {
        for (const block of page.blocks) {
          const rowIndex = page.rows.findIndex((row) =>
            row.blocks.some((candidate) => candidate.section_key === block.section_key),
          )
          const section = sections[block.section_key]
          const content = printContents[block.section_key] ?? cleanSectionContent(section?.content ?? '')
          const sectionTitle = cleanSectionTitle(section?.title, section?.content)
          if (!content) continue

          const sectionElement = elementsByKey.get(block.section_key)
          if (!sectionElement) continue
          const hasPhoto = Boolean(section?.image_url && section?.photoMode !== 'none')
          const isLeadPhoto = hasPhoto && page.blocks[0]?.section_key === block.section_key
          const leftRatio = isLeadPhoto
            ? getLeadStoryLeftRatio(
                block,
                page.rows.length,
                rowHeight(page, rowIndex),
                section?.image_caption,
                sectionTitle,
                capacityLanguage,
              )
            : null
          const leftCharLimit = isLeadPhoto
            ? leadStoryLeftCharLimitFor({
                sectionKey: block.section_key,
                pages,
                language: capacityLanguage,
                sectionTitle,
              })
            : null
          const fitted = fittedSentencePrefix({
            sectionElement,
            block,
            content,
            isLeadPhoto,
            leftRatio,
            leftCharLimit,
            isMalayalam,
          })

          if (fitted !== content) nextContents[block.section_key] = fitted
        }
      }

      if (!active) return
      setPrintFit((current) => {
        const currentContents = current.editionId === editionId ? current.contents : EMPTY_PRINT_CONTENTS
        const changed = Object.keys(nextContents).some((key) => nextContents[key] !== currentContents[key])
        if (changed) return { editionId, contents: nextContents, ready: false }
        if (current.editionId === editionId && current.ready) return current
        return { editionId, contents: nextContents, ready: true }
      })
    }

    measurePrintCopy()
    return () => {
      active = false
    }
  }, [editionId, edition, pages, sections, printContents, capacityLanguage])

  // The same rule the server's /validate applies, checked here so the page can
  // explain exactly what is missing instead of printing a half-empty paper.
  const missing = useMemo(
    () =>
      pages.flatMap((page) => page.blocks).filter((block) => {
        const section = sections[block.section_key]
        const title = cleanSectionTitle(section?.title, section?.content)
        const content = cleanSectionContent(section?.content ?? '')
        return !(title && content && section.status === 'completed')
      }),
    [pages, sections],
  )

  // Sections well short of their box print with visible white space beneath
  // them. Not a blocker — a writer may want a short piece — but worth saying
  // before the paper is committed to print.
  const thin = useMemo(
    () => {
      if (!fontMetricsReady) return []
      return pages
        .flatMap((page) =>
          page.blocks.map((block) => {
            const section = sections[block.section_key]
            const isFirst = page.blocks[0]?.section_key === block.section_key
            const hasPhoto = Boolean(section?.image_url && section?.photoMode !== 'none')
            const capacity =
              effectiveCapacityFor({
                sectionKey: block.section_key,
                pages,
                language: capacityLanguage,
                hasPhoto,
                isFirstSection: isFirst,
                photoCaption: section?.image_caption,
                sectionTitle: cleanSectionTitle(section?.title, section?.content),
              }) ?? block.charLimit
            const length = cleanSectionContent(section?.content ?? '').length
            return { block, capacity, length, fill: length / capacity }
          }),
        )
        .filter((entry) => entry.length > 0 && entry.fill < MIN_FILL_RATIO)
    },
    [capacityLanguage, fontMetricsReady, pages, sections],
  )

  const truncatedSections = useMemo(
    () =>
      pages.flatMap((page) =>
        page.blocks.flatMap((block) => {
          if (!Object.hasOwn(printContents, block.section_key)) return []
          const original = cleanSectionContent(sections[block.section_key]?.content ?? '')
          const fitted = printContents[block.section_key]
          return original !== fitted ? [{ block, original, fitted }] : []
        }),
      ),
    [pages, printContents, sections],
  )

  const noCompleteSentenceFits = truncatedSections.filter((entry) => !entry.fitted)

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
            disabled={missing.length > 0 || !printFitReady || noCompleteSentenceFits.length > 0}
            title={!printFitReady ? 'Measuring copy against the fixed PDF layout' : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            <CheckIcon className="size-5" />
            {printFitReady ? 'Print / Save as PDF' : 'Preparing PDF…'}
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

      {truncatedSections.length > 0 && (
        <div className="no-print mx-auto mt-6 max-w-[900px] rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[15px] text-amber-900">
          <p className="font-semibold">
            The fixed-size PDF will include complete sentences that fit each text box.
          </p>
          <p className="mt-1">
            {noCompleteSentenceFits.length > 0
              ? `No complete sentence fits in: ${noCompleteSentenceFits.map(({ block }) => block.section_name).join(', ')}. Shorten those sections before printing.`
              : `Trailing copy is omitted from: ${truncatedSections.map(({ block }) => block.section_name).join(', ')}.`}
          </p>
        </div>
      )}

      {missing.length === 0 && thin.length > 0 && (
        <div className="no-print mx-auto mt-6 max-w-[900px] rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[15px] text-amber-900">
          <p className="font-semibold">
            {thin.length} section{thin.length === 1 ? '' : 's'} will leave white space — the text
            fills less than {Math.round(MIN_FILL_RATIO * 100)}% of the box.
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

      <div
        ref={sheetsRef}
        style={{
          '--body-pt': `${capacityLanguage === 'malayalam' ? TYPE.malayalamBodyPt : TYPE.bodyPt}pt`,
        }}
        className="flex flex-col items-center gap-8 px-6 py-8 print:gap-0 print:p-0"
      >
        {pages.map((page) => (
          <Sheet
            key={page.page_number}
            page={page}
            pages={pages}
            totalPages={pages.length}
            edition={edition}
            sections={printSections}
            capacityLanguage={capacityLanguage}
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

function Sheet({ page, pages, totalPages, edition, sections, capacityLanguage }) {
  const isFront = page.page_number === 1
  const isMalayalam = isMalayalamEdition(edition)

  return (
    <article
      className={`print-sheet bg-white text-black shadow-[0_10px_40px_-24px_rgba(15,32,68,0.5)] print:shadow-none ${
        isMalayalam ? 'edition-malayalam' : 'edition-english'
      }`}
      lang={isMalayalam ? 'ml' : 'en'}
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
        {page.rows.flatMap((row, rowIndex) =>
          row.blocks.map((block) => {
            const section = sections[block.section_key]
            const isFirst = page.blocks[0]?.section_key === block.section_key
            const hasPhoto = Boolean(section?.image_url && section?.photoMode !== 'none')
            const rawTitle = cleanSectionTitle(section?.title, section?.content)
            const leadLeftCharLimit = isFirst && hasPhoto
              ? leadStoryLeftCharLimitFor({
                  sectionKey: block.section_key,
                  pages,
                  language: capacityLanguage,
                  sectionTitle: rawTitle,
                })
              : null
            const title = isMalayalam ? formatMalayalamNewspaperText(rawTitle) : rawTitle

            return (
              <section
                key={block.section_key}
                data-section-key={block.section_key}
                className="flex min-h-0 flex-col overflow-hidden border-t border-black/30 pt-1.5"
                style={{ gridColumn: `span ${block.span} / span ${block.span}` }}
              >
                <p className="text-[7.5pt] font-bold tracking-[0.12em] uppercase">
                  {section?.section_name?.trim() || block.section_name}
                </p>
                <h2
                  className={`mt-1 font-serif leading-[1.1] ${
                    isMalayalam
                      ? 'text-[20pt]'
                      : block.span === 3
                        ? 'text-[22pt]'
                        : block.span === 2
                          ? 'text-[16pt]'
                          : 'text-[13pt]'
                  }`}
                >
                  {title}
                </h2>
                {Boolean(section?.content_source) && (
                  <p className="mt-0.5 text-[6.8pt] italic text-black/70 font-sans tracking-wide">
                    {section.content_source}
                  </p>
                )}
                <SectionBody
                  block={block}
                  section={section}
                  isFirstSection={isFirst}
                  hasPhoto={hasPhoto}
                  isMalayalam={isMalayalam}
                  totalRows={page.rows.length}
                  rowHeightMm={rowHeight(page, rowIndex)}
                  leadLeftCharLimit={leadLeftCharLimit}
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
 * Body copy in newspaper columns. Every section inherits the fixed edition
 * body size set on the sheet container.
 */
function BodyColumns({ columns, text, isMalayalam, photo, caption, photoHeightMm, className = 'mt-1.5' }) {
  const formattedText = useMemo(() => {
    if (!isMalayalam || !text) return text
    return formatMalayalamNewspaperText(text)
  }, [text, isMalayalam])

  const photoFigure = photo ? (
    <figure
      style={{
        breakInside: 'avoid',
        WebkitColumnBreakInside: 'avoid',
        pageBreakInside: 'avoid',
        width: '100%',
        marginBottom: '1.5mm',
        display: 'block',
      }}
    >
      <img
        src={photo}
        alt=""
        style={{
          width: '100%',
          height: (photoHeightMm || 32) + 'mm',
          objectFit: 'cover',
          display: 'block',
          filter: 'contrast(1.05)',
        }}
      />
      {caption && (
        <figcaption
          style={{
            fontSize: '6.8pt',
            fontStyle: 'italic',
            color: 'rgba(0,0,0,0.75)',
            lineHeight: 1.15,
            marginTop: '0.8mm',
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  ) : null

  if (isMalayalam) {
    return (
      <div
        data-copyfit
        className={`${className} min-h-0 flex-1 overflow-hidden`}
        style={{
          fontSize: 'var(--body-pt)',
          lineHeight: TYPE.malayalamBodyLeading,
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
        {photoFigure}
        {formattedText}
      </div>
    )
  }

  // Exact original English implementation with uniform point size and hyphens
  return (
    <div
      data-copyfit
      className={`${className} min-h-0 flex-1 overflow-hidden text-justify hyphens-auto`}
      style={{
        fontSize: 'var(--body-pt)',
        lineHeight: TYPE.bodyLeading,
        columnCount: columns,
        columnGap: GRID_GAP + 'mm',
        columnRule: '0.4pt solid rgba(0,0,0,0.25)',
      }}
    >
      {photoFigure}
      {text}
    </div>
  )
}

/**
 * Renders the body area of a printed newspaper section with column-locked photo placement.
 * - First News Section on Every Page: photo locked to last two columns on right, text on left and underneath photo
 * - All Other News Sections: single photo locked to top of first column, text starting underneath and continuing into remaining columns
 * - Text-Only Sections: standard multi-column layout
 */
function SectionBody({
  block,
  section,
  isFirstSection,
  hasPhoto,
  isMalayalam,
  totalRows = 3,
  rowHeightMm,
  leadLeftCharLimit,
}) {
  const content = cleanSectionContent(section?.content ?? '')

  // Case 1: First News Section with active photo
  if (isFirstSection && hasPhoto) {
    const totalCols = COLUMNS[block.span]
    const leftCols = Math.max(1, totalCols - 2)
    const rightCols = totalCols - leftCols
    const leftRatio = getLeadStoryLeftRatio(
      block,
      totalRows,
      rowHeightMm,
      section.image_caption,
      cleanSectionTitle(section?.title, section?.content),
      isMalayalam ? 'malayalam' : 'english',
    )
    const { leftText, rightText } = splitLeadStoryText(
      content,
      block.span,
      leftRatio,
      leadLeftCharLimit,
      isMalayalam ? 'malayalam' : 'english',
    )

    const leadPhotoHeightMm = block.span === 3 ? 42 : block.span === 2 ? 36 : 28

    return (
      <div className="mt-1.5 flex flex-1 min-h-0 overflow-hidden">
        {/* Left columns (e.g. 3 cols for span 3, 1 col for span 2) */}
        <div
          className="flex flex-col min-h-0 min-w-0"
          style={{
            flex: leftCols,
            paddingRight: GRID_GAP / 2 + 'mm',
            borderRight: '0.4pt solid rgba(0,0,0,0.25)',
          }}
        >
          <BodyColumns
            columns={leftCols}
            text={leftText}
            isMalayalam={isMalayalam}
          />
        </div>

        {/* Right side locked photo spanning last columns */}
        <div
          className="flex flex-col min-h-0 min-w-0 overflow-hidden"
          style={{
            flex: rightCols,
            paddingLeft: GRID_GAP / 2 + 'mm',
          }}
        >
          <figure
            style={{
              width: '100%',
              marginBottom: '1.2mm',
              display: 'block',
              flexShrink: 0,
            }}
          >
            <img
              src={section.image_url}
              alt=""
              style={{
                width: '100%',
                height: leadPhotoHeightMm + 'mm',
                objectFit: 'cover',
                display: 'block',
                filter: 'contrast(1.05)',
              }}
            />
            {section.image_caption && (
              <figcaption
                style={{
                  fontSize: '6.8pt',
                  fontStyle: 'italic',
                  color: 'rgba(0,0,0,0.75)',
                  lineHeight: 1.15,
                  marginTop: '0.6mm',
                }}
              >
                {section.image_caption}
              </figcaption>
            )}
          </figure>

          {/* Continuing body text underneath the photo */}
          {rightText ? (
            <BodyColumns
              columns={rightCols}
              text={rightText}
              isMalayalam={isMalayalam}
              className="mt-0"
            />
          ) : (
            <div className="flex-1 min-h-0" />
          )}
        </div>
      </div>
    )
  }

  // Case 2: All Other News Sections with photo (single photo in first column at top)
  if (hasPhoto) {
    const photoHeightMm = block.size === 'small' ? 24 : 33
    return (
      <BodyColumns
        columns={COLUMNS[block.span]}
        text={content}
        photo={section.image_url}
        caption={section.image_caption}
        photoHeightMm={photoHeightMm}
        isMalayalam={isMalayalam}
      />
    )
  }

  // Case 3: Text-only sections (photoMode === 'none')
  return (
    <BodyColumns
      columns={COLUMNS[block.span]}
      text={content}
      isMalayalam={isMalayalam}
    />
  )
}

function Centered({ children }) {
  return <div className="grid min-h-screen place-items-center bg-white px-6 text-center text-muted">{children}</div>
}
