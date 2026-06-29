import { useMemo, useState, useCallback, memo } from 'react'
import { RANKS } from '../../utils/hands'
import { countRender } from '../../test/renderCount'
import { t } from '../../i18n'

export interface GridCell {
  hand: string
  total: number
  correct: number
  accuracy: number
  graves: number
  consults: number
  correctAction: string | null
  topWrong: { action: string; n: number } | null
  played?: { fold: number; call: number; raise: number; allin: number; extra: number }
}

type Metric = 'accuracy' | 'graves' | 'consults' | 'volume'

const METRIC_KEYS: Metric[] = ['accuracy', 'graves', 'consults', 'volume']
function metricLabel(m: Metric): string {
  return m === 'accuracy' ? t.coach.metricAccuracy
    : m === 'graves' ? t.coach.metricBlunders
    : m === 'consults' ? t.coach.metricConsults
    : t.coach.metricVolume
}

function accColor(acc: number): string {
  if (acc >= 80) return 'rgba(34,197,94,0.6)'
  if (acc >= 50) return 'rgba(234,179,8,0.6)'
  return 'rgba(239,68,68,0.62)'
}

function scaleColor(value: number, max: number, rgb: string): string {
  if (max <= 0 || value <= 0) return 'transparent'
  const a = 0.15 + 0.7 * (value / max)
  return `rgba(${rgb},${a.toFixed(2)})`
}

function cellColor(cell: GridCell | undefined, metric: Metric, max: number): string | null {
  if (!cell || cell.total === 0) return null
  if (metric === 'accuracy') return accColor(cell.accuracy)
  if (metric === 'graves') return scaleColor(cell.graves, max, '239,68,68')
  if (metric === 'consults') return scaleColor(cell.consults, max, '139,92,246')
  return scaleColor(cell.total, max, '148,163,184')
}

const HeatCell = memo(function HeatCell({ hand, color, hasData, onEnter }: {
  hand: string
  color: string | null
  hasData: boolean
  onEnter: (hand: string) => void
}) {
  countRender('heatCell')
  return (
    <div
      onMouseEnter={() => onEnter(hand)}
      className="relative aspect-square rounded-[6px] border border-warm-700/50 flex items-center justify-center overflow-hidden"
      style={{ background: hasData ? '#16140f' : '#1f1d1a' }}
    >
      {color && <div className="absolute inset-0 z-0" style={{ background: color }} />}
      <span
        className="relative z-10"
        style={{
          fontSize: 10.5,
          letterSpacing: '0.02em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          color: hasData ? 'rgba(255,255,255,0.9)' : '#6b7280',
          fontWeight: hasData ? 700 : 500,
          textShadow: hasData ? '0 0 3px rgba(0,0,0,0.8)' : 'none',
        }}
      >
        {hand}
      </span>
    </div>
  )
})

export function RangeHeatGrid({ cells }: { cells: GridCell[] }) {
  const [metric, setMetric] = useState<Metric>('accuracy')
  const [hovered, setHovered] = useState<string | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })

  const byHand = useMemo(() => new Map(cells.map(c => [c.hand, c])), [cells])
  const max = useMemo(() => {
    if (metric === 'graves') return Math.max(0, ...cells.map(c => c.graves))
    if (metric === 'consults') return Math.max(0, ...cells.map(c => c.consults))
    if (metric === 'volume') return Math.max(0, ...cells.map(c => c.total))
    return 100
  }, [cells, metric])

  const hCell = hovered ? byHand.get(hovered) : undefined
  const onEnter = useCallback((hand: string) => setHovered(hand), [])

  return (
    <div className="relative">
      <div className="flex gap-1 mb-3">
        {METRIC_KEYS.map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={[
              'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
              metric === m ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:text-warm-200',
            ].join(' ')}
          >
            {metricLabel(m)}
          </button>
        ))}
      </div>

      {hCell && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded bg-warm-900 border border-warm-600 text-xs text-white shadow-lg whitespace-nowrap"
          style={{ left: mouse.x + 14, top: mouse.y - 38 }}
        >
          <div><span className="font-bold text-warm-200 mr-1">{hCell.hand}</span>{hCell.correct}/{hCell.total} · {hCell.accuracy}%</div>
          <div className="text-warm-400">graves {hCell.graves} · consultas {hCell.consults}</div>
          {hCell.topWrong && (
            <div className="text-warm-400">correto {hCell.correctAction ?? '—'} · erram mais <span className="text-red-300">{hCell.topWrong.action}</span> ({hCell.topWrong.n}x)</div>
          )}
        </div>
      )}

      <div
        className="grid gap-0.5 select-none mx-auto"
        style={{ gridTemplateColumns: 'repeat(13, 1fr)', maxWidth: 380 }}
        onMouseMove={e => setMouse({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: 13 }, (_, i) =>
          Array.from({ length: 13 }, (_, j) => {
            const hand = i === j ? RANKS[i] + RANKS[j] : i < j ? RANKS[i] + RANKS[j] + 's' : RANKS[j] + RANKS[i] + 'o'
            const cell = byHand.get(hand)
            const color = cellColor(cell, metric, max)
            const hasData = !!cell && cell.total > 0
            return <HeatCell key={hand} hand={hand} color={color} hasData={hasData} onEnter={onEnter} />
          })
        )}
      </div>
    </div>
  )
}
