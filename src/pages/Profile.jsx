import { useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Field, { PasswordToggle } from '../components/Field'
import Avatar from '../components/Avatar'
import { CheckIcon, LockIcon, TrashIcon } from '../components/Icons'
import * as api from '../lib/api'
import { useAuth } from '../lib/auth'

// Mirrors app/core/profile_pictures.py, so an unusable file is refused before
// it costs a round trip.
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const fileInputRef = useRef(null)

  const [picBusy, setPicBusy] = useState(false)
  const [picError, setPicError] = useState('')
  const [picNotice, setPicNotice] = useState('')

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')

  const updatePassword = (key) => (value) =>
    setPasswords((current) => ({ ...current, [key]: value }))

  async function handlePicked(event) {
    const file = event.target.files?.[0]
    // Clear immediately so picking the same file again still fires onChange.
    event.target.value = ''
    if (!file) return

    setPicError('')
    setPicNotice('')

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPicError('Profile picture must be a JPEG, PNG or WebP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setPicError('Profile picture must be 5 MB or smaller.')
      return
    }

    setPicBusy(true)
    try {
      refreshUser(await api.uploadProfilePicture(file))
      setPicNotice('Profile picture updated.')
    } catch (err) {
      setPicError(err.message)
    } finally {
      setPicBusy(false)
    }
  }

  async function handleRemovePic() {
    setPicError('')
    setPicNotice('')
    setPicBusy(true)
    try {
      await api.removeProfilePicture()
      // The delete route returns a message, so the user is re-read for the
      // now-empty profile_pic.
      refreshUser(await api.getMe())
      setPicNotice('Profile picture removed.')
    } catch (err) {
      setPicError(err.message)
    } finally {
      setPicBusy(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordNotice('')

    if (passwords.next !== passwords.confirm) {
      setPasswordError('The two new passwords do not match.')
      return
    }

    setPasswordBusy(true)
    try {
      const result = await api.changePassword({
        currentPassword: passwords.current,
        newPassword: passwords.next,
      })
      setPasswordNotice(result.message)
      setPasswords({ current: '', next: '', confirm: '' })
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />

      <main className="min-w-0 flex-1 px-8 py-10 lg:px-12">
        <h1 className="text-[clamp(28px,3vw,40px)] font-bold text-navy-900">Your profile</h1>
        <p className="mt-2 text-[17px] text-muted">Manage your photo and password.</p>

        <div className="mt-9 grid max-w-[900px] gap-6 lg:grid-cols-2">
          {/* Identity + picture */}
          <section className="rounded-2xl border border-line p-6">
            <h2 className="text-[19px] font-bold text-navy-900">Photo</h2>

            <div className="mt-5 flex items-center gap-5">
              <Avatar user={user} className="size-20 text-[26px]" />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold text-ink">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="truncate text-[15px] text-muted">{user?.email}</p>
                <p className="mt-1 text-[14px] text-muted">{user?.phone_number}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handlePicked}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={picBusy}
                className="rounded-xl bg-navy-900 px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60"
              >
                {picBusy ? 'Working…' : 'Upload photo'}
              </button>
              {user?.profile_pic && (
                <button
                  type="button"
                  onClick={handleRemovePic}
                  disabled={picBusy}
                  className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-[15px] font-medium text-ink transition hover:bg-navy-50 disabled:opacity-60"
                >
                  <TrashIcon className="size-5" />
                  Remove
                </button>
              )}
            </div>

            <p className="mt-3 text-[13px] text-muted">JPEG, PNG or WebP, up to 5 MB.</p>

            {picError && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {picError}
              </p>
            )}
            {picNotice && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                <CheckIcon className="size-4" />
                {picNotice}
              </p>
            )}
          </section>

          {/* Password */}
          <section className="rounded-2xl border border-line p-6">
            <h2 className="text-[19px] font-bold text-navy-900">Password</h2>

            <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-5" noValidate>
              <Field
                id="current_password"
                label="Current password"
                icon={LockIcon}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={passwords.current}
                onChange={updatePassword('current')}
                required
                trailing={
                  <PasswordToggle
                    shown={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                }
              />
              <Field
                id="new_password"
                label="New password"
                icon={LockIcon}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={passwords.next}
                onChange={updatePassword('next')}
                required
                minLength={8}
                hint="Minimum 8 characters."
              />
              <Field
                id="confirm_password"
                label="Confirm new password"
                icon={LockIcon}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={passwords.confirm}
                onChange={updatePassword('confirm')}
                required
                minLength={8}
              />

              {passwordError && (
                <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  {passwordError}
                </p>
              )}
              {passwordNotice && (
                <p className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                  <CheckIcon className="size-4" />
                  {passwordNotice}
                </p>
              )}

              <button
                type="submit"
                disabled={passwordBusy}
                className="w-full rounded-xl bg-brand-500 py-3.5 text-[15px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
              >
                {passwordBusy ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
