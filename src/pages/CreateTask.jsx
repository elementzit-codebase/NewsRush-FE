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
  SparkleIcon,
} from '../components/Icons'
import { ALL_BLOCKS, PAGES, TOTAL_SECTIONS, blockFor } from '../data/sections'
import * as api from '../lib/api'
import { useSpeechRecognition } from '../lib/useSpeechRecognition'
import { useMicLevel } from '../lib/useMicLevel'

const AUTOSAVE_MS = 2000

/** Builds the local map the editor edits, seeded from whatever the server has. */
function toSectionMap(saved = []) {
  const map = {}
  for (const section of saved) {
    map[section.section_key] = {
      title: section.title ?? '',
      content: section.content ?? '',
      status: section.status ?? 'draft',
    }
  }
  return map
}

const emptySection = { title: '', content: '', status: 'draft' }

export default function CreateTask() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editionId = searchParams.get('edition')

  const [edition, setEdition] = useState(null)
  const [sections, setSections] = useState({})
  const [pageIndex, setPageIndex] = useState(0)
  const [activeKey, setActiveKey] = useState(PAGES[0].blocks[0].section_key)
  const [tab, setTab] = useState('text')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [generating, setGenerating] = useState(false)
  const [validation, setValidation] = useState(null)

  const page = PAGES[pageIndex]
  const block = useMemo(() => blockFor(activeKey) ?? ALL_BLOCKS[0], [activeKey])
  const activeSection = sections[activeKey] ?? emptySection

  // Character capacity measured from the rendered canvas blocks. The static
  // value in sections.js is only a fallback for the first frame, before the
  // canvas has laid out and reported real numbers.
  const [capacities, setCapacities] = useState({})
  const reportCapacity = useCallback((sectionKey, capacity) => {
    setCapacities((current) =>
      current[sectionKey] === capacity ? current : { ...current, [sectionKey]: capacity },
    )
  }, [])

  const charLimit = capacities[activeKey] ?? block.charLimit
  const measured = capacities[activeKey] != null

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
          section_name: target.section_name,
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

  // Wrapped so the memoised canvas keeps a stable prop and does not re-render
  // every time the recorder reports a new level.
  const selectSection = useCallback(
    (sectionKey) => {
      clearTimeout(timerRef.current)
      flush(activeKey)
      setActiveKey(sectionKey)
      setNotice('')
    },
    [flush, activeKey],
  )

  function selectPage(index) {
    clearTimeout(timerRef.current)
    flush(activeKey)
    setPageIndex(index)
    setActiveKey(PAGES[index].blocks[0].section_key)
    setNotice('')
  }

  /* -------------------------------------------------------------- speech */

  const appendPhrase = useCallback(
    (phrase) => {
      const current = sections[activeKey]?.content ?? ''
      const merged = (current ? current + ' ' + phrase : phrase).slice(0, charLimit)
      editSection(activeKey, { content: merged })
    },
    [activeKey, charLimit, editSection, sections],
  )

  // The hook holds `onResult` in a ref, so passing a fresh closure each render
  // picks up the current section without restarting recognition.
  const speech = useSpeechRecognition({ onResult: appendPhrase })

  // Runs alongside recognition purely to show that audio is arriving.
  const mic = useMicLevel(speech.listening)

  /* Press-and-hold recording. Tracked in a ref rather than state because the
     release handlers must see the current value synchronously, and a stray
     release (pointercancel, blur, key-up without key-down) must be ignored
     rather than stopping a recording it never started. */
  const holdingRef = useRef(false)

  function startRecording() {
    if (holdingRef.current || speech.listening) return
    holdingRef.current = true
    speech.start()
  }

  function stopRecording() {
    if (!holdingRef.current) return
    holdingRef.current = false
    speech.stop()
  }

  function handlePointerDown(event) {
    // Capturing the pointer means the release still arrives even if the finger
    // slides off the button, which would otherwise strand the mic open.
    event.currentTarget.setPointerCapture?.(event.pointerId)
    startRecording()
  }

  function handlePointerUp(event) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    stopRecording()
  }

  function handleKeyDown(event) {
    if (event.key !== ' ' && event.key !== 'Enter') return
    // Holding a key auto-repeats keydown; only the first should start.
    event.preventDefault()
    if (event.repeat) return
    startRecording()
  }

  function handleKeyUp(event) {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    stopRecording()
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
    await refreshValidation()
  }

  const refreshValidation = useCallback(async () => {
    if (!editionId) return
    try {
      const result = await api.validateEdition(editionId)
      setValidation(result)
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
    <div className="flex min-h-screen bg-white">
      <Sidebar variant="panel" />

      {/* Page picker */}
      <aside className="hidden w-[300px] shrink-0 flex-col border-r border-line bg-canvas px-5 py-8 xl:flex">
        <h2 className="text-[22px] font-bold text-navy-900">Pages</h2>
        <p className="mt-1 text-[15px] text-muted">
          {completedCount} of {TOTAL_SECTIONS} sections completed.
        </p>

        <ul className="scroll-thin mt-6 flex-1 space-y-3 overflow-y-auto pr-1">
          {PAGES.map((item, index) => {
            const selected = index === pageIndex
            const done = item.blocks.filter((b) => completedKeys.has(b.section_key)).length
            return (
              <li key={item.page_number}>
                <button
                  type="button"
                  onClick={() => selectPage(index)}
                  aria-pressed={selected}
                  className={[
                    'flex w-full items-start gap-3.5 rounded-2xl border p-3.5 text-left transition',
                    selected
                      ? 'border-brand-500 bg-white ring-2 ring-brand-100'
                      : 'border-line bg-white hover:border-brand-100',
                  ].join(' ')}
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
                    <span className="mt-1 block text-[13px] leading-relaxed text-muted">
                      {done} of {item.blocks.length} sections done
                    </span>
                  </span>
                  {done === item.blocks.length && (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                      <CheckIcon className="size-4" />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
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
            <button
              type="button"
              onClick={refreshValidation}
              className="inline-flex items-center gap-3 rounded-xl bg-navy-900 px-6 py-3.5 text-[16px] font-semibold text-white transition hover:bg-navy-700"
            >
              Check readiness
              <ArrowRightIcon className="size-5" />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-8 pb-12">
          <h1 className="text-[clamp(26px,2.6vw,36px)] font-bold text-navy-900">
            {edition?.newspaper_name}
          </h1>
          <p className="mt-2 text-[17px] text-muted">
            {edition?.edition_label} edition · {edition?.date} · {completedCount}/{TOTAL_SECTIONS}{' '}
            sections completed
          </p>

          {validation && (
            <div
              className={[
                'mt-5 rounded-xl border px-5 py-4 text-[15px]',
                validation.all_completed
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800',
              ].join(' ')}
            >
              {validation.all_completed ? (
                <p>All 19 sections are complete — this edition is ready to print.</p>
              ) : (
                <>
                  <p className="font-semibold">
                    {validation.incomplete_sections.length} section
                    {validation.incomplete_sections.length === 1 ? '' : 's'} still incomplete:
                  </p>
                  <p className="mt-1">
                    {validation.incomplete_sections
                      .map((s) => 'p' + s.page_number + ' ' + s.section_name)
                      .join(', ')}
                  </p>
                </>
              )}
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
          <div className="mt-6 flex gap-2 xl:hidden" role="group" aria-label="Select page">
            {PAGES.map((item, index) => (
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

          <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <NewspaperCanvas
              page={page}
              sections={sections}
              activeKey={activeKey}
              onSelectSection={selectSection}
              onMeasure={reportCapacity}
              masthead={edition?.newspaper_name}
              editionDate={edition?.date}
              editionLabel={edition?.edition_label}
            />

            {/* Section editor */}
            <section className="h-fit rounded-2xl border border-line bg-brand-50/40 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[19px] font-bold text-navy-900">{block.section_name}</h2>
                  <p className="mt-1 text-[13px] text-muted">
                    Page {block.page_number} ·{' '}
                    {measured
                      ? `${charLimit} characters fit this box`
                      : `up to ${charLimit} characters`}
                  </p>
                </div>
                {activeSection.status === 'completed' && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
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

              <div className="mt-5 flex border-b border-line" role="tablist">
                <Tab active={tab === 'text'} onClick={() => setTab('text')} icon={PencilIcon}>
                  Type Text
                </Tab>
                <Tab active={tab === 'voice'} onClick={() => setTab('voice')} icon={MicIcon}>
                  Record Voice
                </Tab>
              </div>

              <div className="mt-3 rounded-xl border border-line bg-white p-4">
                {/* The textarea holds only saved text. An in-progress phrase is
                    shown beneath it instead of inside the value, so typing
                    mid-phrase cannot bake the interim text into the content and
                    duplicate it when the final result lands. */}
                <textarea
                  value={activeSection.content}
                  onChange={(e) =>
                    editSection(activeKey, { content: e.target.value.slice(0, charLimit) })
                  }
                  placeholder="Type the section body, or dictate it..."
                  rows={11}
                  aria-label={'Body text for ' + block.section_name}
                  className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-slate-400"
                />
                {speech.interim && (
                  <p className="text-[15px] leading-relaxed text-slate-400 italic">
                    {speech.interim}
                  </p>
                )}
                <p className="text-right text-[13px] text-muted">
                  {activeSection.content.length}/{charLimit}
                </p>
              </div>

              {tab === 'voice' &&
                (speech.supported ? (
                  <>
                    <div className="mt-4 flex items-center gap-4 rounded-xl border border-line bg-white px-4 py-3">
                      <button
                        type="button"
                        onPointerDown={handlePointerDown}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        // Space and Enter fire as press-and-hold too, so the
                        // control is usable without a pointer.
                        onKeyDown={handleKeyDown}
                        onKeyUp={handleKeyUp}
                        // Losing focus mid-hold would otherwise leave the
                        // microphone open with no way to release it.
                        onBlur={stopRecording}
                        aria-label="Hold to record"
                        aria-describedby="hold-to-record-hint"
                        // Stops a long press from selecting text or scrolling
                        // the page on touch devices.
                        className={[
                          'grid size-12 shrink-0 touch-none place-items-center rounded-full text-white transition select-none',
                          speech.listening
                            ? 'scale-110 bg-red-500 ring-4 ring-red-200'
                            : 'bg-brand-500 hover:bg-brand-600',
                        ].join(' ')}
                      >
                        <MicIcon className="size-6" />
                      </button>
                      <Waveform
                        bars={30}
                        animated={speech.listening}
                        level={mic.level}
                        className="flex-1"
                        color={speech.listening ? 'bg-brand-500' : 'bg-slate-300'}
                      />
                      <span className="shrink-0 text-[15px] tabular-nums text-muted">
                        {speech.elapsed}
                      </span>
                    </div>

                    {/* The meter reads the mic directly, so a flat bar while
                        recording means no audio is arriving at all. */}
                    <p id="hold-to-record-hint" className="mt-2 text-[13px] text-muted">
                      {!speech.listening
                        ? 'Hold the microphone to record. Release to stop.'
                        : mic.hasSound
                          ? 'Recording — keep holding. Release when you are done.'
                          : 'No sound detected. Check the microphone is unmuted and selected.'}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                    Voice dictation needs the Web Speech API, which this browser does not provide.
                    Chrome or Edge support it; Firefox does not. Use the Type Text tab instead.
                  </p>
                ))}

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

              <div className="mt-5 flex gap-3 border-t border-line pt-5 text-[14px] leading-relaxed text-muted">
                <InfoIcon className="mt-0.5 size-5 shrink-0" />
                <p>
                  <span className="font-medium text-ink">Tip:</span> Edits save automatically two
                  seconds after you stop typing or dictating. The limit above is measured from this
                  section's box on the page, so "Expand to fit" asks the AI for copy that fills it
                  without overflowing.
                </p>
              </div>
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

function Tab({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        '-mb-px inline-flex flex-1 items-center justify-center gap-2 border-b-2 pb-3 text-[15px] font-medium transition',
        active ? 'border-brand-500 text-brand-600' : 'border-transparent text-muted hover:text-ink',
      ].join(' ')}
    >
      <Icon className="size-5" />
      {children}
    </button>
  )
}
