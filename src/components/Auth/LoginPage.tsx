import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { RangeMark } from '../ui/RangeMark'

export function LoginPage() {
  const login         = useStore(s => s.login)
  const enterAsVisitor = useStore(s => s.enterAsVisitor)

  const [password, setPassword] = useState('')
  const [status, setStatus]     = useState<'idle' | 'loading' | 'wrong' | 'error'>('idle')

  async function handleLogin() {
    if (!password) return
    setStatus('loading')
    const result = await login(password)
    if (result === 'ok') return
    setStatus(result === 'wrong_password' ? 'wrong' : 'error')
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
          <div className="space-y-2">
            <label className="text-xs text-warm-400 block">Senha de admin</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setStatus('idle') }}
              placeholder="••••••••"
              className="w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-warm-600 focus:outline-none focus:border-brand-500"
              onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
            />
          </div>

          {status === 'wrong' && (
            <p className="text-xs text-red-400">Senha incorreta.</p>
          )}
          {status === 'error' && (
            <p className="text-xs text-red-400">Erro ao conectar. Tente novamente.</p>
          )}

          <button
            onClick={handleLogin}
            disabled={!password || status === 'loading'}
            className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {status === 'loading' ? 'Entrando...' : 'Entrar como Admin'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-warm-700/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-warm-900 px-3 text-xs text-warm-500">ou</span>
            </div>
          </div>

          <button
            onClick={enterAsVisitor}
            className="w-full py-2.5 rounded-xl border border-warm-700 hover:border-warm-500 hover:bg-warm-800 text-warm-400 hover:text-white text-sm font-semibold transition-colors"
          >
            Entrar como Visitante
          </button>
        </div>
      </div>
    </div>
  )
}
