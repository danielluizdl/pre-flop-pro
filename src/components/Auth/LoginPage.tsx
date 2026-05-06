import { useState } from 'react'
import { useStore } from '../../store/useStore'

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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4 font-black text-white text-xl">
            PF
          </div>
          <h1 className="text-2xl font-black text-white">
            Pre-Flop<span className="text-brand-400">Pro</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Treine seus ranges pré-flop</p>
        </div>

        <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-gray-400 block">Senha de admin</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setStatus('idle') }}
              placeholder="••••••••"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
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
              <div className="w-full border-t border-gray-700/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-900 px-3 text-xs text-gray-500">ou</span>
            </div>
          </div>

          <button
            onClick={enterAsVisitor}
            className="w-full py-2.5 rounded-xl border border-gray-700 hover:border-gray-500 hover:bg-gray-800 text-gray-400 hover:text-white text-sm font-semibold transition-colors"
          >
            Entrar como Visitante
          </button>
        </div>
      </div>
    </div>
  )
}
