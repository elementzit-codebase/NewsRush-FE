import { ChartIcon, MicIcon, PlayIcon, SparkleIcon } from './Icons'
import Waveform from './Waveform'

/** Grey placeholder text lines used inside the floating cards. */
const Lines = ({ widths, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {widths.map((w, i) => (
      <div key={i} className="h-[6px] rounded-full bg-slate-200" style={{ width: `${w}%` }} />
    ))}
  </div>
)

const Card = ({ className = '', children }) => (
  <div
    className={`absolute rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_18px_40px_-24px_rgba(15,32,68,0.45)] ${className}`}
  >
    {children}
  </div>
)

/**
 * The marketing illustration beside the login form: a newspaper page with the
 * AI pipeline arranged around it. Composed from DOM nodes and one SVG layer of
 * dashed connectors, so it scales with the panel and needs no image asset.
 */
export default function LoginArt() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[760px]">
      {/* Soft background wash and dot grids */}
      <div className="absolute left-[12%] top-[8%] size-[74%] rounded-full bg-brand-50/70 blur-[2px]" />
      <DotGrid className="left-[2%] top-[10%]" />
      <DotGrid className="right-[2%] top-[8%]" />

      {/* Dashed connectors, drawn under the cards */}
      <svg
        viewBox="0 0 100 75"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full text-brand-500/70"
        aria-hidden="true"
      >
        <g fill="none" stroke="currentColor" strokeWidth="0.35" strokeDasharray="1.6 1.4" strokeLinecap="round">
          <path d="M24 14 Q 30 8 40 9" />
          <path d="M62 10 Q 72 8 78 14" />
          <path d="M27 30 Q 34 34 41 34" />
          <path d="M62 32 Q 70 32 76 32" />
          <path d="M63 48 Q 74 50 82 46" />
        </g>
        <g fill="currentColor">
          <path d="M40.4 8 41.8 9 40.4 10Z" />
          <path d="M77.4 13 78.8 14 77.4 15Z" />
          <path d="M40.4 33 41.8 34 40.4 35Z" />
          <path d="M75.4 31 76.8 32 75.4 33Z" />
          <path d="M81.4 45 82.8 46 81.4 47Z" />
        </g>
      </svg>

      {/* AI-Powered pill */}
      <div className="absolute left-1/2 top-[3%] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-[15px] font-semibold text-brand-600">
        <SparkleIcon className="size-4" />
        AI-Powered
      </div>

      {/* Central newspaper page */}
      <div className="absolute left-1/2 top-[13%] w-[38%] -translate-x-1/2 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_30px_60px_-30px_rgba(15,32,68,0.5)]">
        <p className="text-center font-serif text-[clamp(14px,2.4vw,26px)] tracking-wide text-slate-800">
          NEWSPAPER
        </p>
        <div className="mt-2 space-y-1 border-y border-slate-200 py-1">
          <div className="h-[3px] rounded bg-slate-200" />
          <div className="h-[3px] w-2/3 rounded bg-slate-100" />
        </div>
        <div className="mt-3 h-[28%] min-h-16 rounded bg-gradient-to-br from-navy-500 to-brand-500" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Lines widths={[100, 88, 96, 74, 92, 80, 86]} />
          <div className="space-y-2">
            <Lines widths={[100, 82, 94, 70]} />
            <div className="h-10 rounded bg-slate-100" />
          </div>
        </div>
      </div>

      {/* AI Summary */}
      <Card className="left-0 top-[26%] w-[27%]">
        <p className="mb-3 inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
          <SparkleIcon className="size-4 text-brand-500" />
          AI Summary
        </p>
        <Lines widths={[100, 78, 92, 64]} />
        <div className="mt-3 h-[6px] w-[86%] rounded-full bg-brand-500" />
      </Card>

      {/* Key Points */}
      <Card className="right-0 top-[16%] w-[26%]">
        <p className="mb-3 text-[13px] font-semibold text-ink">Key Points</p>
        <ul className="space-y-3">
          {[100, 82, 90].map((w, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-slate-300" />
              <span className="h-[6px] rounded-full bg-slate-200" style={{ width: `${w * 0.8}%` }} />
            </li>
          ))}
        </ul>
      </Card>

      {/* Generated Content */}
      <Card className="right-[1%] top-[36%] w-[29%]">
        <p className="mb-3 text-[13px] font-semibold text-ink">Generated Content</p>
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-brand-500 text-[10px] font-bold text-white">
            AI
          </span>
          <span className="h-[6px] flex-1 rounded-full bg-slate-200" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <span className="h-[6px] w-1/2 rounded-full bg-brand-100" />
            <span className="h-[6px] w-1/3 rounded-full bg-brand-500" />
          </div>
          <div className="h-[6px] w-3/4 rounded-full bg-brand-500/80" />
        </div>
      </Card>

      {/* Mic + waveform */}
      <div className="absolute left-[6%] top-[50%] grid size-[13%] min-h-12 min-w-12 place-items-center rounded-full bg-white shadow-[0_18px_40px_-22px_rgba(15,32,68,0.5)]">
        <MicIcon className="size-1/2 text-brand-500" />
      </div>
      <Card className="left-[1%] top-[64%] w-[25%]">
        <Waveform bars={26} className="h-6" />
      </Card>

      {/* Play tile */}
      <Card className="right-[2%] top-[54%] grid size-[11%] min-h-12 min-w-12 place-items-center !p-0">
        <PlayIcon className="size-1/2 text-ink" />
      </Card>

      {/* Chart tile */}
      <Card className="left-[42%] top-[80%] grid size-[11%] min-h-12 min-w-12 place-items-center !p-0">
        <ChartIcon className="size-1/2 text-brand-500" strokeWidth={2.4} />
      </Card>

      {/* Stacked folded papers */}
      <div className="absolute left-[13%] top-[76%] w-[26%]">
        <div className="translate-x-2 rounded-md border border-slate-200 bg-slate-50 py-1.5" />
        <div className="mt-1 rounded-md border border-slate-200 bg-white p-3 shadow-[0_16px_32px_-24px_rgba(15,32,68,0.6)]">
          <p className="font-serif text-[clamp(9px,1.4vw,15px)] tracking-wide text-slate-700">DAILY NEWS</p>
          <div className="mt-1.5 grid grid-cols-[1fr_1.2fr] gap-2">
            <Lines widths={[100, 80, 92]} />
            <div className="h-8 rounded bg-gradient-to-br from-slate-400 to-slate-200" />
          </div>
        </div>
      </div>

      {/* Laptop */}
      <div className="absolute right-[8%] bottom-[6%] w-[36%]">
        <div className="rounded-t-xl border border-slate-300 bg-white p-2 shadow-[0_20px_40px_-28px_rgba(15,32,68,0.6)]">
          <div className="flex gap-2 rounded-md bg-slate-50 p-2">
            <div className="w-[14%] space-y-1.5 rounded bg-navy-900 p-1.5">
              <div className="h-1.5 rounded bg-white/70" />
              <div className="h-1.5 rounded bg-white/30" />
              <div className="h-1.5 rounded bg-white/30" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-1.5 w-1/3 rounded bg-brand-500" />
              <Lines widths={[100, 86, 94, 70, 88]} />
            </div>
          </div>
        </div>
        <div className="h-2 rounded-b-xl border-x border-b border-slate-300 bg-slate-200" />
      </div>
    </div>
  )
}

const DotGrid = ({ className = '' }) => (
  <div
    className={`absolute size-[12%] opacity-70 ${className}`}
    style={{
      backgroundImage: 'radial-gradient(#cbd5e1 1.4px, transparent 1.4px)',
      backgroundSize: '12px 12px',
    }}
    aria-hidden="true"
  />
)
