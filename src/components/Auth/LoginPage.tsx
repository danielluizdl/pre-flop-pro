import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { RangeMark } from '../ui/RangeMark'
import { Turnstile, turnstileEnabled } from './Turnstile'
import { LanguageSelect } from '../Layout/LanguageSelect'
import { t } from '../../i18n'

type View = 'login' | 'signup' | 'forgot'

const INPUT_CLASS = 'w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2.5 text-sm text-warm-100 placeholder-warm-600 focus:outline-none focus:border-brand-500'

export function LoginPage() {
  const authLogin  = useStore(s => s.authLogin)
  const authSignup = useStore(s => s.authSignup)

  const [view, setView]         = useState<View>('login')
  const [username, setUsername] = useState('')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [teamCode, setTeamCode] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [tsToken, setTsToken]   = useState<string | null>(null)

  const tsReady = !turnstileEnabled || !!tsToken
  const canSubmit = !!username && !!password && (view !== 'signup' || (!!teamCode && !!name && !!email)) && tsReady

  async function handleSubmit() {
    if (!canSubmit || loading) return
    if (view === 'signup') {
      if (username.length < 6) { setError(t.auth.errors.usernameMin); return }
      if (password.length < 8) { setError(t.auth.errors.passwordMin); return }
      if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(email)) { setError(t.auth.errors.invalidEmail); return }
    }
    setLoading(true)
    setError('')
    const result = view === 'login'
      ? await authLogin(username, password, tsToken)
      : await authSignup(username, password, teamCode, name, email, tsToken)
    setLoading(false)
    if (!result.ok) setError(result.error ?? t.auth.errors.unexpected)
  }

  function switchView(next: View) {
    setView(next)
    setError('')
    setTsToken(null)
  }

  return (
    <div className="min-h-screen bg-warm-950 flex items-center justify-center p-4">
      <div className="absolute top-3 right-3">
        <LanguageSelect />
      </div>
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3">
            <RangeMark size={56} />
            <span
              className="text-warm-100 tracking-tight whitespace-nowrap"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: '44px', lineHeight: 1 }}
            >
              Pre-Flop <em className="not-italic" style={{ color: '#d97757' }}>Pro</em>
            </span>
          </div>
          <p className="text-warm-500 text-sm mt-4">{t.auth.tagline}</p>
        </div>

        <div className="bg-warm-900 border border-warm-700/50 rounded-2xl p-6 space-y-4">
          {view === 'forgot' ? (
            <>
              <h2 className="text-base font-semibold text-warm-100">{t.auth.forgotTitle}</h2>
              <p className="text-sm text-warm-400">
                {t.auth.forgotBody}
              </p>
              <button
                onClick={() => switchView('login')}
                className="w-full py-2.5 rounded-xl border border-warm-700 hover:border-warm-500 hover:bg-warm-800 text-warm-400 hover:text-warm-100 text-sm font-semibold transition-colors"
              >
                {t.common.back}
              </button>
            </>
          ) : (
            <>
              {view === 'signup' && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="lp-name" className="text-xs text-warm-400 block">{t.auth.fullName}</label>
                    <input
                      id="lp-name"
                      type="text"
                      value={name}
                      onChange={e => { setName(e.target.value); setError('') }}
                      className={INPUT_CLASS}
                      onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lp-email" className="text-xs text-warm-400 block">{t.auth.emailLabel}</label>
                    <input
                      id="lp-email"
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError('') }}
                      className={INPUT_CLASS}
                      onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label htmlFor="lp-username" className="text-xs text-warm-400 block">{t.auth.usernameLabel}</label>
                <input
                  id="lp-username"
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError('') }}
                  className={INPUT_CLASS}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="lp-password" className="text-xs text-warm-400 block">{t.auth.passwordLabel}</label>
                <input
                  id="lp-password"
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className={INPUT_CLASS}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                />
              </div>

              {view === 'signup' && (
                <div className="space-y-2">
                  <label htmlFor="lp-teamcode" className="text-xs text-warm-400 block">{t.auth.teamCodeLabel}</label>
                  <input
                    id="lp-teamcode"
                    type="text"
                    value={teamCode}
                    onChange={e => { setTeamCode(e.target.value); setError('') }}
                    className={INPUT_CLASS}
                    onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                  />
                </div>
              )}

              {turnstileEnabled && (
                <div className="pt-1">
                  <Turnstile onToken={setTsToken} />
                </div>
              )}

              {!!error && <p className="text-xs text-red-400">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {loading ? t.common.wait : view === 'login' ? t.auth.login : t.auth.createAccount}
              </button>

              {view === 'login' ? (
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => switchView('signup')}
                    className="text-xs text-warm-400 hover:text-warm-100 transition-colors"
                  >
                    {t.auth.createAccount}
                  </button>
                  <button
                    onClick={() => switchView('forgot')}
                    className="text-xs text-warm-400 hover:text-warm-100 transition-colors"
                  >
                    {t.auth.forgotPassword}
                  </button>
                </div>
              ) : (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => switchView('login')}
                    className="text-xs text-warm-400 hover:text-warm-100 transition-colors"
                  >
                    {t.auth.haveAccount}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
