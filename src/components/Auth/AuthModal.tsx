import { useState } from 'react'
import { useStore } from '../../store/useStore'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const authLogin  = useStore(s => s.authLogin)
  const authSignup = useStore(s => s.authSignup)

  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [teamCode, setTeamCode] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  if (!isOpen) return null

  async function handleSubmit() {
    if (!username || !password || (tab === 'signup' && !teamCode)) return
    setLoading(true)
    setError('')
    const result = tab === 'login'
      ? await authLogin(username, password)
      : await authSignup(username, password, teamCode)
    setLoading(false)
    if (result.ok) {
      setUsername(''); setPassword(''); setTeamCode('')
      onClose()
    } else {
      setError(result.error ?? 'Erro inesperado')
    }
  }

  function switchTab(next: 'login' | 'signup') {
    setTab(next)
    setError('')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-warm-900 border border-warm-700/50 rounded-2xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex gap-1 bg-warm-800 rounded-xl p-1">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'login' ? 'bg-warm-900 text-white' : 'text-warm-400 hover:text-warm-200'}`}
          >
            Entrar
          </button>
          <button
            onClick={() => switchTab('signup')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'signup' ? 'bg-warm-900 text-white' : 'text-warm-400 hover:text-warm-200'}`}
          >
            Criar conta
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-warm-400 block">Usuário</label>
          <input
            type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); setError('') }}
            className="w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-warm-600 focus:outline-none focus:border-brand-500"
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-warm-400 block">Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            className="w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-warm-600 focus:outline-none focus:border-brand-500"
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          />
        </div>

        {tab === 'signup' && (
          <div className="space-y-2">
            <label className="text-xs text-warm-400 block">Código do time</label>
            <input
              type="text"
              value={teamCode}
              onChange={e => { setTeamCode(e.target.value); setError('') }}
              className="w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-warm-600 focus:outline-none focus:border-brand-500"
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
            />
          </div>
        )}

        {!!error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !username || !password || (tab === 'signup' && !teamCode)}
          className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {loading ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </div>
    </div>
  )
}
