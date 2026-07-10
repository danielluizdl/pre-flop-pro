import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { t } from '../../i18n'

export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

// Relógio ao vivo do treino: um único setInterval por montagem (limpo no
// cleanup); o tick re-renderiza só este span, não o pai.
export function ElapsedClock({ startMs, className = '' }: { startMs: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!startMs) return null
  return (
    <span
      aria-label={t.common.elapsedTime}
      title={t.common.elapsedTime}
      className={`inline-flex items-center gap-1 tabular-nums ${className}`}
    >
      <Clock size={12} aria-hidden="true" />
      {formatElapsed((now - startMs) / 1000)}
    </span>
  )
}
