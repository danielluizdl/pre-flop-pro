import { rangeComboStats, TOTAL_COMBOS, type ComboActionFreq } from '../../utils/rangeCombos'

const C = { raise: '#ef4444', call: '#22c55e', allin: '#6b2d0d', extra: '#d97757' }

function fmt(c: number): string {
  return Math.abs(c - Math.round(c)) < 0.01 ? String(Math.round(c)) : c.toFixed(1)
}

export function ComboCounter({ grid, extraLabel, extraColor }: {
  grid: Record<string, ComboActionFreq>
  extraLabel?: string
  extraColor?: string
}) {
  const s = rangeComboStats(grid)
  const rows = [
    { key: 'raise', label: 'Raise', v: s.byAction.raise, color: C.raise },
    { key: 'call', label: 'Call', v: s.byAction.call, color: C.call },
    { key: 'allin', label: 'All-in', v: s.byAction.allin, color: C.allin },
    { key: 'extra', label: extraLabel || 'Extra', v: s.byAction.extra, color: extraColor || C.extra },
  ].filter(r => r.v > 0.001)

  return (
    <div className="rounded-lg border border-warm-700 bg-warm-800/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.7rem] font-bold text-warm-400 uppercase tracking-wider">Combos</span>
        <span className="text-sm font-bold text-warm-100 tabular-nums">
          {fmt(s.openCombos)}<span className="text-warm-500 font-normal text-xs"> / 1326 · {s.openPct.toFixed(1)}%</span>
        </span>
      </div>
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-xs text-warm-600">Nenhuma ação pintada ainda.</p>
        ) : rows.map(r => (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: r.color }} />
            <span className="flex-1 text-warm-300 truncate">{r.label}</span>
            <span className="text-warm-100 font-semibold tabular-nums">{fmt(r.v)}</span>
            <span className="text-warm-500 w-12 text-right tabular-nums">{((r.v / TOTAL_COMBOS) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
