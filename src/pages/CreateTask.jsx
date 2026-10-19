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
  PhotoIcon,
  PrinterIcon,
  RefreshCwIcon,
  SparkleIcon,
  StopIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from '../components/Icons'
import { ALL_BLOCKS, PAGES, TOTAL_SECTIONS, blockFor } from '../data/sections'
import * as api from '../lib/api'
import { useSpeechRecognition } from '../lib/useSpeechRecognition'
import { useMicLevel } from '../lib/useMicLevel'
import {
  effectiveCapacityFor,
  generationTargetFor,
  MIN_FILL_RATIO,
  printCapacityFor,
  truncateAtSentenceBoundary,
} from '../lib/capacity'
import { cleanSectionContent, cleanSectionTitle } from '../lib/contentSanitizer'
import { buildPage, buildPages, templatesForPage } from '../data/templates'
import { readTemplates, writeTemplate } from '../lib/templateStore'

const AUTOSAVE_MS = 2000

/** Builds the local map the editor edits, seeded from whatever the server has. */
function toSectionMap(saved = []) {
  const map = {}
  for (const section of saved) {
    const hasImg = Boolean(section.image_url)
    map[section.section_key] = {
      title: cleanSectionTitle(section.title, section.content),
      content: cleanSectionContent(section.content ?? ''),
      status: section.status ?? 'draft',
      // The label is stored per section on the server (SectionBase.section_name),
      // so a rename survives a reload. Empty means "use the canonical name".
      section_name: section.section_name ?? '',
      image_url: section.image_url ?? '',
      image_caption: section.image_caption ?? '',
      photoMode: hasImg
        ? (section.image_url.startsWith('/uploads/') || section.image_url.startsWith('data:') || section.image_url.startsWith('blob:') ? 'upload' : 'ai')
        : 'none',
    }
  }
  return map
}

