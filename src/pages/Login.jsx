import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import LoginArt from '../components/LoginArt'
import Field, { PasswordToggle } from '../components/Field'
import {
  LockIcon,
  MailIcon,
  MicIcon,
  NewspaperMarkIcon,
  SparkleIcon,
  FileTextIcon,
  UsersIcon,
} from '../components/Icons'
import { useAuth } from '../lib/auth'

const FEATURES = [
  {
    icon: FileTextIcon,
    title: 'Smart Content',
    body: 'AI helps you create, summarize and refine news instantly.',
  },
  {
    icon: MicIcon,
    title: 'Multi-Input',
    body: 'Use voice, video or text to generate content effortlessly.',
  },
  {
    icon: SparkleIcon,
    title: 'AI Assistance',
    body: 'Get intelligent suggestions and real-time improvements.',
  },
]

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const destination = location.state?.from?.pathname ?? '/'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn({ email, password })
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,38%)_minmax(0,62%)]">
      {/* Form panel */}
      <div className="flex flex-col justify-between border-r border-line px-8 py-10 sm:px-14 lg:px-16">
        <Link to="/login" className="inline-flex items-center gap-3">
          <NewspaperMarkIcon className="size-11 text-brand-500" strokeWidth={1.5} />
          <span>
            <span className="block text-[26px] leading-none font-bold text-navy-900">
              NewsCraft <span className="text-brand-500">AI</span>
            </span>
            <span className="mt-1 block text-[13px] text-muted">AI-Powered News Creation</span>
          </span>
        </Link>

        <div className="my-10 max-w-md">
          <h1 className="text-[clamp(30px,3vw,42px)] leading-[1.15] font-bold text-navy-900">
            Create Smarter News with AI
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Transform ideas into engaging news content with the power of AI.
          </p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5" noValidate>
            <Field
              id="email"
              label="Email Address"
              icon={MailIcon}
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={setEmail}
            />

            <Field
              id="password"
              label="Password"
              icon={LockIcon}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={setPassword}
              trailing={
                <PasswordToggle
                  shown={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              }
            />

            <div className="flex items-center justify-end gap-4">
              <Link
                to="/forgot-password"
                className="text-[15px] font-medium text-brand-500 hover:text-brand-600"
              >
                Forgot Password?
              </Link>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-navy-900 py-4 text-[17px] font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Login'}
            </button>

            <div className="flex items-center gap-4 py-1 text-sm text-muted">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <div className="flex items-center justify-center gap-2 rounded-xl border border-line py-4 text-[15px] text-ink">
              <UsersIcon className="size-5 text-muted" />
              Don&rsquo;t have an account?
              <Link to="/register" className="font-medium text-brand-500 hover:text-brand-600">
                Register
              </Link>
            </div>
          </form>
        </div>

        <p className="text-sm text-muted">&copy; 2025 NewsCraft AI. All rights reserved.</p>
      </div>

      {/* Illustration panel */}
      <div className="hidden flex-col justify-center bg-gradient-to-b from-white to-brand-50/40 px-10 py-12 lg:flex">
        <LoginArt />

        <ul className="mx-auto mt-10 grid w-full max-w-[820px] grid-cols-3 gap-8">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-500">
                <Icon className="size-6" />
              </span>
              <span>
                <span className="block font-semibold text-ink">{title}</span>
                <span className="mt-1 block text-[15px] leading-relaxed text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
