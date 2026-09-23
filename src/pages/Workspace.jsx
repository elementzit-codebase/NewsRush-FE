import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import EditionCard from '../components/EditionCard'
import NewEditionDialog from '../components/NewEditionDialog'
import Sidebar from '../components/Sidebar'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GridIcon,
  ListIcon,
  LogoutIcon,
  PlusIcon,
  SearchIcon,
} from '../components/Icons'
import { FILTERS, SORT_OPTIONS } from '../data/editions'
import * as api from '../lib/api'
import { useAuth } from '../lib/auth'

// Multiples of the 4-up grid, so the last row is never left part-filled.
const PER_PAGE_OPTIONS = [8, 12, 24]

/** A section counts as done only with a title, a body and `completed` status. */
const countCompleted = (sections = []) =>
  sections.filter((s) => s.status === 'completed' && s.title && s.content).length

export default function Workspace() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [editions, setEditions] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('latest')
  const [layout, setLayout] = useState('grid')
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0])
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setError('')
    try {
      const list = await api.listEditions()
      setEditions(list)

      // The list route omits sections, so each edition's detail is fetched to
      // show progress. A failure here degrades to 0% rather than blanking the page.
      const details = await Promise.all(
        list.map((edition) => api.getEdition(edition.id).catch(() => null)),
      )
      setProgress(
        Object.fromEntries(
          details.filter(Boolean).map((detail) => [detail.id, countCompleted(detail.sections)]),
        ),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Any change to the result set returns the reader to the first page. Done at
  // the event rather than in an effect, so there is no second render pass.
  function changeAndReset(setter) {
    return (value) => {
      setter(value)
      setPage(1)
    }
  }

  const onQuery = changeAndReset(setQuery)
  const onFilter = changeAndReset(setFilter)
  const onSort = changeAndReset(setSort)
  const onPerPage = changeAndReset(setPerPage)

  async function handleSignOut() {
    // Guarded because logout revokes the refresh token server-side; a double
    // click would send the second request with a token already spent.
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  async function handleCreate(values) {
    const edition = await api.createEdition(values)
    setCreating(false)
    navigate('/create?edition=' + edition.id)
  }

  async function handleDelete(edition) {
    const question = 'Delete "' + edition.newspaper_name + '" and all of its sections?'
    if (!window.confirm(question)) return
    try {
      await api.deleteEdition(edition.id)
      setEditions((current) => current.filter((item) => item.id !== edition.id))
    } catch (err) {
      setError(err.message)
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = editions.filter((edition) => {
      const matchesFilter = filter === 'all' || edition.status === filter
      const matchesQuery =
        !needle ||
        edition.newspaper_name.toLowerCase().includes(needle) ||
        edition.edition_label.toLowerCase().includes(needle)
      return matchesFilter && matchesQuery
    })

    const sorted = [...filtered]
    if (sort === 'title') sorted.sort((a, b) => a.newspaper_name.localeCompare(b.newspaper_name))
    else if (sort === 'oldest') sorted.sort((a, b) => new Date(a.date) - new Date(b.date))
    else sorted.sort((a, b) => new Date(b.date) - new Date(a.date))
    return sorted
  }, [editions, query, filter, sort])

  const totalPages = Math.max(1, Math.ceil(visible.length / perPage))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * perPage
  const pageItems = visible.slice(start, start + perPage)

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-6 px-8 py-6 lg:px-12">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="flex items-center gap-3" title="Your profile">
              <Avatar user={user} className="size-11 text-[17px]" />
              <span className="hidden text-right sm:block">
                <span className="block font-semibold text-ink">
                  {user?.first_name} {user?.last_name}
                </span>
                <span className="block text-sm text-muted">
                  {user?.is_system_user ? 'System user' : 'Editor'}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign out"
              className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[15px] font-medium text-ink transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <LogoutIcon className="size-5" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-8 pb-10 lg:px-12">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="text-[clamp(28px,3vw,40px)] font-bold text-navy-900">News Workspace</h1>
              <p className="mt-2 text-[17px] text-muted">
                Create, dictate and compile 4-page evening editions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-3 rounded-xl bg-navy-900 px-6 py-4 text-[16px] font-semibold text-white transition hover:bg-navy-700"
            >
              <PlusIcon className="size-5" />
              New Edition
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[15px] text-red-700"
            >
              {error}
            </p>
          )}

          {/* Controls */}
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <div className="flex min-w-[260px] flex-1 items-center gap-3 rounded-xl border border-line px-4 focus-within:border-brand-500">
              <SearchIcon className="size-5 shrink-0 text-muted" />
              <input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Search editions by name or label..."
                aria-label="Search editions"
                className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Filter by status">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onFilter(key)}
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

            <label className="relative">
              <span className="sr-only">Sort by</span>
              <select
                value={sort}
                onChange={(e) => onSort(e.target.value)}
                className="appearance-none rounded-xl border border-line bg-white py-3.5 pl-5 pr-11 text-[15px] text-ink outline-none focus:border-brand-500"
              >
                {SORT_OPTIONS.map(({ key, label }) => (
                  <option key={key} value={key}>
                    Sort by: {label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
            </label>

            <div className="flex items-center gap-2" role="group" aria-label="Layout">
              <ViewToggle active={layout === 'grid'} onClick={() => setLayout('grid')} label="Grid view">
                <GridIcon className="size-5" />
              </ViewToggle>
              <ViewToggle active={layout === 'list'} onClick={() => setLayout('list')} label="List view">
                <ListIcon className="size-5" />
              </ViewToggle>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <p className="mt-16 text-center text-muted">Loading editions…</p>
          ) : pageItems.length === 0 ? (
            <div className="mt-16 rounded-2xl border border-dashed border-line py-20 text-center">
              <p className="text-[17px] font-semibold text-ink">
                {editions.length === 0 ? 'No editions yet' : 'No editions match your filters'}
              </p>
              <p className="mt-2 text-muted">
                {editions.length === 0
                  ? 'Create your first edition to start dictating sections.'
                  : 'Try a different search term or clear the status filter.'}
              </p>
            </div>
          ) : (
            <div
              className={
                layout === 'grid'
                  ? 'mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'mt-8 flex flex-col gap-4'
              }
            >
              {pageItems.map((edition) => (
                <EditionCard
                  key={edition.id}
                  edition={edition}
                  completed={progress[edition.id] ?? 0}
                  layout={layout}
                  onOpen={() => navigate('/create?edition=' + edition.id)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && visible.length > 0 && (
            <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
              <p className="text-[15px] text-muted">
                Showing {start + 1} to {Math.min(start + perPage, visible.length)} of {visible.length} editions
              </p>

              <nav className="flex items-center gap-2" aria-label="Pagination">
                <PageButton
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  label="Previous page"
                >
                  <ChevronLeftIcon className="size-5" />
                </PageButton>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === currentPage ? 'page' : undefined}
                    className={[
                      'size-11 rounded-xl border text-[15px] font-medium transition',
                      n === currentPage
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-line bg-white text-ink hover:border-brand-100 hover:text-brand-600',
                    ].join(' ')}
                  >
                    {n}
                  </button>
                ))}

                <PageButton
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  label="Next page"
                >
                  <ChevronRightIcon className="size-5" />
                </PageButton>
              </nav>

              <label className="relative">
                <span className="sr-only">Results per page</span>
                <select
                  value={perPage}
                  onChange={(e) => onPerPage(Number(e.target.value))}
                  className="appearance-none rounded-xl border border-line bg-white py-3 pl-5 pr-11 text-[15px] text-ink outline-none focus:border-brand-500"
                >
                  {PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
              </label>
            </div>
          )}
        </main>
      </div>

      {creating && <NewEditionDialog onCancel={() => setCreating(false)} onCreate={handleCreate} />}
    </div>
  )
}

function ViewToggle({ active, onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={[
        'grid size-12 place-items-center rounded-xl border transition',
        active
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-line bg-white text-muted hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function PageButton({ onClick, disabled, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-11 place-items-center rounded-xl border border-line text-muted transition hover:text-ink disabled:opacity-40 disabled:hover:text-muted"
    >
      {children}
    </button>
  )
}
