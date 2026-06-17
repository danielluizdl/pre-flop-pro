import { useMemo, useState } from 'react'
import { RANKS } from '../../utils/hands'

export interface ActionFreq { call?: number; raise?: number; allin?: number; extra?: number; fold?: number }

const C = { allin: '#6b2d0d', raise: '#ef4444', call: '#22c55e', extra: '#d97757' }

function cellBackground(d: ActionFreq): string {
  const allin = d.allin ?? 0
  const raise = d.raise ?? 0
  const call = d.call ?? 0
  const extra = d.extra ?? 0
  const p1 = allin
  const p2 = p1 + raise
  const p3 = p2 + call
  const p4 = p3 + extra
  if (p4 <= 0) return 'transparent'
  return `linear-gradient(to right, ${C.allin} 0% ${p1}%, ${C.raise} ${p1}% ${p2}%, ${C.call} ${p2}% ${p3}%, ${C.extra} ${p3}% ${p4}%, transparent ${p4}% 100%)`
}

function freqText(d: ActionFreq): string {
  const parts: string[] = []
  const r = Math.round(d.raise ?? 0), c = Math.round(d.call ?? 0), a = Math.round(d.allin ?? 0), e = Math.round(d.extra ?? 0)
  if (a > 0) parts.push(`${a}% All-in`)
  if (r > 0) parts.push(`${r}% Raise`)
  if (c > 0) parts.push(`${c}% Call`)
  if (e > 0) parts.push(`${e}% Extra`)
  const nonFold = a + r + c + e
  const fold = Math.max(0, 100 - nonFold)
  if (fold > 0) parts.push(`${fold}% Fold`)
  return parts.join(' · ') || 'Fold'
}

export function RangeActionGrid({ title, grid, subtitle }: { title: string; grid: Record<string, ActionFreq>; subtitle?: string }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const byHand = useMemo(() => grid, [grid])

  return (
    <div className="relative">
      <div className="mb-2">
        <h4 className="text-xs font-semibold text-warm-200">{title}</h4>
        {subtitle && <p className="text-[0.7rem] text-warm-500">{subtitle}</p>}
      </div>

      {hovered && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded bg-warm-900 border border-warm-600 text-xs text-white shadow-lg whitespace-nowrap"
          style={{ left: mouse.x + 14, top: mouse.y - 34 }}
        >
          <span className="font-bold text-warm-200 mr-1">{hovered}</span>{freqText(byHand[hovered] ?? {})}
        </div>
      )}

      <div
        className="grid gap-0.5 select-none"
        style={{ gridTemplateColumns: 'repeat(13, 1fr)', maxWidth: 380 }}
        onMouseMove={e => setMouse({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: 13 }, (_, i) =>
          Array.from({ length: 13 }, (_, j) => {
            const hand = i === j ? RANKS[i] + RANKS[j] : i < j ? RANKS[i] + RANKS[j] + 's' : RANKS[j] + RANKS[i] + 'o'
            const d = byHand[hand] ?? {}
            const nonFold = (d.call ?? 0) + (d.raise ?? 0) + (d.allin ?? 0) + (d.extra ?? 0)
            const empty = nonFold <= 0
            return (
              <div
                key={hand}
                onMouseEnter={() => setHovered(hand)}
                className="relative aspect-square rounded-[4px] border border-warm-700/50 flex items-center justify-center overflow-hidden"
                style={{ background: empty ? '#1f1d1a' : '#16140f' }}
              >
                <div className="absolute inset-0 z-0" style={{ background: cellBackground(d) }} />
                <span
                  className="relative z-10"
                  style={{ fontSize: 8, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: empty ? '#6b7280' : 'rgba(255,255,255,0.92)', fontWeight: empty ? 500 : 700, textShadow: empty ? 'none' : '0 0 3px rgba(0,0,0,0.85)' }}
                >
                  {hand}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
