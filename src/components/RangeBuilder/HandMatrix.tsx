import { useState, useRef } from 'react'
import { RANKS } from '../../utils/hands'
import { useStore } from '../../store/useStore'
import type { HandData } from '../../types'

const C = { allin: '#8b5cf6', raise: '#ef4444', call: '#22c55e' }

function cellBackground(data: HandData): string {
  const p1 = data.allin
  const p2 = p1 + data.raise
  const p3 = p2 + data.call
  if (p3 === 0) return 'transparent'
  return `linear-gradient(to right,
    ${C.allin} 0% ${p1}%,
    ${C.raise} ${p1}% ${p2}%,
    ${C.call}  ${p2}% ${p3}%,
    transparent ${p3}% 100%)`
}

interface Props {
  readOnly?: boolean
  grid?: Record<string, HandData>
}

export function HandMatrix({ readOnly = false, grid: externalGrid }: Props) {
  const applyBrush = useStore(s => s.applyBrush)
  const clearHand  = useStore(s => s.clearHand)
  const brush      = useStore(s => s.brush)
  const storeGrid  = useStore(s => s.rangeData.grid)
  const grid = externalGrid ?? storeGrid

  const isDrawing  = useRef(false)
  const drawMode   = useRef<'apply' | 'clear'>('apply')
  const [showWarning, setShowWarning] = useState(false)
  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  function triggerWarning() {
    setShowWarning(true)
    if (warnTimer.current) clearTimeout(warnTimer.current)
    warnTimer.current = setTimeout(() => setShowWarning(false), 2000)
  }

  const handleMouseDown = (hand: string) => {
    if (readOnly) return
    isDrawing.current = true
    const data = grid[hand] ?? { fold: 100, call: 0, raise: 0, allin: 0 }
    const isFilled = data.fold < 100

    if (isFilled) {
      drawMode.current = 'clear'
      clearHand(hand)
    } else {
      const brushTotal = brush.call + brush.raise + brush.allin
      if (brushTotal > 100) {
        triggerWarning()
        isDrawing.current = false
        return
      }
      drawMode.current = 'apply'
      applyBrush(hand)
    }
  }

  const handleMouseEnter = (hand: string) => {
    if (readOnly || !isDrawing.current) return
    if (drawMode.current === 'clear') {
      clearHand(hand)
    } else {
      applyBrush(hand)
    }
  }

  const handleMouseUp = () => { isDrawing.current = false }

  return (
    <div className="relative">
      {showWarning && (
        <div className="absolute -top-9 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
            ⚠ Soma das frequências ultrapassa 100%
          </div>
        </div>
      )}

      <div
        className="grid gap-0.5 select-none mx-auto"
        style={{ gridTemplateColumns: 'repeat(13, 1fr)', maxWidth: 650 }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {Array.from({ length: 13 }, (_, i) =>
          Array.from({ length: 13 }, (_, j) => {
            const hand = i === j
              ? RANKS[i] + RANKS[j]
              : i < j
                ? RANKS[i] + RANKS[j] + 's'
                : RANKS[j] + RANKS[i] + 'o'
            const data = grid[hand] ?? { fold: 100, call: 0, raise: 0, allin: 0 }
            const bg = cellBackground(data)
            const isEmpty = data.fold >= 100

            return (
              <div
                key={hand}
                data-hand={hand}
                onMouseDown={() => handleMouseDown(hand)}
                onMouseEnter={() => handleMouseEnter(hand)}
                className={[
                  'relative aspect-square rounded-sm border flex items-center justify-center text-[0.6rem] font-semibold overflow-hidden',
                  readOnly ? '' : 'cursor-pointer hover:border-gray-400',
                  isEmpty ? 'border-gray-700/50' : 'border-gray-600/50',
                ].join(' ')}
                style={{ background: isEmpty ? '#1f2937' : '#111827' }}
              >
                <div className="absolute inset-0 z-0" style={{ background: bg }} />
                <span
                  className="relative z-10 text-[0.55rem] font-semibold"
                  style={{
                    color: isEmpty ? '#6b7280' : 'rgba(255,255,255,0.85)',
                    textShadow: isEmpty ? 'none' : '0 0 3px rgba(0,0,0,0.8)',
                  }}
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
