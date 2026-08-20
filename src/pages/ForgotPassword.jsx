import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { MailIcon } from '../components/Icons'
import * as api from '../lib/api'

/**
 * Requests a single-use reset token.
 *
 * When Microsoft Graph mail is configured the backend sends the email and the
 * payload it returns is just a receipt. When it is not configured the response
 * still carries `reset_url`, so it is surfaced here — otherwise there would be
 * no way to reach the reset screen in a local setup.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [payload, setPayload] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setPayload(await api.forgotPassword(email))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (payload) {
    return (
      <AuthShell title="Check your email" subtitle={`We generated a reset link for ${payload.to_email}.`}>
        <p className="text-[15px] leading-relaxed text-muted">
          The link expires in {payload.expires_in_minutes} minutes.
        </p>

        {payload.reset_url && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-[14px] font-semibold text-amber-900">Reset link</p>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-800">
              Shown here because the server returned it directly — with email delivery configured
              this arrives in the inbox instead.
            </p>
            <a
              href={payload.reset_url}
              className="mt-3 block break-all text-[13px] font-medium text-brand-600 underline"
            >
              {payload.reset_url}
            </a>
          </div>
        )}

        <Link
          to="/login"
          className="mt-6 block w-full rounded-xl bg-navy-900 py-4 text-center text-[17px] font-semibold text-white transition hover:bg-navy-700"
        >
          Back to login
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email on your account and we will send a reset link."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field
          id="email"
          label="Email address"
          icon={MailIcon}
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={setEmail}
          required
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
          {submitting ? 'Sending…' : 'Send reset link'}
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
