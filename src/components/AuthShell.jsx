import { Link } from 'react-router-dom'
import { NewspaperMarkIcon } from './Icons'

/**
 * Centred single-column frame for the secondary auth screens (register, forgot
 * and reset password). The login page keeps its own two-panel layout.
 */
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-white to-brand-50/40 px-6 py-10">
      <Link to="/login" className="inline-flex items-center gap-3 self-start">
        <NewspaperMarkIcon className="size-11 text-brand-500" strokeWidth={1.5} />
        <span>
          <span className="block text-[26px] leading-none font-bold text-navy-900">
            NewsCraft <span className="text-brand-500">AI</span>
          </span>
          <span className="mt-1 block text-[13px] text-muted">AI-Powered News Creation</span>
        </span>
      </Link>

      <main className="mx-auto flex w-full max-w-[540px] flex-1 flex-col justify-center py-10">
        <h1 className="text-[clamp(26px,3vw,36px)] leading-tight font-bold text-navy-900">{title}</h1>
        {subtitle && <p className="mt-3 text-[17px] leading-relaxed text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </main>

      <p className="text-sm text-muted">&copy; 2025 NewsCraft AI. All rights reserved.</p>
    </div>
  )
}
