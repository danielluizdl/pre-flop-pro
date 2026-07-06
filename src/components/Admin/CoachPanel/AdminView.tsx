import { Fragment, useCallback, useEffect, useState } from 'react'
import { captureError } from '../../../utils/sentry'
import { useModalA11y } from '../../../utils/useModalA11y'
import { t } from '../../../i18n'
import { type CoachUser, formatDateShort, accColor, Section, TH, THR, TD, TDR } from './shared'

const ADMIN_EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/

function ConfirmDangerModal({ title, description, confirmLabel, danger = true, busy, error, onConfirm, onCancel }: {
  title: string
  description: React.ReactNode
  confirmLabel: string
  danger?: boolean
  busy: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialogRef = useModalA11y<HTMLDivElement>(true, onCancel)
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-danger-title"
        onClick={e => e.stopPropagation()}
        className={`bg-warm-900 border rounded-2xl p-5 max-w-sm w-full space-y-3 ${danger ? 'border-red-900/60' : 'border-warm-700'}`}
      >
        <h3 id="confirm-danger-title" className="text-base font-bold text-warm-100 flex items-center gap-2">
          {danger && <span className="text-red-400" aria-hidden="true">⚠</span>} {title}
        </h3>
        <div className="text-sm text-warm-300 space-y-1.5">{description}</div>
        {danger && <p className="text-xs font-semibold text-red-400">{t.coach.cannotUndo}</p>}
        {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3.5 py-2 rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 disabled:opacity-40 text-sm font-semibold transition-colors"
          >
            {t.coach.cancelAction}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 text-white ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-600 hover:bg-brand-500'}`}
          >
            {busy ? t.coach.confirming : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface InviteCode {
  id: number
  code: string
  created_at: number
  used_at: number | null
  used_by_id: number | null
  used_by_username: string | null
  used_by_name: string | null
}

interface AuditLogEntry {
  id: number
  action: string
  target_id: number | null
  detail: string | null
  created_at: number
  actor_username: string
  actor_name: string
  target_username: string | null
  target_name: string | null
}

type PendingAction =
  | { type: 'reset'; userId: number; label: string }
  | { type: 'delete'; userId: number; label: string }
  | { type: 'edit'; userId: number; label: string; before: { name: string; email: string }; after: { name: string; email: string } }

export function AdminView({ token }: { token: string | null }) {
  const [users, setUsers] = useState<CoachUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ username: '', name: '', email: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createResult, setCreateResult] = useState<{ username: string; tempPassword: string } | null>(null)

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; email: string } | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<{ userId: number; tempPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [codes, setCodes] = useState<InviteCode[]>([])
  const [codesLoading, setCodesLoading] = useState(true)
  const [codesError, setCodesError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)

  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState('')

  const AUDIT_ACTION_LABEL: Record<string, string> = {
    create_user: t.coach.auditActionCreateUser,
    update_user: t.coach.auditActionUpdateUser,
    delete_user: t.coach.auditActionDeleteUser,
    reset_password: t.coach.auditActionResetPassword,
    create_invite_code: t.coach.auditActionCreateInviteCode,
  }

  const loadUsers = useCallback(() => {
    if (!token) return
    setLoading(true)
    setLoadError('')
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setUsers(d.users ?? []))
      .catch(() => setLoadError(t.coach.loadError))
      .finally(() => setLoading(false))
  }, [token])

  const loadCodes = useCallback(() => {
    if (!token) return
    setCodesLoading(true)
    setCodesError('')
    fetch('/api/admin/invite-codes', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setCodes(d.codes ?? []))
      .catch(() => setCodesError(t.coach.loadError))
      .finally(() => setCodesLoading(false))
  }, [token])

  const loadLogs = useCallback(() => {
    if (!token) return
    setLogsLoading(true)
    setLogsError('')
    fetch('/api/admin/audit-log', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setLogs(d.entries ?? []))
      .catch(() => setLogsError(t.coach.loadError))
      .finally(() => setLogsLoading(false))
  }, [token])

  useEffect(() => { loadUsers() }, [loadUsers])
  useEffect(() => { loadCodes() }, [loadCodes])
  useEffect(() => { loadLogs() }, [loadLogs])

  async function handleGenerateCode() {
    if (!token || generating) return
    setGenerating(true)
    setGenerateError(null)
    setNewCode(null)
    try {
      const res = await fetch('/api/admin/create-invite-code', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) { setGenerateError(data?.error ?? `${t.coach.loadError} (${res.status})`); return }
      setNewCode(data.code)
      loadCodes()
      loadLogs()
    } catch (e) {
      captureError(e, { area: 'admin-create-invite-code' })
      setGenerateError(t.coach.loadError)
    } finally {
      setGenerating(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!token || creating) return
    setCreating(true)
    setCreateError(null)
    setCreateResult(null)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) { setCreateError(data?.error ?? `${t.coach.loadError} (${res.status})`); return }
      setCreateResult({ username: createForm.username, tempPassword: data.tempPassword })
      setCreateForm({ username: '', name: '', email: '' })
      loadUsers()
      loadLogs()
    } catch (e) {
      captureError(e, { area: 'admin-create-user' })
      setCreateError(t.coach.loadError)
    } finally {
      setCreating(false)
    }
  }

  function toggleExpand(u: CoachUser) {
    const opening = expandedId !== u.id
    setExpandedId(opening ? u.id : null)
    setEditForm(null)
    setActionError(null)
    if (opening) { setResetResult(null); setCopied(false) }
  }

  function startEdit(u: CoachUser) {
    setEditForm({ name: u.name, email: u.email })
    setActionError(null)
  }

  function requestSaveEdit(u: CoachUser) {
    if (!editForm) return
    if (!editForm.name.trim() || !ADMIN_EMAIL_RE.test(editForm.email)) return
    setPendingAction({
      type: 'edit', userId: u.id, label: u.name || u.username,
      before: { name: u.name, email: u.email },
      after: { name: editForm.name.trim(), email: editForm.email.trim() },
    })
  }

  async function confirmPendingAction() {
    if (!pendingAction || !token) return
    setActionBusy(true)
    setActionError(null)
    try {
      if (pendingAction.type === 'reset') {
        const res = await fetch('/api/admin/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: pendingAction.userId }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) { setActionError(data?.error ?? `${t.coach.loadError} (${res.status})`); return }
        setResetResult({ userId: pendingAction.userId, tempPassword: data.tempPassword })
        setCopied(false)
      } else if (pendingAction.type === 'delete') {
        const res = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: pendingAction.userId }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) { setActionError(data?.error ?? `${t.coach.loadError} (${res.status})`); return }
        setUsers(u => u.filter(x => x.id !== pendingAction.userId))
        setExpandedId(null)
      } else {
        const res = await fetch('/api/admin/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: pendingAction.userId, ...pendingAction.after }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) { setActionError(data?.error ?? `${t.coach.loadError} (${res.status})`); return }
        setUsers(u => u.map(x => x.id === pendingAction.userId ? { ...x, ...pendingAction.after } : x))
        setEditForm(null)
      }
      setPendingAction(null)
      loadLogs()
    } catch (e) {
      captureError(e, { area: `admin-${pendingAction.type}` })
      setActionError(t.coach.loadError)
    } finally {
      setActionBusy(false)
    }
  }

  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t.coach.searchPlaceholder}
          className="px-3 py-2 rounded-lg bg-warm-800 border border-warm-700 text-warm-100 text-sm placeholder:text-warm-500 focus:outline-none focus:border-brand-500"
        />
        <button
          onClick={() => { setShowCreate(o => !o); setCreateError(null); setCreateResult(null) }}
          className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
        >
          {showCreate ? t.coach.cancelCreate : t.coach.createAccount}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-warm-700 bg-warm-800/40 p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-new-username" className="text-[0.7rem] font-semibold text-warm-500 uppercase tracking-wide">{t.coach.newUsername}</label>
            <input
              id="admin-new-username"
              required
              value={createForm.username}
              onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
              className="px-2.5 py-1.5 rounded-lg bg-warm-800 border border-warm-600 text-warm-100 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-new-name" className="text-[0.7rem] font-semibold text-warm-500 uppercase tracking-wide">{t.coach.newName}</label>
            <input
              id="admin-new-name"
              required
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              className="px-2.5 py-1.5 rounded-lg bg-warm-800 border border-warm-600 text-warm-100 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-new-email" className="text-[0.7rem] font-semibold text-warm-500 uppercase tracking-wide">{t.coach.newEmail}</label>
            <input
              id="admin-new-email"
              type="email"
              value={createForm.email}
              onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
              className="px-2.5 py-1.5 rounded-lg bg-warm-800 border border-warm-600 text-warm-100 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            {creating ? t.coach.creating : t.coach.confirmCreate}
          </button>
          {createError && <span className="text-xs text-red-400 w-full">{createError}</span>}
          {createResult && (
            <div className="w-full rounded-xl border border-brand-600/50 bg-warm-800/60 p-3">
              <p className="text-xs text-warm-400 mb-1.5">{t.coach.accountCreated(createResult.username)}</p>
              <div className="flex items-center gap-2">
                <code className="text-lg font-bold tracking-widest text-brand-300 select-all">{createResult.tempPassword}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(createResult.tempPassword)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 transition-colors"
                >
                  {t.coach.copy}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      <Section title={t.coach.accountsTitle} loading={loading} error={loadError} empty={filtered.length === 0} onRetry={loadUsers}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              <th className={TH}>{t.coach.colPlayer}</th>
              <th className={TH}>{t.coach.newEmail}</th>
              <th className={THR}>{t.coach.colHands}</th>
              <th className={THR}>{t.coach.colAccuracy}</th>
              <th className={THR}>{t.coach.createdAt}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const acc = u.total_hands > 0 && u.correct_hands !== null ? Math.round((u.correct_hands / u.total_hands) * 100) : null
              const isOpen = expandedId === u.id
              const isEditing = isOpen && !!editForm
              return (
                <Fragment key={u.id}>
                  <tr
                    onClick={() => toggleExpand(u)}
                    className={`border-t border-warm-700/60 cursor-pointer transition-colors ${isOpen ? 'bg-warm-800/70' : 'hover:bg-warm-800/50'}`}
                  >
                    <td className={`${TD} text-warm-100 font-semibold`}>
                      <span className={`inline-block w-3 text-warm-600 text-[0.6rem] ${isOpen ? 'text-brand-400' : ''}`}>{isOpen ? '▾' : '▸'}</span>
                      {u.name || u.username}
                    </td>
                    <td className={`${TD} text-warm-400`}>{u.email || '—'}</td>
                    <td className={`${TDR} text-warm-300`}>{u.total_hands}</td>
                    <td className={`${TDR} ${acc !== null ? accColor(acc) : 'text-warm-500'}`}>{acc !== null ? `${acc}%` : '—'}</td>
                    <td className={`${TDR} text-warm-500`}>{formatDateShort(u.created_at)}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <div className="px-4 py-3 space-y-3 bg-warm-900/50 border-t border-warm-700/60" onClick={e => e.stopPropagation()}>
                          {!isEditing ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => startEdit(u)}
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 hover:text-warm-100 transition-colors"
                              >
                                {t.coach.editData}
                              </button>
                              <button
                                onClick={() => setPendingAction({ type: 'reset', userId: u.id, label: u.name || u.username })}
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 hover:text-warm-100 transition-colors"
                              >
                                {t.coach.resetPassword}
                              </button>
                              <button
                                onClick={() => setPendingAction({ type: 'delete', userId: u.id, label: u.name || u.username })}
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-red-900/60 text-red-400 hover:bg-red-950/40 transition-colors"
                              >
                                {t.coach.deleteAccount}
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-end gap-3">
                              <div className="flex flex-col gap-1">
                                <label htmlFor={`admin-edit-name-${u.id}`} className="text-[0.7rem] font-semibold text-warm-500 uppercase tracking-wide">{t.coach.newName}</label>
                                <input
                                  id={`admin-edit-name-${u.id}`}
                                  value={editForm.name}
                                  onChange={e => setEditForm(f => f && ({ ...f, name: e.target.value }))}
                                  className="px-2.5 py-1.5 rounded-lg bg-warm-800 border border-warm-600 text-warm-100 text-sm focus:outline-none focus:border-brand-500"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label htmlFor={`admin-edit-email-${u.id}`} className="text-[0.7rem] font-semibold text-warm-500 uppercase tracking-wide">{t.coach.newEmail}</label>
                                <input
                                  id={`admin-edit-email-${u.id}`}
                                  type="email"
                                  value={editForm.email}
                                  onChange={e => setEditForm(f => f && ({ ...f, email: e.target.value }))}
                                  className="px-2.5 py-1.5 rounded-lg bg-warm-800 border border-warm-600 text-warm-100 text-sm focus:outline-none focus:border-brand-500"
                                />
                              </div>
                              <button
                                onClick={() => requestSaveEdit(u)}
                                disabled={!editForm.name.trim() || !ADMIN_EMAIL_RE.test(editForm.email)}
                                className="px-3 py-1.5 text-xs rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-semibold transition-colors"
                              >
                                {t.coach.saveChanges}
                              </button>
                              <button
                                onClick={() => setEditForm(null)}
                                className="px-3 py-1.5 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 transition-colors"
                              >
                                {t.coach.cancelEdit}
                              </button>
                            </div>
                          )}
                          {actionError && <p className="text-xs text-red-400">{actionError}</p>}
                          {resetResult?.userId === u.id && (
                            <div className="rounded-xl border border-brand-600/50 bg-warm-800/60 p-3 inline-flex items-center gap-2">
                              <span className="text-xs text-warm-400">{t.coach.tempPassword}</span>
                              <code className="text-lg font-bold tracking-widest text-brand-300 select-all">{resetResult.tempPassword}</code>
                              <button
                                onClick={() => { navigator.clipboard?.writeText(resetResult.tempPassword); setCopied(true) }}
                                className="px-2.5 py-1 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-700 transition-colors"
                              >
                                {copied ? t.coach.copied : t.coach.copy}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </Section>

      <Section title={t.coach.inviteCodesTitle} loading={codesLoading} error={codesError} empty={false} onRetry={loadCodes} defaultOpen={false}>
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerateCode}
              disabled={generating}
              className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {generating ? t.coach.generating : t.coach.generateCode}
            </button>
            {generateError && <span className="text-xs text-red-400">{generateError}</span>}
            {newCode && (
              <div className="rounded-xl border border-brand-600/50 bg-warm-800/60 px-3 py-1.5 inline-flex items-center gap-2">
                <code className="text-base font-bold tracking-widest text-brand-300 select-all">{newCode}</code>
                <button
                  onClick={() => navigator.clipboard?.writeText(newCode)}
                  className="px-2 py-0.5 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-700 transition-colors"
                >
                  {t.coach.copy}
                </button>
              </div>
            )}
          </div>
          {codes.length === 0 ? <p className="text-sm text-warm-500">{t.coach.noData}</p> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
                  <th className={TH}>{t.coach.colCode}</th>
                  <th className={TH}>{t.coach.colStatus}</th>
                  <th className={THR}>{t.coach.createdAt}</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.id} className="border-t border-warm-700/60">
                    <td className={`${TD} font-mono text-warm-100 font-semibold tracking-wide`}>{c.code}</td>
                    <td className={`${TD}`}>
                      {c.used_by_id ? (
                        <span className="text-warm-300">{t.coach.codeUsedBy(c.used_by_name || c.used_by_username || '')}</span>
                      ) : (
                        <span className="text-warm-500">{t.coach.codeUnused}</span>
                      )}
                    </td>
                    <td className={`${TDR} text-warm-500`}>{formatDateShort(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Section title={t.coach.auditLogTitle} loading={logsLoading} error={logsError} empty={logs.length === 0} onRetry={loadLogs} defaultOpen={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              <th className={TH}>{t.coach.colAction}</th>
              <th className={TH}>{t.coach.colActor}</th>
              <th className={TH}>{t.coach.colTargetAccount}</th>
              <th className={THR}>{t.coach.createdAt}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-t border-warm-700/60">
                <td className={`${TD} text-warm-100 font-semibold`}>{AUDIT_ACTION_LABEL[l.action] ?? l.action}</td>
                <td className={`${TD} text-warm-300`}>{l.actor_name || l.actor_username}</td>
                <td className={`${TD} text-warm-400`}>{l.target_name || l.target_username || '—'}</td>
                <td className={`${TDR} text-warm-500`}>{formatDateShort(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {pendingAction && (
        <ConfirmDangerModal
          title={
            pendingAction.type === 'reset' ? t.coach.confirmResetTitle
              : pendingAction.type === 'delete' ? t.coach.confirmDeleteTitle
              : t.coach.confirmEditTitle
          }
          danger={pendingAction.type !== 'edit'}
          confirmLabel={
            pendingAction.type === 'reset' ? t.coach.resetPassword
              : pendingAction.type === 'delete' ? t.coach.deleteAccount
              : t.coach.saveChanges
          }
          busy={actionBusy}
          error={actionError}
          onCancel={() => { setPendingAction(null); setActionError(null) }}
          onConfirm={confirmPendingAction}
          description={
            pendingAction.type === 'reset' ? <p>{t.coach.confirmResetDesc(pendingAction.label)}</p>
              : pendingAction.type === 'delete' ? <p>{t.coach.confirmDeleteDesc(pendingAction.label)}</p>
              : (
                <div className="space-y-1">
                  {pendingAction.before.name !== pendingAction.after.name && (
                    <p>{t.coach.newName}: <span className="text-warm-500 line-through">{pendingAction.before.name}</span> → <span className="text-warm-100 font-semibold">{pendingAction.after.name}</span></p>
                  )}
                  {pendingAction.before.email !== pendingAction.after.email && (
                    <p>{t.coach.newEmail}: <span className="text-warm-500 line-through">{pendingAction.before.email}</span> → <span className="text-warm-100 font-semibold">{pendingAction.after.email}</span></p>
                  )}
                </div>
              )
          }
        />
      )}
    </div>
  )
}
