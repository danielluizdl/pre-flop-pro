import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { RangeMark } from '../ui/RangeMark'

const DURATION = 6000

export function WelcomeModal() {
  const currentUser = useStore(s => s.currentUser)
  const [visible, setVisible]   = useState(false)
  const [progress, setProgress] = useState(100)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 30)
    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100)
      setProgress(pct)
      if (elapsed >= DURATION) handleClose()
    }, 50)
    return () => {
      clearTimeout(show)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function handleClose() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setVisible(false)
    setTimeout(() => {
      const cur = useStore.getState().currentUser
      if (cur) useStore.setState({ currentUser: { ...cur, firstLogin: false } })
    }, 350)
  }

  const firstName = currentUser?.name?.split(' ')[0] ?? currentUser?.username ?? ''

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ background: 'rgba(3,7,18,0.82)' }}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-md bg-warm-900 border border-warm-700/50 rounded-3xl p-8 text-center shadow-2xl transition-all duration-500 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
      >
        <div className="flex justify-center mb-5">
          <div className="animate-bounce">
            <RangeMark size={72} />
          </div>
        </div>

        <h2 id="welcome-modal-title" className="text-2xl font-bold text-white mb-1">
          Bem-vindo(a), {firstName}!
        </h2>
        <p className="text-brand-400 text-sm font-semibold mb-5">
          Conta criada com sucesso
        </p>

        <p className="text-warm-300 text-sm leading-relaxed mb-7">
          Aproveite bastante o <span className="text-white font-semibold">Pre-Flop Pro</span> para estudar seus ranges, treinar situações reais de mesa e subir de nível no pré-flop. Bons estudos e boa sorte nas mesas!
        </p>

        <button
          onClick={handleClose}
          className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
        >
          Bora treinar!
        </button>

        <div className="mt-4 h-1 bg-warm-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full"
            style={{ width: `${progress}%`, transition: 'none' }}
          />
        </div>
      </div>
    </div>
  )
}
