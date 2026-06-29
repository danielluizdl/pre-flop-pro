import { useState } from 'react'
import type { TrainingSession } from '../../types'
import { t } from '../../i18n'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function AccuracySparkline({ sessions }: { sessions: TrainingSession[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const pts = sessions
    .filter(s => s.hands > 0)
    .map(s => ({ acc: Math.round(s.correct / s.hands * 100), ts: s.timestamp }))
  if (pts.length < 2) return null

  const W = 600, H = 120, padX = 10, padY = 12
  const n = pts.length
  const xOf = (i: number) => padX + (i / (n - 1)) * (W - 2 * padX)
  const yOf = (acc: number) => padY + (1 - acc / 100) * (H - 2 * padY)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(p.acc).toFixed(1)}`).join(' ')
  const ref80 = yOf(80)

  return (
    <div className="card-surface p-4">
      <div className="eyebrow mb-2">{t.sparkline.title}</div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
          <line x1={padX} y1={ref80} x2={W - padX} y2={ref80} stroke="#5a5247" strokeWidth="1" strokeDasharray="5 5" />
          <text x={W - padX} y={ref80 - 4} textAnchor="end" fontSize="9" fill="#8a857a">80%</text>
          <path d={path} fill="none" stroke="#d97757" strokeWidth="2" />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={xOf(i)} cy={yOf(p.acc)} r={hover === i ? 5 : 3}
              fill={p.acc >= 80 ? '#34d399' : p.acc >= 50 ? '#facc15' : '#f87171'}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="absolute bg-warm-950 border border-warm-600 rounded-lg px-2 py-1 text-xs text-white pointer-events-none whitespace-nowrap z-10"
            style={{ left: `${(xOf(hover) / W) * 100}%`, top: `${(yOf(pts[hover].acc) / H) * 100}%`, transform: 'translate(-50%, -130%)' }}
          >
            <div className="font-bold tabular-nums">{pts[hover].acc}%</div>
            <div className="text-warm-400">{formatDate(pts[hover].ts)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
