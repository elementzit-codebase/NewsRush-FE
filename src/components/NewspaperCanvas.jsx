import { memo, useEffect, useRef } from 'react'
import { CheckIcon, PencilIcon } from './Icons'
import { measureCapacity } from '../lib/capacity'

const MIN_HEIGHT = {
  lead: 'min-h-[150px]',
  body: 'min-h-[190px]',
  tall: 'min-h-[190px]',
  small: 'min-h-[150px]',
}

// Shared by the visible copy and the hidden probe, so what gets measured is
// laid out with exactly the type the reader sees.
const LABEL_CLASS = 'mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase'
const TITLE_CLASS = 'font-serif text-[18px] leading-tight text-slate-800'
const BODY_CLASS = 'mt-1.5 text-[13px] leading-relaxed text-slate-600'

const formatEditionDate = (iso) => {
  const date = iso ? new Date(`${iso}T00:00:00`) : new Date()
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * One page of the edition. Each block is a button bound to a real backend
 * section key: clicking it selects that section, so what is typed or dictated
 * in the side panel is saved against a known `section_key`.
 *
 * Blocks also report how many characters their slot holds via `onMeasure`, so
 * the AI is asked for copy sized to the layout as it is actually rendered.
 */
function NewspaperCanvas({
  page,
  sections,
  activeKey,
  onSelectSection,
  onMeasure,
  masthead = 'DAILY NEWS',
  editionDate,
  editionLabel,
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-7 shadow-[0_10px_40px_-30px_rgba(15,32,68,0.5)]">
      <header>
        <div className="flex items-start justify-between gap-4 text-[13px] text-slate-500">
          <span className="border-b border-slate-300 pb-1">{formatEditionDate(editionDate)}</span>
          <span className="border-b border-slate-300 pb-1">
            {editionLabel ? `${editionLabel} Edition` : 'Evening Edition'}
          </span>
        </div>

        <h2 className="mt-3 text-center font-serif text-[clamp(32px,4.4vw,54px)] leading-none tracking-wide text-slate-400">
          {masthead}
        </h2>

        <div className="mt-4 border-y border-slate-300 py-2 text-center text-[11px] tracking-[0.2em] text-slate-500">
          PAGE {page.page_number} — {page.name.toUpperCase()}
        </div>
      </header>

      <div className="mt-5 grid auto-rows-min grid-cols-3 gap-4">
        {page.blocks.map((block) => (
          <Block
            key={block.section_key}
            block={block}
            section={sections[block.section_key]}
            active={activeKey === block.section_key}
            onSelect={onSelectSection}
            onMeasure={onMeasure}
          />
        ))}
      </div>

      <div className="mt-6 space-y-1.5">
        <div className="h-px bg-slate-300" />
        <div className="h-px bg-slate-200" />
      </div>
    </div>
  )
}

function Block({ block, section, active, onSelect, onMeasure }) {
  // A section only counts as filled once it has both a title and a body — the
  // same rule /validate applies on the server.
  const filled = Boolean(section?.title && section?.content)
  const done = filled && section.status === 'completed'

  const blockRef = useRef(null)
  const probeBodyRef = useRef(null)

  // Re-measure whenever the block resizes (window, sidebar, zoom) and whenever
  // the headline changes, since a headline that wraps steals a body line.
  const title = section?.title ?? ''
  useEffect(() => {
    const blockEl = blockRef.current
    if (!blockEl || !onMeasure) return undefined

    const report = () => {
      const capacity = measureCapacity(blockEl, probeBodyRef.current)
      if (capacity) onMeasure(block.section_key, capacity)
    }

    report()
    const observer = new ResizeObserver(report)
    observer.observe(blockEl)
    return () => observer.disconnect()
  }, [block.section_key, onMeasure, title])

  return (
    <button
      ref={blockRef}
      type="button"
      onClick={() => onSelect(block.section_key)}
      aria-pressed={active}
      style={{ gridColumn: `span ${block.span} / span ${block.span}` }}
      className={[
        'relative flex flex-col overflow-hidden rounded-xl border border-dashed p-5 transition',
        MIN_HEIGHT[block.size] ?? MIN_HEIGHT.small,
        filled ? 'items-start justify-start text-left' : 'items-center justify-center text-center',
        active
          ? 'border-brand-500 bg-brand-50/80 ring-2 ring-brand-100'
          : done
            ? 'border-emerald-300 bg-emerald-50/50 hover:border-emerald-500'
            : 'border-brand-100 bg-brand-50/40 hover:border-brand-500 hover:bg-brand-50',
      ].join(' ')}
    >
      {/* Hidden replica of the filled layout. It stays mounted even while the
          block is empty, so an unwritten section can still be measured. */}
      <div aria-hidden="true" className="invisible pointer-events-none absolute inset-0 flex flex-col p-5 text-left">
        <span className={LABEL_CLASS}>
          <PencilIcon className="size-3.5" />
          {block.section_name}
        </span>
        <span className={TITLE_CLASS}>{title || block.section_name}</span>
        <span ref={probeBodyRef} className={BODY_CLASS}>
          &nbsp;
        </span>
      </div>

      <span className={`${LABEL_CLASS} ${done ? 'text-emerald-700' : 'text-brand-600'}`}>
        {done ? <CheckIcon className="size-3.5" /> : <PencilIcon className="size-3.5" />}
        {block.section_name}
      </span>

      {filled ? (
        <>
          <span className={TITLE_CLASS}>{section.title}</span>
          <span className={`${BODY_CLASS} line-clamp-5`}>{section.content}</span>
        </>
      ) : (
        <>
          <span className="text-[15px] font-semibold text-brand-500">Add {block.section_name}</span>
          <span className="mt-1 text-[13px] text-slate-500">Type or record to add content</span>
        </>
      )}
    </button>
  )
}

/**
 * Memoised because the recorder updates its input level while the editor is
 * open. Without this, every level change would re-render all 19 blocks and
 * re-run their measurements, which showed up as visible flicker.
 */
export default memo(NewspaperCanvas)
