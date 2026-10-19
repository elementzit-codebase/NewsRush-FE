import { STATUS_LABELS } from '../data/editions'

const STYLES = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  ready: 'bg-brand-50 text-brand-700 border-brand-200/80',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200/80',
  draft: 'bg-slate-50 text-slate-600 border-slate-200',
}

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap select-none ${
        STYLES[status] ?? STYLES.draft
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