const emptySection = {
  title: '',
  content: '',
  status: 'draft',
  section_name: '',
  image_url: '',
  image_caption: '',
  photoMode: 'none',
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Spacing between bulk AI calls, to stay clear of upstream rate limits. */
const FILL_PACING_MS = 800
const FILL_EXPANSION_PASSES = 2

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
  const [fontMetricsReady, setFontMetricsReady] = useState(
    () => typeof document === 'undefined' || !document.fonts,
  )
  const editionLanguage = (edition?.language || 'malayalam').toLowerCase()
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

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts || fontMetricsReady) return undefined
    let active = true

    const preparePrintFonts = async () => {
      await document.fonts.ready
      const fontSamples = [
        ['8.5pt Inter', 'The quick brown fox jumps over the lazy dog.'],
        ['22pt "Playfair Display"', 'The quick brown fox jumps over the lazy dog.'],
        ['8.8pt "Anek Malayalam"', '\u0D15\u0D47\u0D30\u0D33\u0D24\u0D4D\u0D24\u0D3F\u0D32\u0D46'],
        ['20pt "Noto Serif Malayalam"', '\u0D15\u0D47\u0D30\u0D33\u0D24\u0D4D\u0D24\u0D3F\u0D32\u0D46'],
      ]
      await Promise.all(
        fontSamples.map(([font, sample]) => document.fonts.load(font, sample).catch(() => [])),
      )
      await document.fonts.ready
      if (active) setFontMetricsReady(true)
    }

    preparePrintFonts()
    return () => {
      active = false
    }
  }, [fontMetricsReady])

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
  const activeTitle = cleanSectionTitle(activeSection.title, activeSection.content)

  // How much text this section's box holds on the printed sheet.
  // When an optional photo is active, capacity is proportionally reduced
  // based on the column and vertical space occupied so the story never overflows.
  const isFirstSection = page?.blocks[0]?.section_key === activeKey
  const hasActivePhoto = Boolean(
    (activeSection.photoMode && activeSection.photoMode !== 'none') || activeSection.image_url
  )
  const baseCharLimit = printCapacityFor(activeKey, pages, editionLanguage, activeTitle) ?? block.charLimit
  const charLimit = effectiveCapacityFor({
    sectionKey: activeKey,
    pages,
    language: editionLanguage,
    hasPhoto: hasActivePhoto,
    isFirstSection,
    photoCaption: activeSection.image_caption,
    sectionTitle: activeTitle,
  })

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
          image_url: draft.photoMode === 'none' ? null : (draft.image_url || null),
          image_caption: draft.photoMode === 'none' ? null : (draft.image_caption || null),
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
  const lastPhraseRef = useRef('')

  const handleSpeechResult = useCallback((phrase) => {
    const trimmed = phrase?.trim()
    if (!trimmed) return

    setVoiceDraft((prev) => {
      if (!prev) {
        lastPhraseRef.current = trimmed
        return trimmed
      }
      const prevTrimmed = prev.trim()
      // Guard against identical phrase duplicates (e.g., from overlapping stop + isFinal events)
      if (
        prevTrimmed === trimmed ||
        prevTrimmed.endsWith(trimmed) ||
        lastPhraseRef.current === trimmed
      ) {
        return prev
      }
      lastPhraseRef.current = trimmed
      return `${prev} ${trimmed}`
    })
  }, [])

  const speechLang = editionLanguage === 'malayalam' ? 'ml-IN' : 'en-US'
  const speech = useSpeechRecognition({ lang: speechLang, onResult: handleSpeechResult })

  // Runs alongside recognition purely to show that audio is arriving.
  const mic = useMicLevel(speech.listening)

  function handleStartRecording() {
    if (speech.listening) return
    setVoiceDraft('')
    lastPhraseRef.current = ''
    setNotice('')
    speech.start()
  }

  function handleStopRecording() {
    // Simply stopping lets the native speech recognition engine trigger its final result
    // without manually double-appending interim text.
    speech.stop()
  }

  function handleDiscardVoice() {
    if (speech.listening) {
      speech.stop()
    }
    lastPhraseRef.current = ''
    setVoiceDraft('')
  }

  function handleApplyVoice() {
    if (!voiceDraft.trim()) return
    setNotice('')
    const current = sections[activeKey]?.content ?? ''
    const rawMerged = current ? current + ' ' + voiceDraft.trim() : voiceDraft.trim()
    const merged = truncateAtSentenceBoundary(
      rawMerged,
      charLimit,
      editionLanguage,
    )
    if (!merged && rawMerged.length > charLimit) {
      setNotice('No complete sentence fits this section. Shorten the copy or remove the photo.')
      return
    }
    editSection(activeKey, { content: merged })
    if (merged.length < rawMerged.length) setNotice('Voice text was limited at a complete sentence to fit the print capacity.')
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
      const isAiPhoto = activeSection.photoMode === 'ai'
      const result = await api.expandContent({
        summary: activeSection.content,
        characterLimit: generationTargetFor(charLimit),
        language: editionLanguage,
        includePhoto: isAiPhoto,
      })
      const expandedContent = truncateAtSentenceBoundary(
        cleanSectionContent(result.expanded_content),
        charLimit,
        editionLanguage,
      )
      if (!expandedContent) {
        setNotice('The generated copy has no complete sentence within this section’s print capacity.')
        return
      }
      if (expandedContent.length < cleanSectionContent(result.expanded_content).length) {
        setNotice('Generated copy was limited at a complete sentence to fit the print capacity.')
      }
      const generatedTitle = cleanSectionTitle(activeSection.title || result.generated_title || '', result.expanded_content)
      const updates = {
        content: expandedContent,
        title: generatedTitle,
      }
      if (isAiPhoto && result.image_url) {
        updates.image_url = result.image_url
        if (result.image_caption) updates.image_caption = result.image_caption
      }
      editSection(activeKey, updates)
    } catch (err) {
      setNotice(err.message)
    } finally {
      setGenerating(false)
    }
  }

  /* ------------------------------------------------------- bulk page fill */

  const underFilled = useMemo(
    () => {
      if (!fontMetricsReady) return []
      return ALL_BLOCKS.filter((candidate) => {
        const section = sections[candidate.section_key]
        const contentLength = cleanSectionContent(section?.content ?? '').length
        if (!contentLength) return false
        const hasPhoto = Boolean(
          (section.photoMode && section.photoMode !== 'none') || section.image_url
        )
        const isFirst =
          pages.find((p) => p.page_number === candidate.page_number)?.blocks[0]?.section_key ===
          candidate.section_key
        const limit = effectiveCapacityFor({
          sectionKey: candidate.section_key,
          pages,
          language: editionLanguage,
          hasPhoto,
          isFirstSection: isFirst,
          photoCaption: section.image_caption,
          sectionTitle: cleanSectionTitle(section?.title, section?.content),
        })
        return contentLength < limit * MIN_FILL_RATIO
      })
    },
    [editionLanguage, fontMetricsReady, pages, sections],
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
      const hasPhoto = Boolean(
        (current?.photoMode && current?.photoMode !== 'none') || current?.image_url
      )
      const isFirst =
        pages.find((p) => p.page_number === candidate.page_number)?.blocks[0]?.section_key === key
      const limit = effectiveCapacityFor({
        sectionKey: key,
        pages,
        language: editionLanguage,
        hasPhoto,
        isFirstSection: isFirst,
        photoCaption: current?.image_caption,
        sectionTitle: cleanSectionTitle(current?.title, current?.content),
      })

      try {
        // Sequential on purpose: 19 parallel calls invite Groq rate-limiting.
        // The output-token ceiling can leave a section short after one response,
        // so allow one paced follow-up expansion when it is still below target.
        const isAiPhoto = current?.photoMode === 'ai'
        const originalContent = cleanSectionContent(current.content)
        const targetLength = Math.ceil(limit * MIN_FILL_RATIO)
        let bestContent = originalContent
        let firstResult = null
        let photoResult = null
        let wasLimited = false

        for (let attempt = 0; attempt < FILL_EXPANSION_PASSES; attempt += 1) {
          if (bestContent.length >= targetLength) break
          const result = await withRetry(() =>
            api.expandContent({
              summary: bestContent,
              characterLimit: generationTargetFor(limit),
              language: editionLanguage,
              includePhoto: isAiPhoto && attempt === 0,
            }),
          )
          firstResult ??= result
          if (attempt === 0) photoResult = result

          const generatedContent = cleanSectionContent(result.expanded_content)
          const fittedContent = truncateAtSentenceBoundary(generatedContent, limit, editionLanguage)
          if (!fittedContent) {
            if (attempt === 0 && !originalContent) {
              throw new Error('No complete sentence fits this section’s print capacity.')
            }
            break
          }
          if (fittedContent.length <= bestContent.length) break

          bestContent = fittedContent
          wasLimited ||= fittedContent.length < generatedContent.length
          if (bestContent.length < targetLength && attempt < FILL_EXPANSION_PASSES - 1) {
            await wait(FILL_PACING_MS)
          }
        }

        if (wasLimited) {
          setNotice(`${candidate.section_name} was limited at a complete sentence to fit the print capacity.`)
        }
        if (bestContent.length === originalContent.length && !(isAiPhoto && photoResult?.image_url)) {
          throw new Error('The AI did not add enough copy to fill this section.')
        }

        const generatedTitle = cleanSectionTitle(
          current.title || firstResult?.generated_title || '',
          bestContent,
        )
        const updates = {
          content: bestContent,
          title: generatedTitle,
        }
        if (isAiPhoto && photoResult?.image_url) {
          updates.image_url = photoResult.image_url
          if (photoResult.image_caption) updates.image_caption = photoResult.image_caption
        }
        editSection(key, updates)
        if (bestContent.length < targetLength) {
          failedFillRef.current.push(
            `${candidate.section_name} (filled ${Math.floor((bestContent.length / (limit || 1)) * 100)}%)`,
          )
        }
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
      const { headline } = await api.generateHeadline({
        content: activeSection.content,
        language: editionLanguage,
      })
      editSection(activeKey, { title: headline })
    } catch (err) {
      setNotice(err.message)
    } finally {
      setGenerating(false)
    }
  }

  /* ------------------------------------------------------------- photos */

  const fileInputRef = useRef(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  function handleToggleAiPhoto() {
    setNotice('')
    if (activeSection.photoMode === 'ai') {
      // Disabling AI photo: reset photoMode to 'none', clear active photo, restoring full base limit
      editSection(activeKey, {
        photoMode: 'none',
        image_url: '',
        image_caption: '',
      })
    } else {
      // Enabling AI photo: set photoMode to 'ai' to dynamically adjust character limit
      // Backend AI will search and attach an authentic news photo upon clicking 'Expand to fit'
      editSection(activeKey, { photoMode: 'ai' })
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setNotice('')
    setUploadingPhoto(true)
    try {
      const res = await api.uploadArticleImage(file)
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      const caption =
        editionLanguage === 'malayalam' ? `ചിത്രം: ${cleanName}` : `Photo: ${cleanName}`
      editSection(activeKey, {
        photoMode: 'upload',
        image_url: res.image_url || res.url,
        image_caption: caption,
      })
    } catch (err) {
      setNotice(`Upload failed: ${err.message}`)
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleRemovePhoto() {
    editSection(activeKey, {
      photoMode: 'none',
      image_url: '',
      image_caption: '',
    })
  }

  const pageAiPhotosActive = useMemo(() => {
    return page?.blocks?.some((b) => sections[b.section_key]?.photoMode === 'ai') ?? false
  }, [page, sections])

  function handleTogglePageAiPhotos() {
    setNotice('')
    const turningOn = !pageAiPhotosActive

    for (const b of page.blocks) {
      const sec = sections[b.section_key]
      if (turningOn) {
        // Enable AI photos across current page sections, PRESERVING any manually uploaded photos
        if (sec?.photoMode !== 'upload') {
          editSection(b.section_key, { photoMode: 'ai' })
        }
      } else {
        // Disable AI photos across current page sections, PRESERVING any manually uploaded photos
        if (sec?.photoMode === 'ai') {
          editSection(b.section_key, {
            photoMode: 'none',
            image_url: '',
            image_caption: '',
          })
        }
      }
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
      <div className="flex min-h-screen flex-col md:flex-row bg-white">
        <Sidebar variant="panel" />
        <p className="m-auto text-muted">Loading edition…</p>
      </div>
    )
  }

  if (error && !edition) {
    return (
      <div className="flex min-h-screen flex-col md:flex-row bg-white">
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
    <div className="flex h-screen flex-col md:flex-row overflow-hidden bg-white">
      <Sidebar variant="panel" />

      {/* Page picker */}
      <aside className="hidden w-[275px] shrink-0 flex-col border-r border-line bg-canvas px-3.5 py-5 xl:flex">
        <div className="pl-3.5 pr-1">
          <h2 className="text-[19px] font-bold text-navy-900 leading-tight">Pages &amp; Templates</h2>
          <p className="mt-1 text-[13px] text-muted">
            {completedCount} of {TOTAL_SECTIONS} sections completed.
          </p>
        </div>

        <ul className="scroll-subtle mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
          {pages.map((item, index) => {
            const selected = index === pageIndex
            const done = item.blocks.filter((b) => completedKeys.has(b.section_key)).length
            const variants = templatesForPage(item.page_number)
            return (
              <li
                key={item.page_number}
                className={[
                  'rounded-xl border bg-white transition shadow-2xs',
                  selected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line hover:border-slate-300',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => selectPage(index)}
                  aria-pressed={selected}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <TemplateThumb
                    blocks={item.blocks}
                    completedKeys={completedKeys}
                    className="w-[46px] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate text-[14px] font-bold text-navy-900">
                        Page {item.page_number}
                      </span>
                      {done === item.blocks.length ? (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-2xs">
                          <CheckIcon className="size-3" />
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-muted">
                          {done}/{item.blocks.length}
                        </span>
                      )}
                    </div>
                    <span className="block truncate text-[12px] font-medium text-slate-600">
                      {item.name}
                    </span>
                    <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {item.templateName}
                    </span>
                  </div>
                </button>

                {/* Templates rearrange the sections a page already owns, so
                    switching never changes what has been written. */}
                {selected && (
                  <div className="border-t border-line/80 bg-slate-50/50 p-2.5 rounded-b-xl">
                    <p className="px-0.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
                      Change template
                    </p>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5">
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
                              'flex flex-col items-center rounded-lg border p-1.5 text-center transition',
                              current
                                ? 'border-brand-500 bg-white shadow-2xs'
                                : 'border-line bg-white/70 hover:border-brand-200 hover:bg-white',
                            ].join(' ')}
                          >
                            <TemplateThumb
                              blocks={buildPage(item.page_number, variant.key).blocks}
                              completedKeys={completedKeys}
                              className="w-full max-w-[42px]"
                            />
                            <span
                              className={[
                                'mt-1 block truncate text-[11px] font-medium',
                                current ? 'font-semibold text-brand-600' : 'text-slate-600',
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
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-6">
          <nav aria-label="Breadcrumb" className="text-[14px] text-muted">
            <Link to="/" className="hover:text-ink">
              Workspace
            </Link>
            <span className="px-2 text-slate-300">/</span>
            <span className="font-medium text-brand-500">{edition?.newspaper_name}</span>
            <span className="px-2 text-slate-300">/</span>
            <span className="text-ink">Page {page.page_number}</span>
          </nav>

          <div className="flex items-center gap-3">
            <SaveIndicator state={saveState} />

            {/* Page-level AI Photo Toggle */}
            <button
              type="button"
              onClick={handleTogglePageAiPhotos}
              title={
                pageAiPhotosActive
                  ? `Disable AI photos across Page ${page.page_number}`
                  : `Enable AI photos across Page ${page.page_number}`
              }
              className={[
                'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[14px] font-semibold transition shadow-2xs',
                pageAiPhotosActive
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-line bg-white text-slate-700 hover:border-slate-300 hover:text-ink',
              ].join(' ')}
            >
              <SparkleIcon className="size-4 text-brand-500" />
              <span>Page AI Photos</span>
              <span
                className={[
                  'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                  pageAiPhotosActive ? 'bg-brand-500' : 'bg-slate-300',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block size-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                    pageAiPhotosActive ? 'translate-x-3' : 'translate-x-0',
                  ].join(' ')}
                />
              </span>
            </button>

            {/* Existing copy was written against the old undersized limits, so
                a bulk pass avoids running "Expand to fit" nineteen times. */}
            {(underFilled.length > 0 || fill.running) && (
              <button
                type="button"
                onClick={handleFillAll}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-500 px-4 py-2.5 text-[14px] font-semibold text-brand-600 transition hover:bg-brand-50"
              >
                <SparkleIcon className="size-4.5" />
                {fill.running
                  ? `Filling ${fill.done + 1} of ${fill.total} — click to stop`
                  : `Fill ${underFilled.length} thin section${underFilled.length === 1 ? '' : 's'}`}
              </button>
            )}

            <button
              type="button"
              onClick={() => refreshValidation(true)}
              className="inline-flex items-center gap-2.5 rounded-xl bg-navy-900 px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-navy-700"
            >
              Check readiness
              <ArrowRightIcon className="size-4.5" />
            </button>
          </div>
        </header>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col px-5 pb-5 lg:px-6">
          <h1 className="shrink-0 text-[clamp(26px,2.6vw,36px)] font-bold text-navy-900">
            {edition?.newspaper_name}
          </h1>
          <div className="shrink-0 mt-2 flex flex-wrap items-center gap-2 text-[17px] text-muted">
            <span>
              {edition?.edition_label} edition · {edition?.date} · {completedCount}/{TOTAL_SECTIONS}{' '}
              sections completed
            </span>
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-semibold capitalize text-brand-600 border border-brand-100">
              {editionLanguage}
            </span>
          </div>

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

          <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:gap-3 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
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
                language={editionLanguage}
              />
            </div>

            {/* Section editor */}
            <section className="scroll-thin min-h-0 overflow-y-auto rounded-2xl border border-line bg-brand-50/40 p-4.5 sm:p-5">
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
                    Page {block.page_number} · about {charLimit} characters for the fixed-size PDF
                    {hasActivePhoto ? ' (photo capacity)' : ''}
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

              {/* Optional Section Photo Module */}
              <div className="mt-4 rounded-2xl border border-line bg-white p-3.5 sm:p-4 shadow-xs transition">
                {/* Header: Title + Status Pill */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <PhotoIcon className="size-4" />
                    </div>
                    <span className="text-[13px] font-bold text-navy-900 truncate">
                      Section Photo
                    </span>
                  </div>
                  {hasActivePhoto ? (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 border border-brand-100">
                      {activeSection.photoMode === 'upload' ? 'Uploaded' : 'AI Active'}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                      Optional
                    </span>
                  )}
                </div>

                {/* Two Action Buttons: AI Photo Toggle & Upload Photo */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {/* AI Photo Toggle Card */}
                  <div
                    onClick={handleToggleAiPhoto}
                    className={[
                      'flex items-center justify-between rounded-xl border px-2.5 py-2 cursor-pointer transition select-none',
                      activeSection.photoMode === 'ai'
                        ? 'border-brand-300 bg-brand-50/80 shadow-2xs'
                        : 'border-line bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300',
                    ].join(' ')}
                    title="Toggle AI Google/News Photo search for this section"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <SparkleIcon className="size-3.5 text-brand-500 shrink-0" />
                      <span className="text-[12px] font-semibold text-slate-800 truncate">
                        AI Photo
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activeSection.photoMode === 'ai'}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleAiPhoto()
                      }}
                      className={[
                        'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                        activeSection.photoMode === 'ai' ? 'bg-brand-500' : 'bg-slate-300',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'pointer-events-none inline-block size-3 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out',
                          activeSection.photoMode === 'ai' ? 'translate-x-3' : 'translate-x-0',
                        ].join(' ')}
                      />
                    </button>
                  </div>

                  {/* Upload Photo Button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    title="Upload photo from your device"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-slate-50/60 px-2.5 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-ink hover:border-slate-300 active:scale-95 disabled:opacity-60"
                  >
                    {uploadingPhoto ? (
                      <RefreshCwIcon className="size-3.5 animate-spin text-slate-500 shrink-0" />
                    ) : (
                      <UploadIcon className="size-3.5 text-slate-500 shrink-0" />
                    )}
                    <span>{uploadingPhoto ? 'Uploading…' : 'Upload'}</span>
                  </button>
                </div>

                {/* Helper notice when AI photo is enabled but no image is generated yet */}
                {activeSection.photoMode === 'ai' && !activeSection.image_url && (
                  <div className="mt-3 rounded-xl bg-brand-50/70 border border-brand-100 p-2.5 text-[11px] text-brand-900">
                    <div className="flex items-center justify-between font-semibold text-brand-950">
                      <div className="flex items-center gap-1.5">
                        <SparkleIcon className="size-3 text-brand-600" />
                        <span>AI Search Ready</span>
                      </div>
                      <span className="text-[10px] text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded font-bold">
                        -{baseCharLimit - charLimit} chars
                      </span>
                    </div>
                    <p className="mt-1 text-brand-700 leading-normal">
                      Click <strong>Expand to fit</strong> below to search and attach an authentic news photo, or upload your own.
                    </p>
                  </div>
                )}

                {/* Active Photo State: Thumbnail, Caption, Remove */}
                {Boolean(activeSection.image_url) && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center gap-3">
                      {/* Photo Thumbnail */}
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-line bg-slate-100 shadow-2xs flex items-center justify-center text-slate-400">
                        <PhotoIcon className="size-6 text-slate-300" />
                        <img
                          src={activeSection.image_url}
                          alt="Section preview"
                          className="absolute inset-0 size-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        {activeSection.photoMode === 'ai' && (
                          <span className="absolute bottom-0 inset-x-0 bg-brand-600/90 text-[8px] font-bold text-white text-center py-0.5 tracking-wider uppercase">
                            AI
                          </span>
                        )}
                      </div>

                      {/* Caption Input with Remove in Label Row */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                            Caption / Credit
                          </label>
                          <div className="flex items-center gap-2">
                            {activeSection.photoMode === 'ai' && (
                              <button
                                type="button"
                                onClick={handleExpand}
                                disabled={generating || !fontMetricsReady}
                                title="Regenerate photo via AI"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 transition disabled:opacity-50"
                              >
                                <SparkleIcon className="size-3 text-brand-500" />
                                <span>Refetch</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              title="Remove photo and restore character capacity"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 transition"
                            >
                              <TrashIcon className="size-3" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                        <input
                          value={activeSection.image_caption || ''}
                          onChange={(e) =>
                            editSection(activeKey, { image_caption: e.target.value })
                          }
                          placeholder="e.g., Photo: Staff Reporter"
                          className="mt-1 w-full rounded-lg border border-line bg-slate-50/50 px-2.5 py-1.5 text-[13px] text-ink outline-none transition focus:border-brand-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Live Capacity Indicator */}
                    <div className="flex items-center justify-between rounded-lg bg-brand-50/70 px-2.5 py-1.5 text-[11px] text-brand-900 border border-brand-100/60">
                      <span className="font-semibold text-brand-950">
                        Capacity: {charLimit} chars
                      </span>
                      <span className="font-medium text-brand-700">
                        -{baseCharLimit - charLimit} chars for layout
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Unified Body Text & Voice Dictation Input */}
              <div className="mt-5 rounded-2xl border border-line bg-white p-4 transition-all focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 shadow-xs">
                {/* Textarea for typing */}
                <textarea
                  value={activeSection.content}
                  onChange={(e) =>
                    editSection(activeKey, { content: e.target.value })
                  }
                  onBlur={(e) => {
                    if (e.target.value.length <= charLimit) return
                    const fitted = truncateAtSentenceBoundary(e.target.value, charLimit, editionLanguage)
                    if (fitted) {
                      editSection(activeKey, { content: fitted })
                      setNotice('Text was limited at a complete sentence to fit the print capacity.')
                    }
                    else setNotice('No complete sentence fits this section. Shorten the copy or remove the photo.')
                  }}
                  placeholder="Type section body, or record voice below..."
                  rows={8}
                  aria-label={'Body text for ' + activeName}
                  className="scroll-subtle h-[200px] w-full resize-none overflow-y-auto bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-slate-400"
                />
                {activeSection.content.length > charLimit && (
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                    This copy exceeds the estimated print capacity. On leaving the field, trailing
                    text is kept only through a complete sentence; the PDF checks the actual layout.
                  </p>
                )}

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
                  disabled={generating || !fontMetricsReady || !activeSection.content.trim()}
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
