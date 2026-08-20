import { memo, useEffect, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon, PencilIcon } from './Icons'

// Floors, so an empty block still holds the page's proportions.
const MIN_HEIGHT = {
  lead: 'min-h-[150px]',
  body: 'min-h-[190px]',
  tall: 'min-h-[190px]',
  small: 'min-h-[150px]',
}

// How tall a block's body may get before it scrolls inside itself. Letting
// blocks grow to their full copy made the page enormous, so long sections
// scroll in place and can be opened out with "View more" when wanted.
const COLLAPSED_BODY = {
  lead: 'max-h-[170px]',
  body: 'max-h-[200px]',
  tall: 'max-h-[200px]',
  small: 'max-h-[140px]',
}

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
 * One page of the edition. Each block is bound to a real backend section key:
 * clicking it selects that section, so what is typed or dictated in the side
 * panel is saved against a known `section_key`.
 */
function NewspaperCanvas({
  page,
  sections,
  activeKey,
  onSelectSection,
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

function Block({ block, section, active, onSelect }) {
  // A section only counts as filled once it has both a title and a body — the
  // same rule /validate applies on the server.
  const filled = Boolean(section?.title && section?.content)
  const done = filled && section.status === 'completed'

  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const bodyRef = useRef(null)

  const content = section?.content ?? ''

  // "View more" should only appear when there is actually more to see, which
  // depends on the rendered height — so it is measured rather than guessed from
  // the character count, and re-measured when the column is resized.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return undefined

    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 2)
    check()

    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [content, expanded])

  const select = () => onSelect(block.section_key)

  return (
    // A div rather than a button: the "View more" control below is itself a
    // button, and buttons cannot legally nest.
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={select}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          select()
        }
      }}
      style={{ gridColumn: `span ${block.span} / span ${block.span}` }}
      className={[
        'flex cursor-pointer flex-col rounded-xl border border-dashed p-5 transition',
        MIN_HEIGHT[block.size] ?? MIN_HEIGHT.small,
        filled ? 'items-start justify-start text-left' : 'items-center justify-center text-center',
        active
          ? 'border-brand-500 bg-brand-50/80 ring-2 ring-brand-100'
          : done
            ? 'border-emerald-300 bg-emerald-50/50 hover:border-emerald-500'
            : 'border-brand-100 bg-brand-50/40 hover:border-brand-500 hover:bg-brand-50',
      ].join(' ')}
    >
      <span className={`${LABEL_CLASS} ${done ? 'text-emerald-700' : 'text-brand-600'}`}>
        {done ? <CheckIcon className="size-3.5" /> : <PencilIcon className="size-3.5" />}
        {block.section_name}
      </span>

      {filled ? (
        <>
          <span className={TITLE_CLASS}>{section.title}</span>

          <div
            ref={bodyRef}
            className={[
              BODY_CLASS,
              'scroll-thin w-full overflow-y-auto whitespace-pre-wrap',
              expanded ? '' : (COLLAPSED_BODY[block.size] ?? COLLAPSED_BODY.small),
            ].join(' ')}
          >
            {content}
          </div>

          {(overflowing || expanded) && (
            <button
              type="button"
              onClick={(event) => {
                // Without this the click would also re-select the section.
                event.stopPropagation()
                setExpanded((value) => !value)
              }}
              aria-expanded={expanded}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-600 transition hover:text-brand-500"
            >
              {expanded ? 'View less' : 'View more'}
              <ChevronDownIcon
                className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </>
      ) : (
        <>
          <span className="text-[15px] font-semibold text-brand-500">Add {block.section_name}</span>
          <span className="mt-1 text-[13px] text-slate-500">Type or record to add content</span>
        </>
      )}
    </div>
  )
}

/**
 * Memoised because the recorder updates its input level while the editor is
 * open. Without this, every level change would re-render all 19 blocks, which
 * showed up as visible flicker.
 */
export default memo(NewspaperCanvas)
