import { useCallback, useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Avatar from '../components/Avatar'
import RejectUserDialog from '../components/RejectUserDialog'
import Toast from '../components/Toast'
import { CheckIcon } from '../components/Icons'
import * as api from '../lib/api'

// Matches the `approval_status` values the backend accepts on GET /api/users.
const FILTERS = [
  { key: 'pending', label: 'Awaiting approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'all', label: 'All' },
]

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

/**
 * The system-user approval queue. Registration creates accounts with
 * `is_approved = false`, and they cannot log in until approved here.
 */
export default function Users() {
  const [filter, setFilter] = useState('pending')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [rejectingUser, setRejectingUser] = useState(null)

  const load = useCallback(async (status) => {
    setLoading(true)
    setError('')
    try {
      setUsers(await api.listUsers(status))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filter)
  }, [filter, load])

  async function approve(user) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User'
    setBusyId(user.id)
    setError('')
    try {
      const updated = await api.approveUser(user.id)
      // Approving removes the row from the pending list, so it is dropped
      // rather than patched when that filter is showing.
      setUsers((current) =>
        filter === 'pending'
          ? current.filter((item) => item.id !== user.id)
          : current.map((item) => (item.id === user.id ? updated : item)),
      )
      setToast({
        type: 'success',
        message: `${fullName} has been approved successfully.`,
      })
    } catch (err) {
      setError(err.message)
      setToast({
        type: 'error',
        message: err.message || `Failed to approve ${fullName}.`,
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleConfirmReject() {
    if (!rejectingUser) return
    const fullName = [rejectingUser.first_name, rejectingUser.last_name].filter(Boolean).join(' ') || 'User'
    try {
      await api.rejectUser(rejectingUser.id)
      setUsers((current) => current.filter((item) => item.id !== rejectingUser.id))
      setRejectingUser(null)
      setToast({
        type: 'success',
        message: `Registration for ${fullName} was rejected.`,
      })
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || `Failed to reject registration for ${fullName}.`,
      })
      throw err
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />

      <main className="min-w-0 flex-1 px-8 py-10 lg:px-12">
        <h1 className="text-[clamp(28px,3vw,40px)] font-bold text-navy-900">Users</h1>
        <p className="mt-2 text-[17px] text-muted">
          Approve new registrations so they can sign in.
        </p>

        <div className="mt-8 flex flex-wrap gap-3" role="group" aria-label="Filter users">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={[
                'rounded-xl border px-5 py-3 text-[15px] font-medium transition',
                filter === key
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-line bg-white text-ink hover:border-brand-100 hover:text-brand-600',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[15px] text-red-700"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-16 text-center text-muted">Loading users…</p>
        ) : users.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-line py-20 text-center">
            <p className="text-[17px] font-semibold text-ink">
              {filter === 'pending' ? 'No one is waiting for approval' : 'No users to show'}
            </p>
          </div>
        ) : (
          <ul className="mt-8 max-w-[900px] space-y-3">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center gap-5 rounded-2xl border border-line p-5"
              >
                <Avatar user={user} className="size-12 text-[17px]" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-semibold text-ink">
                    {user.first_name} {user.last_name}
                    {user.is_system_user && (
                      <span className="ml-2 rounded-md border border-line px-2 py-0.5 text-[12px] font-medium text-muted">
                        System user
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[15px] text-muted">{user.email}</p>
                  <p className="text-[14px] text-muted">{user.phone_number}</p>
                </div>

                <div className="text-right text-[13px] text-muted">
                  <p>Registered {formatDate(user.created_at)}</p>
                  {user.is_approved && <p>Approved {formatDate(user.approved_at)}</p>}
                </div>

                {user.is_approved ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-700">
                    <CheckIcon className="size-4" />
                    Approved
                  </span>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRejectingUser(user)}
                      disabled={busyId === user.id}
                      className="rounded-xl border border-line px-4 py-2.5 text-[14px] font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => approve(user)}
                      disabled={busyId === user.id}
                      className="rounded-xl bg-navy-900 px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60"
                    >
                      {busyId === user.id ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      {rejectingUser && (
        <RejectUserDialog
          user={rejectingUser}
          onCancel={() => setRejectingUser(null)}
          onConfirm={handleConfirmReject}
        />
      )}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

