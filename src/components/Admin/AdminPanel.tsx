import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { Settings } from 'lucide-react'

export function AdminPanel() {
  const ranges          = useStore(s => s.ranges)
  const adminWorkerUrl  = useStore(s => s.adminWorkerUrl)
  const setAdminWorkerUrl = useStore(s => s.setAdminWorkerUrl)
  const adminSaveRanges = useStore(s => s.adminSaveRanges)

  const [open, setOpen]         = useState(false)
  const [url, setUrl]           = useState(adminWorkerUrl)
  const [password, setPassword] = useState('')
  const [status, setStatus]     = useState<'idle' | 'loading' | 'ok' | 'wrong' | 'error'>('idle')

  async function handlePublish() {
    if (!url || !password) return
    setAdminWorkerUrl(url)
    setStatus('loading')
    const result = await adminSaveRanges(password)
    setStatus(result === 'ok' ? 'ok' : result === 'wrong_password' ? 'wrong' : 'error')
  }

  function handleClose() {
    setOpen(false)
    setStatus('idle')
    setPassword('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-800 hover:text-gray-400 transition-all"
        title="Admin"
      >
        <Settings size={16} className="flex-shrink-0" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white">Publicar Ranges</h3>
              <button onClick={handleClose} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <p className="text-xs text-gray-400">
              Envia todos os {ranges.length} ranges atuais como padrão nativo. Após publicar, aguarde ~2 min para o deploy.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 block">URL do Worker</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://preflop-admin.xxx.workers.dev"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 block">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                onKeyDown={e => { if (e.key === 'Enter') handlePublish() }}
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
              <p className="text-xs text-red-400">Erro ao publicar. Verifique a URL do Worker.</p>
            )}

            <button
              onClick={handlePublish}
              disabled={!url || !password || status === 'loading'}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {status === 'loading' ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
