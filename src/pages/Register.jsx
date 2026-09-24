import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field, { PasswordToggle } from '../components/Field'
import AuthShell from '../components/AuthShell'
import { CheckIcon, LockIcon, MailIcon, UsersIcon } from '../components/Icons'
import * as api from '../lib/api'

/**
 * Registration creates a *pending* account: the backend sets `is_approved` to
 * false, and login is refused until a system user approves it. The success
 * state says so, rather than sending the reader to a login that would fail.
 */
export default function Register() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(null)

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }))

  function handlePhoneChange(value) {
    // Restrict strictly to max 10 characters (digits and phone symbols)
    const filtered = value.replace(/[^0-9 ()+-]/g, '').slice(0, 10)
    update('phone_number')(filtered)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const phone = form.phone_number.trim()
    const phonePattern = /^\+?[0-9 ()-]+$/
    const digitsOnly = phone.replace(/\D/g, '')

    if (!phone) {
      setError('Please enter your phone number.')
      return
    }

    if (!phonePattern.test(phone) || digitsOnly.length !== 10) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setSubmitting(true)
    try {
      setRegistered(await api.register(form))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (registered) {
    return (
      <AuthShell title="Registration received" subtitle="One more step before you can sign in.">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="inline-flex items-center gap-2 font-semibold text-emerald-800">
            <CheckIcon className="size-5" />
            Account created for {registered.email}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-emerald-900">
            A system user has to approve your account before you can sign in. You will not be able
            to log in until that happens.
          </p>
        </div>
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
    <AuthShell title="Create your account" subtitle="Register to join the newsroom.">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="first_name"
            label="First name"
            autoComplete="given-name"
            placeholder="First Name"
            value={form.first_name}
            onChange={update('first_name')}
            required
            maxLength={100}
          />
          <Field
            id="last_name"
            label="Last name"
            autoComplete="family-name"
            placeholder="Second Name"
            value={form.last_name}
            onChange={update('last_name')}
            required
            maxLength={100}
          />
        </div>

        <Field
          id="email"
          label="Email address"
          icon={MailIcon}
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={form.email}
          onChange={update('email')}
          required
        />

        <Field
          id="phone_number"
          label="Phone number"
          type="tel"
          autoComplete="tel"
          placeholder="Enter Phone Number"
          value={form.phone_number}
          onChange={handlePhoneChange}
          maxLength={10}
          required
          hint="10-digit phone number."
        />

        <Field
          id="password"
          label="Password"
          icon={LockIcon}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={update('password')}
          required
          minLength={8}
          hint="Minimum 8 characters."
          trailing={
            <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          }
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
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <div className="flex items-center justify-center gap-2 rounded-xl border border-line py-4 text-[15px] text-ink">
          <UsersIcon className="size-5 text-muted" />
          Already registered?
          <Link to="/login" className="font-medium text-brand-500 hover:text-brand-600">
            Sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
