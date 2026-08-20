import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field, { PasswordToggle } from '../components/Field'
import { CheckIcon, LockIcon } from '../components/Icons'
import * as api from '../lib/api'

/**
 * Consumes the single-use token from the reset link. The backend rejects a new
 * password that matches the old one, and revokes every refresh token on
 * success, so any other signed-in session is dropped too.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // The token normally arrives in the query string; it stays editable so a
  // token copied by hand can be pasted in.
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    // Caught here rather than at the server, which only ever sees one password.
    if (password !== confirmation) {
      setError('The two passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await api.resetPassword({ token, newPassword: password })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can sign in with your new password.">
        <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-800">
          <CheckIcon className="size-5" />
          Your password has been reset
        </p>
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="mt-6 w-full rounded-xl bg-navy-900 py-4 text-[17px] font-semibold text-white transition hover:bg-navy-700"
        >
          Go to login
        </button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Reset links expire, so use it promptly.">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field
          id="token"
          label="Reset token"
          value={token}
          onChange={setToken}
          required
          placeholder="Paste the token from your reset link"
          hint="Filled in automatically when you arrive from the emailed link."
        />

        <Field
          id="password"
          label="New password"
          icon={LockIcon}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={setPassword}
          required
          minLength={8}
          trailing={
            <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          }
        />

        <Field
          id="confirmation"
          label="Confirm new password"
          icon={LockIcon}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Repeat the new password"
          value={confirmation}
          onChange={setConfirmation}
          required
          minLength={8}
        />

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
          {submitting ? 'Updating…' : 'Reset password'}
        </button>

        <Link
          to="/login"
          className="block text-center text-[15px] font-medium text-brand-500 hover:text-brand-600"
        >
          Back to login
        </Link>
      </form>
    </AuthShell>
  )
}
