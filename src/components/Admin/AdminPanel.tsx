import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { validateRanges } from '../../utils/validateRanges'
import { djb2 } from '../../utils/hash'
import { useModalA11y } from '../../utils/useModalA11y'
import { LogOut } from 'lucide-react'

const PUBLISHED_HASH_KEY = 'pfp-last-published-hash'

// Versões antigas guardavam o JSON inteiro dos ranges nesta chave (megabytes).
// Se o valor armazenado não parecer um hash djb2 curto, descarta para liberar storage.
function loadPublishedHash(): string {
  const stored = localStorage.getItem(PUBLISHED_HASH_KEY) ?? ''
  if (stored.length > 16 || stored.startsWith('[') || stored.startsWith('{')) {
    localStorage.removeItem(PUBLISHED_HASH_KEY)
    return ''
  }
  return stored
}

interface Props {
  open?: boolean
  onClose?: () => void
}

export function AdminPanel({ open: externalOpen, onClose: externalClose }: Props = {}) {
  const ranges          = useStore(s => s.ranges)
  const adminSaveRanges = useStore(s => s.adminSaveRanges)
  const adminLastError  = useStore(s => s.adminLastError)
  const adminToken      = useStore(s => s.adminToken)
  const logout          = useStore(s => s.logout)

  const [internalOpen, setInternalOpen]       = useState(false)
  const [password, setPassword]               = useState('')
  const [status, setStatus]                   = useState<'idle' | 'loading' | 'ok' | 'wrong' | 'error' | 'invalid_token' | 'missing_token' | 'token_expired'>('idle')
  const [publishedHash, setPublishedHash]     = useState(loadPublishedHash)
  const [confirmedAnyway, setConfirmedAnyway] = useState(false)

  const controlled  = externalOpen !== undefined
  const isOpen      = controlled ? externalOpen : internalOpen
  const dialogRef   = useModalA11y<HTMLDivElement>(isOpen, handleClose)

  const hasValidToken = !!adminToken && adminToken.expiresAt > Date.now()
  const needPassword  = !hasValidToken

  const currentHash = useMemo(() => djb2(JSON.stringify(ranges)), [ranges])
  const isPublished = !!publishedHash && publishedHash === currentHash

  const problems = validateRanges(ranges)
  const blockedByValidation = problems.length > 0 && !confirmedAnyway

  async function handlePublish() {
    if ((needPassword && !password) || isPublished || blockedByValidation) return
    setStatus('loading')
    const result = await adminSaveRanges(needPassword ? password : undefined)
    if (result === 'ok') {
      localStorage.setItem(PUBLISHED_HASH_KEY, currentHash)
      setPublishedHash(currentHash)
      setStatus('ok')
    } else if (result === 'wrong_password') {
      setStatus('wrong')
    } else if (result === 'token_expired') {
      setStatus('token_expired')
    } else if (result === 'invalid_token') {
      setStatus('invalid_token')
    } else if (result === 'missing_token') {
      setStatus('missing_token')
    } else {
      setStatus('error')
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
    setConfirmedAnyway(false)
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
            ref={dialogRef}
            className="bg-warm-900 border border-warm-700 rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-publish-title"
          >
            <div className="flex justify-between items-center">
              <h3 id="admin-publish-title" className="font-bold text-white">Publicar Ranges</h3>
              <button onClick={handleClose} className="text-warm-400 hover:text-white text-xl">✕</button>
            </div>

            <p className="text-xs text-warm-400">
              Envia todos os {ranges.length} ranges atuais como padrão nativo. Aguarde ~2 min para o deploy.
            </p>

            {problems.length > 0 && (
              <div className="space-y-2 border border-red-700/50 bg-red-900/15 rounded-lg p-3">
                <p className="text-xs text-red-400 font-semibold">
                  {problems.length} problema{problems.length !== 1 ? 's' : ''} de validação encontrado{problems.length !== 1 ? 's' : ''}:
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {problems.map((p, i) => (
                    <p key={i} className="text-[0.7rem] text-red-300 leading-snug break-words">• {p}</p>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-warm-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={confirmedAnyway}
                    onChange={e => setConfirmedAnyway(e.target.checked)}
                  />
                  Publicar mesmo assim
                </label>
              </div>
            )}

            {needPassword ? (
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
            ) : (
              <p className="text-xs text-warm-500">Sessão de admin ativa. Publique sem redigitar a senha.</p>
            )}

            {status === 'ok' && (
              <p className="text-xs text-emerald-400 font-semibold">
                Publicado. Aguarde ~2 min para o deploy entrar no ar.
              </p>
            )}
            {status === 'wrong' && (
              <p className="text-xs text-red-400">Senha incorreta.</p>
            )}
            {status === 'token_expired' && (
              <p className="text-xs text-red-400">Sessão expirada. Digite a senha novamente para publicar.</p>
            )}
            {status === 'invalid_token' && (
              <p className="text-xs text-red-400">GITHUB_TOKEN expirado. Gere um novo token e atualize no Cloudflare Worker.</p>
            )}
            {status === 'missing_token' && (
              <p className="text-xs text-red-400">GITHUB_TOKEN não configurado no Worker. Verifique as variáveis de ambiente.</p>
            )}
            {status === 'error' && (
              <p className="text-xs text-red-400 break-all">{adminLastError || 'Erro ao publicar. Tente novamente.'}</p>
            )}

            <button
              onClick={handlePublish}
              disabled={(needPassword && !password) || status === 'loading' || isPublished || blockedByValidation}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {status === 'loading' ? 'Publicando...' : isPublished ? 'Publicado' : blockedByValidation ? 'Corrija a validação' : 'Publicar'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
