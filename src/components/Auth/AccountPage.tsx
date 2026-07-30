import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { t, dateLocale } from '../../i18n'
import type { DeviceSession } from '../../types'

type Tier = 'fundamentals' | 'evolution' | 'metamorphosis' | 'main'
type Turma = 'A' | 'B' | 'C' | 'D'

const INPUT_CLASS = 'w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2.5 text-sm text-warm-100 placeholder-warm-600 focus:outline-none focus:border-brand-500'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TURMAS: Turma[] = ['A', 'B', 'C', 'D']

function optionCls(active: boolean): string {
  return [
    'px-3 py-2 rounded-lg text-xs font-semibold border transition-colors text-center',
    active
      ? 'bg-brand-600 border-brand-500 text-white'
      : 'bg-warm-800 border-warm-600 text-warm-400 hover:border-warm-500 hover:text-warm-200',
  ].join(' ')
}

function formatDate(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString(dateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString(dateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function DevicesSection() {
  const listDevices = useStore(s => s.listDevices)
  const revokeDevice = useStore(s => s.revokeDevice)
  const revokeOtherDevices = useStore(s => s.revokeOtherDevices)
  const [devices, setDevices] = useState<DeviceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const res = await listDevices()
    if (res.ok) { setDevices(res.devices ?? []); setError(false) }
    else setError(true)
    setLoading(false)
  }, [listDevices])

  useEffect(() => { void reload() }, [reload])

  const handleRevoke = async (id: number) => {
    setBusy(true)
    await revokeDevice(id)
    await reload()
    setBusy(false)
  }

  const handleRevokeOthers = async () => {
    setBusy(true)
    await revokeOtherDevices()
    await reload()
    setBusy(false)
  }

  const others = devices.filter(d => !d.current).length

  return (
    <div className="space-y-4 bg-warm-900 border border-warm-700/50 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-100">{t.myAccount.activeSessions}</h2>
        {others > 0 && (
          <button
            onClick={handleRevokeOthers}
            disabled={busy}
            className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {t.myAccount.endOthers(others)}
          </button>
        )}
      </div>
      {loading ? (
        <p className="text-warm-500 text-sm">{t.myAccount.loadingSessions}</p>
      ) : error ? (
        <p className="text-red-400 text-sm">
          {t.myAccount.sessionsLoadError}{' '}
          <button onClick={() => { setLoading(true); void reload() }} className="underline font-semibold hover:text-red-300">{t.common.retry}</button>
        </p>
      ) : devices.length === 0 ? (
        <p className="text-warm-500 text-sm">{t.myAccount.noActiveSessions}</p>
      ) : (
        <ul className="rounded-xl border border-warm-700 divide-y divide-warm-700/60">
          {devices.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm text-warm-100 font-semibold flex items-center gap-2">
                  {t.myAccount.session(d.id)}
                  {d.current && <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">{t.myAccount.thisSession}</span>}
                </div>
                <div className="text-xs text-warm-500">{t.myAccount.startedExpires(formatDateTime(d.createdAt), formatDate(d.expiresAt))}</div>
              </div>
              {!d.current && (
                <button
                  onClick={() => handleRevoke(d.id)}
                  disabled={busy}
                  className="shrink-0 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {t.myAccount.end}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AccountPage() {
  const currentUser     = useStore(s => s.currentUser)
  const setPage         = useStore(s => s.setPage)
  const updateMyAccount = useStore(s => s.updateMyAccount)
  const changePassword  = useStore(s => s.changePassword)

  const TIERS: { key: Tier; label: string }[] = [
    { key: 'fundamentals', label: t.auth.tierFundamentals },
    { key: 'evolution', label: t.auth.tierEvolution },
    { key: 'metamorphosis', label: t.auth.tierMetamorphosis },
    { key: 'main', label: t.auth.tierMain },
  ]

  const [name, setName]   = useState(currentUser?.name ?? '')
  const [email, setEmail] = useState(currentUser?.email ?? '')
  const [tier, setTier]   = useState<Tier | ''>((currentUser?.tier as Tier) || '')
  const [turma, setTurma] = useState<Turma | ''>((currentUser?.turma as Turma) || '')
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving]   = useState(false)

  const [newPassword, setNewPassword]   = useState('')
  const [confirmPassword, setConfirmPw] = useState('')
  const [pwError, setPwError]     = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwSaving, setPwSaving]   = useState(false)

  if (!currentUser) return null

  function clearFieldFeedback() {
    setError('')
    setSuccess('')
  }

  async function handleSave() {
    clearFieldFeedback()
    if (!name.trim()) { setError(t.account.errors.name); return }
    if (!EMAIL_RE.test(email)) { setError(t.account.errors.email); return }
    if (!tier) { setError(t.auth.errors.tierRequired); return }
    if (tier !== 'main' && !turma) { setError(t.auth.errors.turmaRequired); return }
    setSaving(true)
    const result = await updateMyAccount(name.trim(), email.trim(), tier, tier === 'main' ? null : turma)
    setSaving(false)
    if (!result.ok) setError(result.error ?? t.auth.errors.unexpected)
    else setSuccess(t.account.saveSuccess)
  }

  async function handleChangePassword() {
    setPwError('')
    setPwSuccess('')
    if (newPassword.length < 8) { setPwError(t.changePassword.errors.min); return }
    if (newPassword !== confirmPassword) { setPwError(t.changePassword.errors.mismatch); return }
    setPwSaving(true)
    const result = await changePassword(newPassword)
    setPwSaving(false)
    if (!result.ok) setPwError(result.error ?? t.auth.errors.unexpected)
    else { setPwSuccess(t.account.saveSuccess); setNewPassword(''); setConfirmPw('') }
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pt-2">
      <div>
        <button
          onClick={() => setPage('dashboard')}
          className="text-xs text-warm-400 hover:text-warm-200 mb-2 transition-colors"
        >
          {t.account.back}
        </button>
        <h1 className="font-display uppercase text-warm-100 text-[28px] leading-none tracking-wide">{t.account.title}</h1>
        <p className="text-xs text-warm-400 mt-0.5">{t.account.subtitle}</p>
      </div>

      <div className="space-y-4 bg-warm-900 border border-warm-700/50 rounded-2xl p-5">
        <div>
          <span className="text-xs text-warm-400 block mb-1">{t.account.usernameLabel}</span>
          <p className="text-sm text-warm-300 px-3 py-2.5 bg-warm-800/50 rounded-lg">{currentUser.username}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="acc-name" className="text-xs text-warm-400 block">{t.account.nameLabel}</label>
          <input
            id="acc-name"
            value={name}
            onChange={e => { setName(e.target.value); clearFieldFeedback() }}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="acc-email" className="text-xs text-warm-400 block">{t.account.emailLabel}</label>
          <input
            id="acc-email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); clearFieldFeedback() }}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-warm-400 block">{t.auth.tierLabel}</label>
          <div className="grid grid-cols-2 gap-2">
            {TIERS.map(tr => (
              <button
                key={tr.key}
                type="button"
                onClick={() => { setTier(tr.key); if (tr.key === 'main') setTurma(''); clearFieldFeedback() }}
                className={optionCls(tier === tr.key)}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>

        {!!tier && tier !== 'main' && (
          <div className="space-y-2">
            <label className="text-xs text-warm-400 block">{t.auth.turmaLabel}</label>
            <div className="flex gap-2">
              {TURMAS.map(letter => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => { setTurma(letter); clearFieldFeedback() }}
                  className={['flex-1', optionCls(turma === letter)].join(' ')}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}

        {!!error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {!!success && <p className="text-xs text-emerald-400">{success}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {saving ? t.account.saving : t.account.save}
        </button>
      </div>

      <div className="space-y-4 bg-warm-900 border border-warm-700/50 rounded-2xl p-5">
        <div>
          <h2 className="text-lg font-semibold text-warm-100">{t.account.passwordTitle}</h2>
          <p className="text-xs text-warm-400">{t.account.passwordSubtitle}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="acc-newpw" className="text-xs text-warm-400 block">{t.changePassword.newPassword}</label>
          <input
            id="acc-newpw"
            type="password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setPwError(''); setPwSuccess('') }}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="acc-confirmpw" className="text-xs text-warm-400 block">{t.changePassword.confirmPassword}</label>
          <input
            id="acc-confirmpw"
            type="password"
            value={confirmPassword}
            onChange={e => { setConfirmPw(e.target.value); setPwError(''); setPwSuccess('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleChangePassword() }}
            className={INPUT_CLASS}
          />
        </div>

        {!!pwError && <p role="alert" className="text-xs text-red-400">{pwError}</p>}
        {!!pwSuccess && <p className="text-xs text-emerald-400">{pwSuccess}</p>}

        <button
          onClick={handleChangePassword}
          disabled={pwSaving || !newPassword || !confirmPassword}
          className="w-full py-2.5 rounded-xl bg-warm-700 hover:bg-warm-600 disabled:opacity-40 disabled:cursor-not-allowed text-warm-100 text-sm font-semibold transition-colors"
        >
          {pwSaving ? t.changePassword.submitting : t.changePassword.submit}
        </button>
      </div>

      <DevicesSection />
    </div>
  )
}
