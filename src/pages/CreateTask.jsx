import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import NewspaperCanvas from '../components/NewspaperCanvas'
import Sidebar from '../components/Sidebar'
import TemplateThumb from '../components/TemplateThumb'
import Waveform from '../components/Waveform'
import {
  ArrowRightIcon,
  CheckIcon,
  InfoIcon,
  MicIcon,
  PencilIcon,
  PrinterIcon,
  SparkleIcon,
  StopIcon,
  TrashIcon,
  XIcon,
} from '../components/Icons'
import { ALL_BLOCKS, PAGES, TOTAL_SECTIONS, blockFor } from '../data/sections'
import * as api from '../lib/api'
import { useSpeechRecognition } from '../lib/useSpeechRecognition'
import { useMicLevel } from '../lib/useMicLevel'
import { printCapacityFor } from '../lib/capacity'
import { buildPage, buildPages, templatesForPage } from '../data/templates'
import { readTemplates, writeTemplate } from '../lib/templateStore'

const AUTOSAVE_MS = 2000

/** Builds the local map the editor edits, seeded from whatever the server has. */
function toSectionMap(saved = []) {
  const map = {}
  for (const section of saved) {
    map[section.section_key] = {
      title: section.title ?? '',
      content: section.content ?? '',
      status: section.status ?? 'draft',
      // The label is stored per section on the server (SectionBase.section_name),
      // so a rename survives a reload. Empty means "use the canonical name".
      section_name: section.section_name ?? '',
    }
  }
  return map
}

const emptySection = { title: '', content: '', status: 'draft', section_name: '' }

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Spacing between bulk AI calls, to stay clear of upstream rate limits. */
const FILL_PACING_MS = 800

/**
 * Runs an AI call, retrying once after a pause. The upstream model returns
 * intermittent 502s under back-to-back requests, and losing a section to a
 * transient error in the middle of a nineteen-section run is worth one retry.
 */
async function withRetry(call) {
  try {
    return await call()
  } catch (err) {
    if (!/50\d|Gateway|timeout/i.test(err.message)) throw err
    await wait(1500)
    return call()
  }
}

