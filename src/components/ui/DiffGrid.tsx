import { RANKS } from '../../utils/hands'
import { t } from '../../i18n'

function diffColor(f: number): string {
  if (f <= 0.001) return 'rgba(34,197,94,0.4)'
  if (f <= 0.15) return 'rgba(234,179,8,0.5)'
  if (f <= 0.4) return 'rgba(249,115,22,0.55)'
  return 'rgba(239,68,68,0.6)'
}

export function DiffGrid({ perHand }: { perHand: Record<string, number> }) {
  return (
    <div>
      <div className="mb-2">
        <h4 className="text-xs font-semibold text-warm-200">{t.exercise.diffTitle}</h4>
        <p className="text-[0.7rem] text-warm-500">{t.exercise.diffLegend}</p>
      </div>
      <div className="grid gap-0.5 select-none" style={{ gridTemplateColumns: 'repeat(13, 1fr)', maxWidth: 600 }}>
        {Array.from({ length: 13 }, (_, i) =>
          Array.from({ length: 13 }, (_, j) => {
            const hand = i === j ? RANKS[i] + RANKS[j] : i < j ? RANKS[i] + RANKS[j] + 's' : RANKS[j] + RANKS[i] + 'o'
            const f = perHand[hand] ?? 0
            return (
              <div
                key={hand}
                title={t.exercise.diffTooltip(hand, Math.round(f * 100))}
                className="relative aspect-square rounded-[4px] border border-warm-700/50 flex items-center justify-center overflow-hidden"
                style={{ background: '#16140f' }}
              >
                <div className="absolute inset-0 z-0" style={{ background: diffColor(f) }} />
                <span
                  className="relative z-10"
                  style={{ fontSize: 8, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: 'rgba(255,255,255,0.92)', fontWeight: 700, textShadow: '0 0 3px rgba(0,0,0,0.85)' }}
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
