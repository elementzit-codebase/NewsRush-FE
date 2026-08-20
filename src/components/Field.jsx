import { EyeIcon, EyeOffIcon } from './Icons'

/**
 * Labelled input used across the auth screens. The icon sits inside the border
 * so the whole control reads as one target, and `trailing` carries extras like
 * the show/hide-password toggle.
 */
export default function Field({ id, label, icon: Icon, trailing, value, onChange, hint, ...input }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[15px] font-semibold text-ink">
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-line px-4 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-50">
        {Icon && <Icon className="size-5 shrink-0 text-muted" />}
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-4 text-[16px] text-ink outline-none placeholder:text-slate-400"
          {...input}
        />
        {trailing}
      </div>
      {hint && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
    </div>
  )
}

/** Shared show/hide control for password inputs. */
export function PasswordToggle({ shown, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="text-muted transition hover:text-ink"
    >
      {shown ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
    </button>
  )
}

