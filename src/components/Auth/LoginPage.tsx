import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { RangeMark } from '../ui/RangeMark'
import { Turnstile, turnstileEnabled } from './Turnstile'
import { LanguageSelect } from '../Layout/LanguageSelect'
import { t } from '../../i18n'

type View = 'login' | 'signup' | 'forgot'
type Tier = 'fundamentals' | 'evolution' | 'metamorphosis' | 'main'
type Turma = 'A' | 'B' | 'C' | 'D'

const INPUT_CLASS = 'w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2.5 text-sm text-warm-100 placeholder-warm-600 focus:outline-none focus:border-brand-500'
const TURMAS: Turma[] = ['A', 'B', 'C', 'D']

export function capitalizeWords(s: string): string {
  return s.replace(/(^|\s)(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase())
}

function PasswordInput({ id, value, onChange, onEnter }: {
  id: string
  value: string
  onChange: (v: string) => void
  onEnter: () => void
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="••••••••"
        className={`${INPUT_CLASS} pr-10`}
        onKeyDown={e => { if (e.key === 'Enter') onEnter() }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-500 hover:text-warm-200 transition-colors"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

export function LoginPage() {
  const authLogin  = useStore(s => s.authLogin)
  const authSignup = useStore(s => s.authSignup)

  const [view, setView]         = useState<View>('login')
  const [username, setUsername] = useState('')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [tier, setTier]         = useState<Tier | ''>('')
  const [turma, setTurma]       = useState<Turma | ''>('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [tsToken, setTsToken]   = useState<string | null>(null)

  const tsReady = !turnstileEnabled || !!tsToken
  const tierReady = !!tier && (tier === 'main' || !!turma)
  const canSubmit = !!username && !!password
    && (view !== 'signup' || (!!inviteCode && !!name && !!email && !!confirmPassword && tierReady))
    && tsReady

  const TIERS: { key: Tier; label: string }[] = [
    { key: 'fundamentals', label: t.auth.tierFundamentals },
    { key: 'evolution', label: t.auth.tierEvolution },
    { key: 'metamorphosis', label: t.auth.tierMetamorphosis },
    { key: 'main', label: t.auth.tierMain },
  ]

  async function handleSubmit() {
    if (!canSubmit || loading) return
    if (view === 'signup') {
      if (username.length < 6) { setError(t.auth.errors.usernameMin); return }
      if (password.length < 6) { setError(t.auth.errors.passwordMin); return }
      if (password !== confirmPassword) { setError(t.auth.errors.passwordMismatch); return }
      if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(email)) { setError(t.auth.errors.invalidEmail); return }
      if (!tier) { setError(t.auth.errors.tierRequired); return }
      if (tier !== 'main' && !turma) { setError(t.auth.errors.turmaRequired); return }
    }
    setLoading(true)
    setError('')
    const result = view === 'login'
      ? await authLogin(username, password, tsToken)
      : await authSignup(username, password, inviteCode, name, email, tier as Tier, tier === 'main' ? null : (turma as Turma), tsToken)
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
                      onChange={e => { setName(capitalizeWords(e.target.value)); setError('') }}
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
                <PasswordInput
                  id="lp-password"
                  value={password}
                  onChange={v => { setPassword(v); setError('') }}
                  onEnter={handleSubmit}
                />
              </div>

              {view === 'signup' && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="lp-confirm-password" className="text-xs text-warm-400 block">{t.auth.confirmPasswordLabel}</label>
                    <PasswordInput
                      id="lp-confirm-password"
                      value={confirmPassword}
                      onChange={v => { setConfirmPassword(v); setError('') }}
                      onEnter={handleSubmit}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="lp-invitecode" className="text-xs text-warm-400 block">{t.auth.inviteCodeLabel}</label>
                    <input
                      id="lp-invitecode"
                      type="text"
                      value={inviteCode}
                      onChange={e => { setInviteCode(e.target.value); setError('') }}
                      className={INPUT_CLASS}
                      onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-warm-400 block">{t.auth.tierLabel}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {TIERS.map(tr => (
                        <button
                          key={tr.key}
                          type="button"
                          onClick={() => { setTier(tr.key); if (tr.key === 'main') setTurma(''); setError('') }}
                          className={[
                            'px-3 py-2 rounded-lg text-xs font-semibold border transition-colors text-center',
                            tier === tr.key
                              ? 'bg-brand-600 border-brand-500 text-white'
                              : 'bg-warm-800 border-warm-600 text-warm-400 hover:border-warm-500 hover:text-warm-200',
                          ].join(' ')}
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
                            onClick={() => { setTurma(letter); setError('') }}
                            className={[
                              'flex-1 px-3 py-2 rounded-lg text-sm font-bold border transition-colors',
                              turma === letter
                                ? 'bg-brand-600 border-brand-500 text-white'
                                : 'bg-warm-800 border-warm-600 text-warm-400 hover:border-warm-500 hover:text-warm-200',
                            ].join(' ')}
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
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
