const HEIGHT = { lead: 14, body: 20, tall: 20, small: 11 }

/**
 * Miniature wireframe of a page, generated from the same `blocks` array the
 * canvas renders — so a thumbnail can never drift from the page it previews.
 * Blocks whose section is completed are tinted so progress reads at a glance.
 */
export default function TemplateThumb({ blocks, completedKeys, className = '' }) {
  return (
    <div className={`grid auto-rows-min grid-cols-3 gap-[3px] rounded bg-slate-200 p-[4px] ${className}`}>
      {blocks.map((block) => (
        <span
          key={block.section_key}
          className={`rounded-[2px] ${
            completedKeys?.has(block.section_key) ? 'bg-brand-500' : 'bg-slate-100'
          }`}
          style={{
            gridColumn: `span ${block.span} / span ${block.span}`,
            minHeight: HEIGHT[block.size] ?? 11,
          }}
        />
      ))}
    </div>
  )
}
