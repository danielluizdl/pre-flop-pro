import { useState, useRef } from 'react'
import { RANKS } from '../../utils/hands'
import { useStore } from '../../store/useStore'
import type { HandData } from '../../types'

const C = { allin: '#92400e', raise: '#ef4444', call: '#22c55e' }

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

type HandPerf = Record<string, { c: number; t: number }>

function heatColor(perf: { c: number; t: number } | undefined): string | null {
  if (!perf || perf.t === 0) return null
  const acc = perf.c / perf.t
  if (acc >= 0.8) return 'rgba(34,197,94,0.55)'
  if (acc >= 0.5) return 'rgba(234,179,8,0.55)'
  return 'rgba(239,68,68,0.58)'
}

interface Props {
  readOnly?: boolean
  grid?: Record<string, HandData>
  heatmap?: HandPerf
}

type ViewMode = 'actions' | 'heatmap'

export function HandMatrix({ readOnly = false, grid: externalGrid, heatmap }: Props) {
  const applyBrush = useStore(s => s.applyBrush)
  const clearHand  = useStore(s => s.clearHand)
  const brush      = useStore(s => s.brush)
  const storeGrid  = useStore(s => s.rangeData.grid)
  const grid = externalGrid ?? storeGrid

  const isDrawing  = useRef(false)
  const drawMode   = useRef<'apply' | 'clear'>('apply')
  const [showWarning, setShowWarning] = useState(false)
  const [viewMode, setViewMode]       = useState<ViewMode>('heatmap')
  const [hoveredHand, setHoveredHand] = useState<string | null>(null)
  const [mousePos, setMousePos]       = useState({ x: 0, y: 0 })
  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isHeatmapMode = !!heatmap && viewMode === 'heatmap'

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

      {heatmap && (
        <div className="flex gap-1 mb-2">
          {(['actions', 'heatmap'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={[
                'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                viewMode === mode
                  ? 'bg-brand-600 border-brand-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-gray-200',
              ].join(' ')}
            >
              {mode === 'actions' ? 'Ações' : 'Erro / Acerto'}
            </button>
          ))}
        </div>
      )}

      {isHeatmapMode && hoveredHand && heatmap && (() => {
        const perf = heatmap[hoveredHand]
        const text = perf && perf.t > 0
          ? `${perf.c}/${perf.t}  ${Math.round((perf.c / perf.t) * 100)}%`
          : 'Não treinado'
        return (
          <div
            className="fixed z-50 pointer-events-none px-2 py-1 rounded bg-gray-900 border border-gray-600 text-xs text-white shadow-lg whitespace-nowrap"
            style={{ left: mousePos.x + 14, top: mousePos.y - 28 }}
          >
            <span className="font-bold text-gray-300 mr-1">{hoveredHand}</span>{text}
          </div>
        )
      })()}

      <div
        className="grid gap-0.5 select-none mx-auto"
        style={{ gridTemplateColumns: 'repeat(13, 1fr)', maxWidth: 650 }}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setHoveredHand(null) }}
        onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
      >
        {Array.from({ length: 13 }, (_, i) =>
          Array.from({ length: 13 }, (_, j) => {
            const hand = i === j
              ? RANKS[i] + RANKS[j]
              : i < j
                ? RANKS[i] + RANKS[j] + 's'
                : RANKS[j] + RANKS[i] + 'o'
            const data    = grid[hand] ?? { fold: 100, call: 0, raise: 0, allin: 0 }
            const isEmpty = data.fold >= 100

            const showActions  = !heatmap || viewMode === 'actions'
            const showHeatmap  = !!heatmap && viewMode === 'heatmap'

            const bg    = showActions ? cellBackground(data) : 'transparent'
            const heat  = showHeatmap ? heatColor(heatmap[hand]) : null

            // In heatmap mode: in-range but untrained cells get a distinct base color
            const baseBg = showHeatmap && !isEmpty && !heat
              ? '#2a3444'
              : isEmpty ? '#1f2937' : '#111827'

            return (
              <div
                key={hand}
                data-hand={hand}
                onMouseDown={() => handleMouseDown(hand)}
                onMouseEnter={() => { handleMouseEnter(hand); if (isHeatmapMode) setHoveredHand(hand) }}
                onMouseLeave={() => { if (isHeatmapMode) setHoveredHand(null) }}
                className={[
                  'relative aspect-square rounded-sm border flex items-center justify-center text-[0.6rem] font-semibold overflow-hidden',
                  readOnly ? '' : 'cursor-pointer hover:border-gray-400',
                  isEmpty ? 'border-gray-700/50' : 'border-gray-600/50',
                ].join(' ')}
                style={{ background: baseBg }}
              >
                <div className="absolute inset-0 z-0" style={{ background: bg }} />
                {heat && (
                  <div className="absolute inset-0 z-[1]" style={{ background: heat }} />
                )}
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
