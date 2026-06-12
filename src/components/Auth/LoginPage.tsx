import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { RangeMark } from '../ui/RangeMark'

type View = 'login' | 'signup' | 'forgot'

const INPUT_CLASS = 'w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-warm-600 focus:outline-none focus:border-brand-500'

export function LoginPage() {
  const authLogin  = useStore(s => s.authLogin)
  const authSignup = useStore(s => s.authSignup)

  const [view, setView]         = useState<View>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [teamCode, setTeamCode] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const canSubmit = !!username && !!password && (view !== 'signup' || !!teamCode)

  async function handleSubmit() {
    if (!canSubmit || loading) return
    setLoading(true)
    setError('')
    const result = view === 'login'
      ? await authLogin(username, password)
      : await authSignup(username, password, teamCode)
    setLoading(false)
    if (!result.ok) setError(result.error ?? 'Erro inesperado')
  }

  function switchView(next: View) {
    setView(next)
    setError('')
  }

  return (
    <div className="min-h-screen bg-warm-950 flex items-center justify-center p-4">
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
          <p className="text-warm-500 text-sm mt-4">Treine seus ranges pré-flop</p>
        </div>

        <div className="bg-warm-900 border border-warm-700/50 rounded-2xl p-6 space-y-4">
          {view === 'forgot' ? (
            <>
              <h2 className="text-base font-semibold text-white">Esqueci minha senha</h2>
              <p className="text-sm text-warm-400">
                Peça ao coach do seu time para resetar sua senha. Você receberá uma senha temporária e vai definir uma nova no próximo login.
              </p>
              <button
                onClick={() => switchView('login')}
                className="w-full py-2.5 rounded-xl border border-warm-700 hover:border-warm-500 hover:bg-warm-800 text-warm-400 hover:text-white text-sm font-semibold transition-colors"
              >
                Voltar
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs text-warm-400 block">Usuário</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError('') }}
                  className={INPUT_CLASS}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-warm-400 block">Senha</label>
                <input
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
                  <label className="text-xs text-warm-400 block">Código do time</label>
                  <input
                    type="text"
                    value={teamCode}
                    onChange={e => { setTeamCode(e.target.value); setError('') }}
                    className={INPUT_CLASS}
                    onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                  />
                </div>
              )}

              {!!error && <p className="text-xs text-red-400">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {loading ? 'Aguarde...' : view === 'login' ? 'Entrar' : 'Criar conta'}
              </button>

              {view === 'login' ? (
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => switchView('signup')}
                    className="text-xs text-warm-400 hover:text-warm-100 transition-colors"
                  >
                    Criar conta
                  </button>
                  <button
                    onClick={() => switchView('forgot')}
                    className="text-xs text-warm-400 hover:text-warm-100 transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              ) : (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => switchView('login')}
                    className="text-xs text-warm-400 hover:text-warm-100 transition-colors"
                  >
                    Já tenho conta — entrar
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
