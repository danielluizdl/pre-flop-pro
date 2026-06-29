import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { useModalA11y } from '../../utils/useModalA11y'
import { t } from '../../i18n'

export function ChangePasswordModal() {
  const changePassword = useStore(s => s.changePassword)
  const dialogRef = useModalA11y<HTMLDivElement>(true)

  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm]         = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  async function handleSubmit() {
    if (newPassword.length < 8) {
      setError(t.changePassword.errors.min)
      return
    }
    if (newPassword !== confirm) {
      setError(t.changePassword.errors.mismatch)
      return
    }
    setLoading(true)
    setError('')
    const result = await changePassword(newPassword)
    setLoading(false)
    if (!result.ok) setError(result.error ?? t.auth.errors.unexpected)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div ref={dialogRef} className="w-full max-w-sm bg-warm-900 border border-warm-700/50 rounded-2xl p-6 space-y-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
        <h2 id="change-password-title" className="text-lg font-semibold text-white">{t.changePassword.title}</h2>
        <p className="text-xs text-warm-400">{t.changePassword.subtitle}</p>

        <div className="space-y-2">
          <label htmlFor="cpm-new" className="text-xs text-warm-400 block">{t.changePassword.newPassword}</label>
          <input
            id="cpm-new"
            type="password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setError('') }}
            className="w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-warm-600 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="cpm-confirm" className="text-xs text-warm-400 block">{t.changePassword.confirmPassword}</label>
          <input
            id="cpm-confirm"
            type="password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError('') }}
            className="w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-warm-600 focus:outline-none focus:border-brand-500"
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          />
        </div>

        {!!error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !newPassword || !confirm}
          className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {loading ? t.changePassword.submitting : t.changePassword.submit}
        </button>
      </div>
    </div>
  )
}
