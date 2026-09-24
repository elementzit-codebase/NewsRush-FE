import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Avatar from '../components/Avatar'
import CropAvatarDialog from '../components/CropAvatarDialog'
import {
  CalendarIcon,
  CheckIcon,
  LockIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
} from '../components/Icons'
import { PasswordToggle } from '../components/Field'
import * as api from '../lib/api'
import { useAuth } from '../lib/auth'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

const formatDate = (value) => {
  if (!value) return '—'
  try {
    const d = new Date(value)
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

/**
 * Modern, polished Account & Profile management page.
 */
export default function Profile() {
  const { user, refreshUser } = useAuth()
  const fileInputRef = useRef(null)

  const [picBusy, setPicBusy] = useState(false)
  const [picError, setPicError] = useState('')
  const [picNotice, setPicNotice] = useState('')

  const [cropFile, setCropFile] = useState(null)
  const [cropImageSrc, setCropImageSrc] = useState(null)

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNextPassword, setShowNextPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')

  const updatePassword = (key) => (value) =>
    setPasswords((current) => ({ ...current, [key]: value }))

  function handlePicked(event) {
    const file = event.target.files?.[0]
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

    const objectUrl = URL.createObjectURL(file)
    setCropFile(file)
    setCropImageSrc(objectUrl)
  }

  function handleCancelCrop() {
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc)
    }
    setCropFile(null)
    setCropImageSrc(null)
  }

  async function handleSaveCroppedPic(croppedFile) {
    setPicBusy(true)
    setPicError('')
    setPicNotice('')
    try {
      refreshUser(await api.uploadProfilePicture(croppedFile))
      setPicNotice('Profile picture updated successfully.')
      handleCancelCrop()
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

    if (passwords.next.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }

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
      setPasswordNotice(result.message || 'Password updated successfully.')
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] items-center justify-end border-b border-line px-8 lg:px-12">
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-2xl px-3 py-1.5 transition hover:bg-slate-50"
            title="Your profile"
          >
            <Avatar user={user} className="size-10 text-[15px]" />
            <span className="hidden text-right sm:block">
              <span className="block text-[14px] font-semibold text-ink leading-tight">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="block text-[12px] font-medium text-muted mt-0.5">
                {user?.is_system_user ? 'System user' : 'Editor'}
              </span>
            </span>
          </Link>
        </header>

        <main className="min-w-0 flex-1 px-8 py-8 lg:px-12">
          <div className="space-y-8">
            <h1 className="text-[clamp(28px,3vw,40px)] font-bold text-navy-900">Account Settings</h1>

            {/* Header Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-navy-50/70 via-white to-brand-50/40 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-6">
                  {/* Avatar with upload trigger overlay */}
                  <div className="relative group">
                    <Avatar user={user} className="size-24 text-[32px] ring-4 ring-white shadow-md" />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={picBusy}
                      title="Change photo"
                      aria-label="Change photo"
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-navy-900/60 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-0"
                    >
                      <PencilIcon className="size-6" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_TYPES.join(',')}
                      onChange={handlePicked}
                      className="hidden"
                    />
                  </div>

                  {/* Identity text & badges */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-[24px] font-bold text-navy-900">
                        {user?.first_name} {user?.last_name}
                      </h2>
                      {user?.is_system_user ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1 text-[12px] font-semibold text-white shadow-xs">
                          <UsersIcon className="size-3.5" />
                          System Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-600 border border-brand-100">
                          Editor
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-[15px] text-muted">{user?.email}</p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[13px] text-muted">
                      {user?.created_at && (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarIcon className="size-4 text-slate-400" />
                          Joined {formatDate(user.created_at)}
                        </span>
                      )}
                      {user?.phone_number && (
                        <span>Phone: {user.phone_number}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Photo Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={picBusy}
                    className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-navy-800 disabled:opacity-60"
                  >
                    <PencilIcon className="size-4" />
                    {picBusy ? 'Uploading…' : 'Change Photo'}
                  </button>

                  {user?.profile_pic && (
                    <button
                      type="button"
                      onClick={handleRemovePic}
                      disabled={picBusy}
                      className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-[14px] font-medium text-red-600 transition hover:bg-red-50 hover:border-red-200 disabled:opacity-60"
                    >
                      <TrashIcon className="size-4" />
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Photo Alerts */}
              {picError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-700">
                  {picError}
                </div>
              )}
              {picNotice && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800">
                  <CheckIcon className="size-4 text-emerald-600" />
                  {picNotice}
                </div>
              )}
            </div>

            {/* Grid: Account Details & Password Change */}
            <div className="grid gap-8 lg:grid-cols-12">
              {/* Account Information Section */}
              <div className="space-y-6 lg:col-span-5">
                <div className="rounded-2xl border border-line bg-white p-6 shadow-xs">
                  <h3 className="text-[17px] font-bold text-navy-900">Personal Details</h3>
                  <p className="mt-1 text-[13px] text-muted">
                    Your profile credentials and system role.
                  </p>

                  <div className="mt-5 space-y-4">
                    <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-100">
                      <span className="block text-[12px] font-medium text-muted">Full Name</span>
                      <span className="mt-1 block text-[15px] font-semibold text-navy-900">
                        {user?.first_name} {user?.last_name}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-100">
                      <span className="block text-[12px] font-medium text-muted">Email Address</span>
                      <span className="mt-1 block text-[15px] font-semibold text-navy-900">
                        {user?.email}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-100">
                      <span className="block text-[12px] font-medium text-muted">Phone Number</span>
                      <span className="mt-1 block text-[15px] font-semibold text-navy-900">
                        {user?.phone_number || 'Not provided'}
                      </span>
                    </div>

                    {/* <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-100">
                      <span className="block text-[12px] font-medium text-muted">Account Status</span>
                      <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 border border-emerald-200">
                        <CheckIcon className="size-3.5" />
                        Approved & Active
                      </span>
                    </div> */}
                  </div>
                </div>
              </div>

              {/* Password & Security Section */}
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-line bg-white p-6 sm:p-7 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <LockIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-[17px] font-bold text-navy-900">Security & Password</h3>
                      <p className="text-[13px] text-muted">Update your account password regularly.</p>
                    </div>
                  </div>

                  <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-5" noValidate>
                    {/* Current Password */}
                    <div>
                      <label htmlFor="current_password" className="block text-[13px] font-semibold text-ink">
                        Current Password
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="current_password"
                          type={showCurrentPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={passwords.current}
                          onChange={(e) => updatePassword('current')(e.target.value)}
                          required
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-line px-4 py-3 pr-11 text-[15px] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <PasswordToggle
                            shown={showCurrentPassword}
                            onToggle={() => setShowCurrentPassword((v) => !v)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label htmlFor="new_password" className="block text-[13px] font-semibold text-ink">
                        New Password
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="new_password"
                          type={showNextPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={passwords.next}
                          onChange={(e) => updatePassword('next')(e.target.value)}
                          required
                          minLength={8}
                          placeholder="At least 8 characters"
                          className="w-full rounded-xl border border-line px-4 py-3 pr-11 text-[15px] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <PasswordToggle
                            shown={showNextPassword}
                            onToggle={() => setShowNextPassword((v) => !v)}
                          />
                        </div>
                      </div>
                      <p className="mt-1.5 text-[12px] text-muted">
                        Must contain at least 8 characters.
                      </p>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label htmlFor="confirm_password" className="block text-[13px] font-semibold text-ink">
                        Confirm New Password
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="confirm_password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={passwords.confirm}
                          onChange={(e) => updatePassword('confirm')(e.target.value)}
                          required
                          minLength={8}
                          placeholder="Re-enter your new password"
                          className="w-full rounded-xl border border-line px-4 py-3 pr-11 text-[15px] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <PasswordToggle
                            shown={showConfirmPassword}
                            onToggle={() => setShowConfirmPassword((v) => !v)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Alerts */}
                    {passwordError && (
                      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                        {passwordError}
                      </p>
                    )}
                    {passwordNotice && (
                      <p className="inline-flex w-full items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800">
                        <CheckIcon className="size-4 text-emerald-600" />
                        {passwordNotice}
                      </p>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={passwordBusy}
                      className="w-fit rounded-xl bg-brand-500 px-8 py-3 text-[15px] font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
                    >
                      {passwordBusy ? 'Updating Password…' : 'Update Password'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Crop Profile Picture Dialog Modal */}
      {cropImageSrc && (
        <CropAvatarDialog
          imageSrc={cropImageSrc}
          originalFile={cropFile}
          onCancel={handleCancelCrop}
          onSave={handleSaveCroppedPic}
          saving={picBusy}
        />
      )}
    </div>
  )
}

