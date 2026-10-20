import { memo, useEffect, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon, PencilIcon, PhotoIcon } from './Icons'
import { splitLeadStoryText } from '../lib/capacity'
import { cleanSectionContent, cleanSectionTitle } from '../lib/contentSanitizer'

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
const TITLE_CLASS = 'block w-full min-w-0 font-serif text-[18px] leading-tight text-slate-800 break-words [word-break:break-word] [overflow-wrap:anywhere]'
const BODY_CLASS = 'mt-1.5 block w-full min-w-0 text-[13px] leading-relaxed text-slate-600 break-words [word-break:break-word] [overflow-wrap:anywhere]'

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
  language = 'english',
}) {
  const isMalayalam = (language || 'english').toLowerCase() === 'malayalam'

  return (
    <div
      className={`w-full max-w-full overflow-hidden rounded-2xl border border-line bg-white p-3.5 sm:p-6 shadow-[0_10px_40px_-30px_rgba(15,32,68,0.5)] ${
        isMalayalam ? 'edition-malayalam' : 'edition-english'
      }`}
    >
      <header>
        <div className="flex items-start justify-between gap-2 sm:gap-4 text-[11px] sm:text-[13px] text-slate-500">
          <span className="border-b border-slate-300 pb-1">{formatEditionDate(editionDate)}</span>
          <span className="border-b border-slate-300 pb-1">
            {editionLabel ? `${editionLabel} Edition` : 'Evening Edition'}
          </span>
        </div>

        <h2 className="mt-3 text-center font-serif text-[clamp(28px,6vw,54px)] leading-none tracking-wide text-slate-400">
          {masthead}
        </h2>

        <div className="mt-4 border-y border-slate-300 py-1.5 sm:py-2 text-center text-[10px] sm:text-[11px] tracking-[0.2em] text-slate-500">
          PAGE {page.page_number} — {page.name.toUpperCase()}
        </div>
      </header>

      <div className="mt-4 sm:mt-5 grid w-full auto-rows-min grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:gap-4">
        {page.blocks.map((block, idx) => (
          <Block
            key={block.section_key}
            block={block}
            section={sections[block.section_key]}
            active={activeKey === block.section_key}
            onSelect={onSelectSection}
            isFirstSection={idx === 0}
            language={language}
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

function Block({ block, section, active, onSelect, isFirstSection, language = 'english' }) {
  const content = cleanSectionContent(section?.content ?? '')
  const title = cleanSectionTitle(section?.title, section?.content)

  // A section only counts as filled once it has both a title and a body — the
  // same rule /validate applies on the server.
  const filled = Boolean(title && content)
  const done = filled && section.status === 'completed'

  // An active photo is present if an image URL exists and mode is not 'none'
  const hasPhoto = Boolean(section?.image_url && section?.photoMode !== 'none')

  // A per-section rename overrides the canonical label from sections.js.
  const label = section?.section_name?.trim() || block.section_name

  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const bodyRef = useRef(null)

  // Split lead story copy between left columns and underneath the right photo
  const { leftText, rightText } = isFirstSection && hasPhoto
    ? splitLeadStoryText(content, block.span, null, null, language)
    : { leftText: content, rightText: '' }

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
        'flex min-w-0 w-full max-w-full overflow-hidden cursor-pointer flex-col rounded-xl border border-dashed p-3.5 sm:p-4.5 transition',
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
        <span>{label}</span>
        {hasPhoto && (
          <span className="ml-auto inline-flex items-center gap-1 rounded bg-brand-100/70 px-1.5 py-0.2 text-[9px] font-bold tracking-wider text-brand-700 normal-case">
            <PhotoIcon className="size-2.5" />
            Photo
          </span>
        )}
      </span>

      {filled ? (
        <>
          <span className={TITLE_CLASS}>{title}</span>
          {Boolean(section?.content_source) && (
            <span className="mt-1 block text-[11px] font-sans italic text-slate-500">
              {section.content_source}
            </span>
          )}

          {/* --- FIRST NEWS SECTION WITH PHOTO --- */}
          {hasPhoto && isFirstSection && (
            <div className="mt-2.5 w-full">
              {block.span > 1 ? (
                <div className="grid grid-cols-[1fr_minmax(120px,40%)] gap-3 sm:gap-4 items-start">
                  {/* Left column(s) body text */}
                  <div
                    ref={bodyRef}
                    className={[
                      BODY_CLASS,
                      'mt-0 overflow-hidden whitespace-pre-wrap',
                      expanded ? '' : 'max-h-[340px] sm:max-h-[380px]',
                    ].join(' ')}
                    style={
                      overflowing && !expanded
                        ? {
                            WebkitMaskImage:
                              'linear-gradient(to bottom, black 80%, transparent 100%)',
                            maskImage:
                              'linear-gradient(to bottom, black 80%, transparent 100%)',
                          }
                        : undefined
                    }
                  >
                    {leftText}
                  </div>

                  {/* Right side locked photo spanning last columns */}
                  <div className="flex flex-col min-w-0">
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-2xs">
                      <img
                        src={section.image_url}
                        alt=""
                        className="h-28 sm:h-32 w-full object-cover"
                      />
                    </div>
                    {section.image_caption && (
                      <span className="mt-1 block text-[10px] italic text-slate-500 leading-tight">
                        {section.image_caption}
                      </span>
                    )}
                    {rightText && (
                      <div
                        className={[
                          'mt-1.5 text-[13px] leading-relaxed text-slate-600 overflow-hidden whitespace-pre-wrap',
                          expanded ? '' : 'max-h-[190px] sm:max-h-[230px]',
                        ].join(' ')}
                        style={
                          overflowing && !expanded
                            ? {
                                WebkitMaskImage:
                                  'linear-gradient(to bottom, black 80%, transparent 100%)',
                                maskImage:
                                  'linear-gradient(to bottom, black 80%, transparent 100%)',
                              }
                            : undefined
                        }
                      >
                        {rightText}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Span 1 adaptation for first section */
                <div className="flex flex-col w-full">
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-2xs mb-2">
                    <img
                      src={section.image_url}
                      alt=""
                      className="h-24 w-full object-cover"
                    />
                  </div>
                  {section.image_caption && (
                    <span className="mb-1.5 block text-[10px] italic text-slate-500 leading-tight">
                      {section.image_caption}
                    </span>
                  )}
                  <div
                    ref={bodyRef}
                    className={[
                      BODY_CLASS,
                      'overflow-hidden whitespace-pre-wrap',
                      expanded ? '' : (COLLAPSED_BODY[block.size] ?? COLLAPSED_BODY.small),
                    ].join(' ')}
                    style={
                      overflowing && !expanded
                        ? {
                            WebkitMaskImage:
                              'linear-gradient(to bottom, black 80%, transparent 100%)',
                            maskImage:
                              'linear-gradient(to bottom, black 80%, transparent 100%)',
                          }
                        : undefined
                    }
                  >
                    {content}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- ALL OTHER NEWS SECTIONS WITH PHOTO --- */}
          {hasPhoto && !isFirstSection && (
            <div className="mt-2 w-full">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-2xs mb-1.5">
                <img
                  src={section.image_url}
                  alt=""
                  className="h-24 sm:h-26 w-full object-cover"
                />
              </div>
              {section.image_caption && (
                <span className="mb-1.5 block text-[10px] italic text-slate-500 leading-tight">
                  {section.image_caption}
                </span>
              )}
              <div
                ref={bodyRef}
                className={[
                  BODY_CLASS,
                  'overflow-hidden whitespace-pre-wrap',
                  expanded ? '' : (COLLAPSED_BODY[block.size] ?? COLLAPSED_BODY.small),
                ].join(' ')}
                style={
                  overflowing && !expanded
                    ? {
                        WebkitMaskImage:
                          'linear-gradient(to bottom, black 80%, transparent 100%)',
                        maskImage:
                          'linear-gradient(to bottom, black 80%, transparent 100%)',
                      }
                    : undefined
                }
              >
                {content}
              </div>
            </div>
          )}

          {/* --- TEXT-ONLY SECTIONS (NO PHOTO) --- */}
          {!hasPhoto && (
            <div
              ref={bodyRef}
              className={[
                BODY_CLASS,
                'w-full overflow-hidden whitespace-pre-wrap',
                expanded ? '' : (COLLAPSED_BODY[block.size] ?? COLLAPSED_BODY.small),
              ].join(' ')}
              style={
                overflowing && !expanded
                  ? {
                      WebkitMaskImage:
                        'linear-gradient(to bottom, black 80%, transparent 100%)',
                      maskImage:
                        'linear-gradient(to bottom, black 80%, transparent 100%)',
                    }
                  : undefined
              }
            >
              {content}
            </div>
          )}

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
          {hasPhoto && (
            <div className="mb-2 size-12 overflow-hidden rounded-lg border border-slate-200">
              <img src={section.image_url} alt="" className="size-full object-cover" />
            </div>
          )}
          <span className="text-[13px] sm:text-[15px] font-semibold text-brand-500">Add {label}</span>
          <span className="mt-0.5 text-[11px] sm:text-[13px] text-slate-500 leading-snug">Type or record to add content</span>
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