export default function CreateTask() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editionId = searchParams.get('edition')

  const [edition, setEdition] = useState(null)
  const [sections, setSections] = useState({})
  const [pageIndex, setPageIndex] = useState(0)
  const [activeKey, setActiveKey] = useState(PAGES[0].blocks[0].section_key)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [generating, setGenerating] = useState(false)
  const [validation, setValidation] = useState(null)
  const [fill, setFill] = useState({ running: false, done: 0, total: 0, failed: [] })

  // Auto-dismiss readiness check toast notification after 6 seconds
  useEffect(() => {
    if (!validation) return undefined
    const timer = setTimeout(() => {
      setValidation(null)
    }, 6000)
    return () => clearTimeout(timer)
  }, [validation])

  // Read inside the fill loop, so cancelling takes effect on the next section
  // rather than waiting for a re-render.
  const cancelFillRef = useRef(false)
  const failedFillRef = useRef([])

  // Template choice per page, kept in the browser (the backend has no field
  // for a layout). Resolving here means the canvas, the capacity maths and the
  // print sheet all follow the same arrangement.
  const [templates, setTemplates] = useState(() => readTemplates(editionId))
  const pages = useMemo(() => buildPages(templates), [templates])
  const page = pages[pageIndex]
  const block = useMemo(() => blockFor(activeKey) ?? ALL_BLOCKS[0], [activeKey])
  const activeSection = sections[activeKey] ?? emptySection

  // The section label shown on the canvas and in the editor. Editable per
  // section; a blank override just means the canonical name from sections.js.
  const activeName = activeSection.section_name?.trim() || block.section_name
  const nameIsCustom = activeName !== block.section_name

  // How much text this section's box holds on the printed sheet. Derived from
  // the print geometry, not the on-screen preview block — sizing copy to the
  // preview is what left the exported PDF 11% full.
  const charLimit = printCapacityFor(activeKey, pages) ?? block.charLimit

  // An edition id is required — the editor has nothing to write to without one.
  useEffect(() => {
    if (!editionId) navigate('/', { replace: true })
  }, [editionId, navigate])

  useEffect(() => {
    if (!editionId) return undefined
    let active = true
    api
      .getEdition(editionId)
      .then((detail) => {
        if (!active) return
        setEdition(detail)
        setSections(toSectionMap(detail.sections))
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [editionId])

  /* ------------------------------------------------------------- saving */

  // The latest edits live in a ref so a debounced flush always writes current
  // text, even when it fires after the section selection has moved on.
  const pendingRef = useRef({})
  const timerRef = useRef(null)

  const flush = useCallback(
    async (sectionKey) => {
      const draft = pendingRef.current[sectionKey]
      if (!draft || !editionId) return
      delete pendingRef.current[sectionKey]

      const target = blockFor(sectionKey)
      setSaveState('saving')
      try {
        await api.saveSection(editionId, {
          page_number: target.page_number,
          section_key: target.section_key,
          // A blank custom label falls back to the canonical section name.
          section_name: draft.section_name?.trim() || target.section_name,
          title: draft.title,
          content: draft.content,
          status: draft.status,
        })
        setSaveState('saved')
      } catch (err) {
        setSaveState('error')
        setError(err.message)
      }
    },
    [editionId],
  )

  const queueSave = useCallback(
    (sectionKey, draft) => {
      pendingRef.current[sectionKey] = draft
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => flush(sectionKey), AUTOSAVE_MS)
    },
    [flush],
  )

  const editSection = useCallback(
    (sectionKey, changes) => {
      setSections((current) => {
        const next = { ...(current[sectionKey] ?? emptySection), ...changes }
        queueSave(sectionKey, next)
        return { ...current, [sectionKey]: next }
      })
    },
    [queueSave],
  )

  // Never leave an edit stranded in the debounce window.
  useEffect(() => () => clearTimeout(timerRef.current), [])

  /* -------------------------------------------------------------- speech */

  // Stores the recorded transcript for review before applying or discarding.
  const [voiceDraft, setVoiceDraft] = useState('')

  const handleSpeechResult = useCallback((phrase) => {
    setVoiceDraft((prev) => (prev ? prev + ' ' + phrase : phrase))
  }, [])

  const speech = useSpeechRecognition({ onResult: handleSpeechResult })

  // Runs alongside recognition purely to show that audio is arriving.
  const mic = useMicLevel(speech.listening)

  function handleStartRecording() {
    if (speech.listening) return
    setVoiceDraft('')
    setNotice('')
    speech.start()
  }

  function handleStopRecording() {
    if (speech.interim && speech.interim.trim()) {
      const pending = speech.interim.trim()
      setVoiceDraft((prev) => (prev ? prev + ' ' + pending : pending))
    }
    speech.stop()
  }

  function handleDiscardVoice() {
    if (speech.listening) {
      speech.stop()
    }
    setVoiceDraft('')
  }

  function handleApplyVoice() {
    if (!voiceDraft.trim()) return
    const current = sections[activeKey]?.content ?? ''
    const merged = (current ? current + ' ' + voiceDraft.trim() : voiceDraft.trim()).slice(0, charLimit)
    editSection(activeKey, { content: merged })
    setVoiceDraft('')
  }

  /* ----------------------------------------------------------- navigation */

  // Wrapped so the memoised canvas keeps a stable prop and does not re-render
  // every time the recorder reports a new level.
  const selectSection = useCallback(
    (sectionKey) => {
      clearTimeout(timerRef.current)
      flush(activeKey)
      if (speech.listening) speech.stop()
      setVoiceDraft('')
      setActiveKey(sectionKey)
      setNotice('')
    },
    [flush, activeKey, speech],
  )

  function selectPage(index) {
    clearTimeout(timerRef.current)
    flush(activeKey)
    if (speech.listening) speech.stop()
    setVoiceDraft('')
    setPageIndex(index)
    setActiveKey(pages[index].blocks[0].section_key)
    setNotice('')
  }

  /**
   * Switching template only rearranges the page — the sections and everything
   * written into them are untouched, so nothing needs saving to the server.
   * The new box sizes do change each section's capacity, which the AI limit
   * picks up automatically through `pages`.
   */
  function selectTemplate(pageNumber, templateKey) {
    setTemplates(writeTemplate(editionId, pageNumber, templateKey))
  }

  /* ------------------------------------------------------------------ ai */

  async function handleExpand() {
    setNotice('')
    setGenerating(true)
    try {
      const result = await api.expandContent({
        summary: activeSection.content,
        characterLimit: charLimit,
      })
      editSection(activeKey, {
        content: result.expanded_content,
        // A generated headline only fills an empty title, never overwrites one.
        title: activeSection.title || result.generated_title || '',
      })
    } catch (err) {
      setNotice(err.message)
    } finally {
      setGenerating(false)
    }
  }

  /* ------------------------------------------------------- bulk page fill */

  // A section this far below its box's capacity leaves visible white space on
  // the printed sheet.
  const UNDERFILL_RATIO = 0.6

  const underFilled = useMemo(
    () =>
      ALL_BLOCKS.filter((candidate) => {
        const section = sections[candidate.section_key]
        if (!section?.content?.trim()) return false
        const limit = printCapacityFor(candidate.section_key, pages) ?? candidate.charLimit
        return section.content.length < limit * UNDERFILL_RATIO
      }),
    [pages, sections],
  )

  async function handleFillAll() {
    if (fill.running) {
      // A second click cancels; the loop checks this between sections.
      cancelFillRef.current = true
      return
    }

    cancelFillRef.current = false
    setNotice('')
    setFill({ running: true, done: 0, total: underFilled.length, failed: [] })

    // Kept in a ref: refs are mutable by design, and the failures list must
    // survive the loop without being the same object React holds in state.
    failedFillRef.current = []
    for (const [index, candidate] of underFilled.entries()) {
      if (cancelFillRef.current) break

      const key = candidate.section_key
      const current = sections[key]
      const limit = printCapacityFor(key, pages) ?? candidate.charLimit

      try {
        // Sequential on purpose: 19 parallel calls invite Groq rate-limiting.
        // Even sequentially, back-to-back calls return the occasional 502 from
        // the upstream model, so each section gets one retry after a pause.
        const result = await withRetry(() =>
          api.expandContent({ summary: current.content, characterLimit: limit }),
        )
        editSection(key, {
          content: result.expanded_content,
          title: current.title || result.generated_title || '',
        })
      } catch (err) {
        // One bad section should not abandon the other eighteen.
        failedFillRef.current.push(`${candidate.section_name} (${err.message})`)
      }

      setFill((state) => ({ ...state, done: index + 1, failed: [...failedFillRef.current] }))

      // Breathe between calls rather than hammering the model back to back.
      if (index < underFilled.length - 1) await wait(FILL_PACING_MS)
    }

    const failed = failedFillRef.current
    setFill((state) => ({ ...state, running: false }))
    if (failed.length) {
      setNotice(`Could not fill ${failed.length} section(s): ${failed.join('; ')}`)
    }
    await refreshValidation()
  }

  async function handleHeadline() {
    setNotice('')
    setGenerating(true)
    try {
      const { headline } = await api.generateHeadline({ content: activeSection.content })
      editSection(activeKey, { title: headline })
    } catch (err) {
      setNotice(err.message)
    } finally {
      setGenerating(false)
    }
  }

  /* ---------------------------------------------------------- completion */

  async function toggleComplete() {
    const next = activeSection.status === 'completed' ? 'draft' : 'completed'
    if (next === 'completed' && !(activeSection.title && activeSection.content)) {
      setNotice('Add both a headline and body text before marking this section complete.')
      return
    }
    editSection(activeKey, { status: next })
    clearTimeout(timerRef.current)
    await flush(activeKey)
    await refreshValidation(false)
  }

  const refreshValidation = useCallback(async (showToast = false) => {
    if (!editionId) return
    try {
      const result = await api.validateEdition(editionId)
      if (showToast) {
        setValidation(result)
      }
      // /validate also moves the edition between in_progress and ready.
      const fresh = await api.getEdition(editionId)
      setEdition(fresh)
    } catch (err) {
      setError(err.message)
    }
  }, [editionId])

  const completedCount = Object.values(sections).filter(
    (s) => s.status === 'completed' && s.title && s.content,
  ).length

  const completedKeys = useMemo(
    () =>
      new Set(
        Object.entries(sections)
          .filter(([, s]) => s.status === 'completed' && s.title && s.content)
          .map(([key]) => key),
      ),
    [sections],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen bg-white">
        <Sidebar variant="panel" />
        <p className="m-auto text-muted">Loading edition…</p>
      </div>
    )
  }

  if (error && !edition) {
    return (
      <div className="flex min-h-screen bg-white">
        <Sidebar variant="panel" />
        <div className="m-auto text-center">
          <p role="alert" className="text-[17px] font-semibold text-red-700">
            {error}
          </p>
          <Link to="/" className="mt-4 inline-block text-brand-600 hover:text-brand-500">
            Back to workspace
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar variant="panel" />

      {/* Page picker */}
      <aside className="hidden w-[320px] shrink-0 flex-col border-r border-line bg-canvas px-5 py-8 xl:flex">
        <h2 className="text-[22px] font-bold text-navy-900">Pages &amp; Templates</h2>
        <p className="mt-1 text-[15px] text-muted">
          {completedCount} of {TOTAL_SECTIONS} sections completed.
        </p>

        <ul className="scroll-thin mt-6 flex-1 space-y-3 overflow-y-auto pr-1">
          {pages.map((item, index) => {
            const selected = index === pageIndex
            const done = item.blocks.filter((b) => completedKeys.has(b.section_key)).length
            const variants = templatesForPage(item.page_number)
            return (
              <li
                key={item.page_number}
                className={[
                  'rounded-2xl border bg-white transition',
                  selected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => selectPage(index)}
                  aria-pressed={selected}
                  className="flex w-full items-start gap-3.5 p-3.5 text-left"
                >
                  <TemplateThumb
                    blocks={item.blocks}
                    completedKeys={completedKeys}
                    className="w-[62px] shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">
                      Page {item.page_number} — {item.name}
                    </span>
                    <span className="mt-1 block text-[13px] text-muted">{item.templateName}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">
                      {done} of {item.blocks.length} sections done
                    </span>
                  </span>
                  {done === item.blocks.length && (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-500 text-white">
                      <CheckIcon className="size-4" />
                    </span>
                  )}
                </button>

                {/* Templates rearrange the sections a page already owns, so
                    switching never changes what has been written. */}
                {selected && (
                  <div className="border-t border-line px-3.5 py-3">
                    <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">
                      Change template
                    </p>
                    <div className="mt-2 flex gap-2">
                      {variants.map((variant) => {
                        const current = variant.key === item.templateKey
                        return (
                          <button
                            key={variant.key}
                            type="button"
                            onClick={() => selectTemplate(item.page_number, variant.key)}
                            aria-pressed={current}
                            title={variant.description}
                            className={[
                              'flex-1 rounded-xl border p-2 text-left transition',
                              current
                                ? 'border-brand-500 bg-brand-50/60'
                                : 'border-line hover:border-brand-100',
                            ].join(' ')}
                          >
                            <TemplateThumb
                              blocks={buildPage(item.page_number, variant.key).blocks}
                              completedKeys={completedKeys}
                              className="w-full"
                            />
                            <span
                              className={[
                                'mt-1.5 block text-[12px] font-medium',
                                current ? 'text-brand-600' : 'text-muted',
                              ].join(' ')}
                            >
                              {variant.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </aside>

      {/* Main column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 px-8 py-6">
          <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
            <Link to="/" className="hover:text-ink">
              Workspace
            </Link>
            <span className="px-2 text-slate-300">/</span>
            <span className="font-medium text-brand-500">{edition?.newspaper_name}</span>
            <span className="px-2 text-slate-300">/</span>
            <span className="text-ink">Page {page.page_number}</span>
          </nav>

          <div className="flex items-center gap-4">
            <SaveIndicator state={saveState} />

            {/* Existing copy was written against the old undersized limits, so
                a bulk pass avoids running "Expand to fit" nineteen times. */}
            {(underFilled.length > 0 || fill.running) && (
              <button
                type="button"
                onClick={handleFillAll}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-500 px-5 py-3.5 text-[15px] font-semibold text-brand-600 transition hover:bg-brand-50"
              >
                <SparkleIcon className="size-5" />
                {fill.running
                  ? `Filling ${fill.done + 1} of ${fill.total} — click to stop`
                  : `Fill ${underFilled.length} thin section${underFilled.length === 1 ? '' : 's'}`}
              </button>
            )}

            <button
              type="button"
              onClick={() => refreshValidation(true)}
              className="inline-flex items-center gap-3 rounded-xl bg-navy-900 px-6 py-3.5 text-[16px] font-semibold text-white transition hover:bg-navy-700"
            >
              Check readiness
              <ArrowRightIcon className="size-5" />
            </button>
          </div>
        </header>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col px-8 pb-6">
          <h1 className="shrink-0 text-[clamp(26px,2.6vw,36px)] font-bold text-navy-900">
            {edition?.newspaper_name}
          </h1>
          <p className="shrink-0 mt-2 text-[17px] text-muted">
            {edition?.edition_label} edition · {edition?.date} · {completedCount}/{TOTAL_SECTIONS}{' '}
            sections completed
          </p>

          {/* Floating Toast Notification for Readiness Check */}
          {validation && (
            <div
              role="alert"
              aria-live="polite"
              className={[
                'fixed top-6 right-6 z-50 w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-5',
                validation.all_completed
                  ? 'border-emerald-200 bg-white/95 text-emerald-950 shadow-emerald-900/10'
                  : 'border-amber-200 bg-white/95 text-amber-950 shadow-amber-900/10',
              ].join(' ')}
            >
              {/* Toast Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/60">
                <div className="flex items-center gap-2.5">
                  <div
                    className={[
                      'flex size-7 items-center justify-center rounded-full text-white',
                      validation.all_completed ? 'bg-emerald-600' : 'bg-amber-500',
                    ].join(' ')}
                  >
                    {validation.all_completed ? (
                      <CheckIcon className="size-4" />
                    ) : (
                      <InfoIcon className="size-4" />
                    )}
                  </div>
                  <span className="text-[14px] font-bold tracking-tight text-navy-900">
                    {validation.all_completed ? 'Readiness Check Passed' : 'Readiness Check'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setValidation(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
                  aria-label="Close notification"
                >
                  <XIcon className="size-4" />
                </button>
              </div>

              {/* Toast Body */}
              <div className="p-5 text-[14px]">
                {validation.all_completed ? (
                  <div>
                    <p className="font-medium text-slate-800">
                      All 19 sections are complete — this edition is ready to print.
                    </p>
                    <Link
                      to={'/print?edition=' + editionId}
                      className="mt-3.5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-emerald-700 shadow-sm"
                    >
                      <PrinterIcon className="size-4" />
                      Print edition
                    </Link>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-amber-950 text-[14px]">
                        {validation.incomplete_sections.length} section
                        {validation.incomplete_sections.length === 1 ? '' : 's'} still incomplete:
                      </p>
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Click to jump
                      </span>
                    </div>

                    <div className="mt-3 max-h-48 overflow-y-auto scroll-thin pr-1 flex flex-wrap gap-1.5">
                      {validation.incomplete_sections.map((s) => (
                        <button
                          key={s.section_key}
                          type="button"
                          onClick={() => {
                            selectPage(s.page_number - 1)
                            selectSection(s.section_key)
                          }}
                          title={`Jump to Page ${s.page_number}: ${s.section_name}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-[13px] font-medium text-amber-900 transition hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm active:scale-95 text-left"
                        >
                          <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-900">
                            P{s.page_number}
                          </span>
                          <span>{s.section_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full bg-slate-100 h-1">
                <div
                  className={validation.all_completed ? 'h-full bg-emerald-500' : 'h-full bg-amber-500'}
                  style={{ animation: 'toast-shrink 6s linear forwards' }}
                />
              </div>
            </div>
          )}

          {error && edition && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[15px] text-red-700"
            >
              {error}
            </p>
          )}

          {/* Small-screen page switcher, since the sidebar is xl-only. */}
          <div className="shrink-0 mt-6 flex gap-2 xl:hidden" role="group" aria-label="Select page">
            {pages.map((item, index) => (
              <button
                key={item.page_number}
                type="button"
                onClick={() => selectPage(index)}
                aria-pressed={index === pageIndex}
                className={[
                  'flex-1 rounded-xl border py-2.5 text-[14px] font-medium transition',
                  index === pageIndex
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-line bg-white text-ink',
                ].join(' ')}
              >
                Page {item.page_number}
              </button>
            ))}
          </div>

          <div className="mt-7 grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            {/* The only scrolling region: the page picker, the header and the
                section editor stay put while the sheet scrolls past them. */}
            <div className="scroll-thin min-h-0 overflow-y-auto pr-1">
              <NewspaperCanvas
                page={page}
                sections={sections}
                activeKey={activeKey}
                onSelectSection={selectSection}
                masthead={edition?.newspaper_name}
                editionDate={edition?.date}
                editionLabel={edition?.edition_label}
              />
            </div>

            {/* Section editor */}
            <section className="scroll-thin min-h-0 overflow-y-auto rounded-2xl border border-line bg-brand-50/40 p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-medium text-ink">Section label</span>
                    {nameIsCustom && (
                      <button
                        type="button"
                        onClick={() => editSection(activeKey, { section_name: '' })}
                        className="text-[13px] font-medium text-brand-600 transition hover:text-brand-500"
                      >
                        Reset to “{block.section_name}”
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-white px-4 transition focus-within:border-brand-500">
                    <PencilIcon className="size-4 shrink-0 text-muted" />
                    <input
                      value={activeName}
                      onChange={(e) =>
                        editSection(activeKey, { section_name: e.target.value.slice(0, 60) })
                      }
                      aria-label="Section label"
                      className="min-w-0 flex-1 bg-transparent py-2.5 text-[17px] font-bold text-navy-900 outline-none"
                    />
                  </div>
                  <p className="mt-1.5 text-[13px] text-muted">
                    Page {block.page_number} · {charLimit} characters fit the printed box
                  </p>
                </div>
                {activeSection.status === 'completed' && (
                  <span className="mt-6 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                    <CheckIcon className="size-3.5" />
                    Complete
                  </span>
                )}
              </div>

              <label className="mt-5 block">
                <span className="text-[14px] font-medium text-ink">Headline</span>
                <input
                  value={activeSection.title}
                  onChange={(e) => editSection(activeKey, { title: e.target.value })}
                  placeholder="Type or generate a headline..."
                  className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] outline-none focus:border-brand-500"
                />
              </label>

              {/* Unified Body Text & Voice Dictation Input */}
              <div className="mt-5 rounded-2xl border border-line bg-white p-4 transition-all focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 shadow-xs">
                {/* Textarea for typing */}
                <textarea
                  value={activeSection.content}
                  onChange={(e) =>
                    editSection(activeKey, { content: e.target.value.slice(0, charLimit) })
                  }
                  placeholder="Type section body, or record voice below..."
                  rows={8}
                  aria-label={'Body text for ' + activeName}
                  className="scroll-thin h-[200px] w-full resize-none overflow-y-auto bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-slate-400"
                />

                {/* --- 1. ACTIVE RECORDING STATE --- */}
                {speech.listening && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50/80 p-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      {/* Left: timer and compact waveform in single row */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="relative flex size-2.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                        </span>
                        <span className="text-[14px] font-bold text-red-600 tabular-nums shrink-0">
                          {speech.elapsed}
                        </span>
                        <Waveform
                          bars={10}
                          animated={speech.listening}
                          level={mic.level}
                          className="h-5 shrink-0"
                          color="bg-red-500"
                        />
                      </div>

                      {/* Right: Icon-only Cancel & Stop buttons in single row */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleDiscardVoice}
                          title="Cancel recording"
                          aria-label="Cancel recording"
                          className="grid size-8 place-items-center rounded-lg border border-red-200 bg-white text-red-600 shadow-xs transition hover:bg-red-50 active:scale-95 shrink-0"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleStopRecording}
                          title="Stop recording"
                          aria-label="Stop recording"
                          className="grid size-8 place-items-center rounded-lg bg-red-600 text-white shadow-xs transition hover:bg-red-700 active:scale-95 shrink-0"
                        >
                          <StopIcon className="size-4" />
                        </button>
                      </div>
                    </div>

                    {/* Live speech transcript preview */}
                    {(voiceDraft || speech.interim) && (
                      <div className="mt-2 rounded-lg border border-red-100 bg-white/95 p-2.5 text-[13px] leading-relaxed text-navy-900 shadow-xs">
                        <span>{voiceDraft} </span>
                        {speech.interim && (
                          <span className="text-red-500 italic opacity-85">{speech.interim}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* --- 2. REVIEW & DECIDE STATE (APPLY OR DELETE) --- */}
                {!speech.listening && voiceDraft.trim().length > 0 && (
                  <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/70 p-3 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-brand-900">
                        <MicIcon className="size-4 text-brand-600" />
                        <span className="text-[13px] font-bold tracking-wide">
                          Recorded Voice
                        </span>
                      </div>
                      <span className="text-[12px] font-medium text-muted">
                        {voiceDraft.length} chars
                      </span>
                    </div>

                    {/* Editable / viewable transcript */}
                    <div className="mt-2">
                      <textarea
                        value={voiceDraft}
                        onChange={(e) => setVoiceDraft(e.target.value)}
                        rows={2}
                        placeholder="Transcribed text..."
                        className="w-full rounded-lg border border-brand-200 bg-white p-2.5 text-[14px] leading-relaxed text-navy-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                      />
                    </div>

                    {/* Action buttons: Delete or Apply */}
                    <div className="mt-2.5 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleDiscardVoice}
                        title="Delete transcript"
                        aria-label="Delete transcript"
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-600 shadow-xs transition hover:bg-rose-50 active:scale-95"
                      >
                        <TrashIcon className="size-3.5" />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyVoice}
                        title="Apply text to section"
                        aria-label="Apply text to section"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95"
                      >
                        <CheckIcon className="size-3.5" />
                        <span>Apply</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* --- 3. IDLE BOTTOM ACTION BAR --- */}
                {!speech.listening && !voiceDraft.trim() && (
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2 text-[13px] text-muted">
                      <span className={activeSection.content.length >= charLimit ? 'font-semibold text-amber-600' : ''}>
                        {activeSection.content.length}/{charLimit} chars
                      </span>
                    </div>

                    {speech.supported ? (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        aria-label="Click to start voice recording"
                        title="Click to start voice recording"
                        className="grid size-9 place-items-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600 active:scale-95 shadow-xs"
                      >
                        <MicIcon className="size-4.5" />
                      </button>
                    ) : (
                      <span title="Voice dictation not supported in this browser" className="text-muted text-[13px] opacity-60 flex items-center gap-1.5">
                        <MicIcon className="size-4" />
                        <span>Voice not supported</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {(speech.error || mic.error || notice) && (
                <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                  {speech.error || mic.error || notice}
                </p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleExpand}
                  disabled={generating || !activeSection.content.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-[15px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
                >
                  <SparkleIcon className="size-5" />
                  {generating ? 'Working…' : 'Expand to fit'}
                </button>
                <button
                  type="button"
                  onClick={handleHeadline}
                  disabled={generating || !activeSection.content.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-500 py-3.5 text-[15px] font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-50"
                >
                  <SparkleIcon className="size-5" />
                  Write headline
                </button>
              </div>

              <button
                type="button"
                onClick={toggleComplete}
                className={[
                  'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold transition',
                  activeSection.status === 'completed'
                    ? 'border border-line bg-white text-ink hover:bg-navy-50'
                    : 'bg-navy-900 text-white hover:bg-navy-700',
                ].join(' ')}
              >
                <CheckIcon className="size-5" />
                {activeSection.status === 'completed' ? 'Reopen as draft' : 'Mark section complete'}
              </button>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

function SaveIndicator({ state }) {
  const LABELS = {
    saving: 'Saving…',
    saved: 'All changes saved',
    error: 'Save failed',
    idle: '',
  }
  if (!LABELS[state]) return null
  return (
    <span
      aria-live="polite"
      className={[
        'text-[14px]',
        state === 'error' ? 'text-red-600' : state === 'saved' ? 'text-emerald-600' : 'text-muted',
      ].join(' ')}
    >
      {LABELS[state]}
    </span>
  )
}
