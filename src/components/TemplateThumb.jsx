const HEIGHT = { lead: 10, body: 13, tall: 15, small: 8 }

/**
 * Miniature wireframe of a page, generated from the same `blocks` array the
 * canvas renders — so a thumbnail can never drift from the page it previews.
 * Blocks whose section is completed are tinted so progress reads at a glance.
 */
export default function TemplateThumb({ blocks, completedKeys, className = '' }) {
  return (
    <div
      className={`grid auto-rows-min grid-cols-3 gap-1 rounded-lg border border-slate-200/90 bg-slate-50 p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {blocks.map((block) => (
        <span
          key={block.section_key}
          className={`rounded-[3px] transition-colors ${
            completedKeys?.has(block.section_key)
              ? 'bg-brand-500 shadow-[0_1px_2px_rgba(47,107,246,0.25)]'
              : 'bg-slate-200/80 border border-slate-300/40'
          }`}
          style={{
            gridColumn: `span ${block.span} / span ${block.span}`,
            height: `${HEIGHT[block.size] ?? 8}px`,
          }}
        />
      ))}
    </div>
  )
}
