import { STATUS_LABELS } from '../data/editions'

const STYLES = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ready: 'bg-brand-500 text-white border-brand-500',
  in_progress: 'bg-brand-50 text-brand-600 border-brand-100',
  draft: 'bg-white text-muted border-line',
}

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-[13px] font-medium ${
        STYLES[status] ?? STYLES.draft
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
