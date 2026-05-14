import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { LogOut } from 'lucide-react'

const PUBLISHED_HASH_KEY = 'pfp-last-published-hash'

interface Props {
  open?: boolean
  onClose?: () => void
}

export function AdminPanel({ open: externalOpen, onClose: externalClose }: Props = {}) {
  const ranges          = useStore(s => s.ranges)
  const adminSaveRanges = useStore(s => s.adminSaveRanges)
  const logout          = useStore(s => s.logout)

  const [internalOpen, setInternalOpen]       = useState(false)
  const [password, setPassword]               = useState('')
  const [status, setStatus]                   = useState<'idle' | 'loading' | 'ok' | 'wrong' | 'error'>('idle')
  const [publishedHash, setPublishedHash]     = useState(() => localStorage.getItem(PUBLISHED_HASH_KEY) ?? '')

  const controlled  = externalOpen !== undefined
  const isOpen      = controlled ? externalOpen : internalOpen

  const currentHash = JSON.stringify(ranges)
  const isPublished = !!publishedHash && publishedHash === currentHash

  async function handlePublish() {
    if (!password || isPublished) return
    setStatus('loading')
    const result = await adminSaveRanges(password)
    if (result === 'ok') {
      localStorage.setItem(PUBLISHED_HASH_KEY, currentHash)
      setPublishedHash(currentHash)
      setStatus('ok')
    } else {
      setStatus(result === 'wrong_password' ? 'wrong' : 'error')
    }
  }

  function handleClose() {
    if (controlled) {
      externalClose?.()
    } else {
      setInternalOpen(false)
    }
    setStatus('idle')
    setPassword('')
  }

  return (
    <>
      {/* Botão interno — usado apenas no modo não-controlado (ex: sidebar) */}
      {!controlled && (
        <div className="flex gap-1">
          <button
            onClick={() => setInternalOpen(true)}
            className="flex-1 flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-warm-600 hover:bg-warm-800 hover:text-warm-400 transition-all"
            title="Publicar ranges"
          >
            Publicar
          </button>
          <button
            onClick={logout}
            className="flex items-center px-2 py-2.5 rounded-lg text-sm text-warm-600 hover:bg-warm-800 hover:text-warm-400 transition-all"
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <div
            className="bg-warm-900 border border-warm-700 rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white">Publicar Ranges</h3>
              <button onClick={handleClose} className="text-warm-400 hover:text-white text-xl">✕</button>
            </div>

            <p className="text-xs text-warm-400">
              Envia todos os {ranges.length} ranges atuais como padrão nativo. Aguarde ~2 min para o deploy.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-warm-400 block">Confirme a senha</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setStatus('idle') }}
                placeholder="••••••••"
                className="w-full bg-warm-800 border border-warm-600 rounded-lg px-3 py-2 text-sm text-white placeholder-warm-600 focus:outline-none focus:border-brand-500"
                onKeyDown={e => { if (e.key === 'Enter') handlePublish() }}
                autoFocus
              />
            </div>

            {status === 'ok' && (
              <p className="text-xs text-emerald-400 font-semibold">
                Publicado. Aguarde ~2 min para o deploy entrar no ar.
              </p>
            )}
            {status === 'wrong' && (
              <p className="text-xs text-red-400">Senha incorreta.</p>
            )}
            {status === 'error' && (
              <p className="text-xs text-red-400">Erro ao publicar. Tente novamente.</p>
            )}

            <button
              onClick={handlePublish}
              disabled={!password || status === 'loading' || isPublished}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {status === 'loading' ? 'Publicando...' : isPublished ? 'Publicado' : 'Publicar'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
