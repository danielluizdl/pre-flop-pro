import { useState, useRef, useCallback, memo } from 'react'
import type { CSSProperties } from 'react'
import { RANKS } from '../../utils/hands'
import { useStore } from '../../store/useStore'
import { countRender } from '../../test/renderCount'
import type { HandData } from '../../types'

const C = { allin: '#6b2d0d', raise: '#ef4444', call: '#22c55e' }

type CellAction = 'raise' | 'call' | 'allin' | 'mixed' | 'empty'

function cellAction(data: HandData): CellAction {
  const nonFold = data.call + data.raise + data.allin + (data.extra ?? 0)
  if (nonFold === 0) return 'empty'
  const filled = [data.call > 0, data.raise > 0, data.allin > 0, (data.extra ?? 0) > 0].filter(Boolean).length
  if (filled > 1) return 'mixed'
  if (data.raise > 0) return 'raise'
  if (data.call  > 0) return 'call'
  return 'allin'
}

const ACTION_TEXT: Record<CellAction, CSSProperties> = {
  raise: { color: '#ffffff', textShadow: '0 0 4px rgba(0,0,0,0.45)', fontWeight: 700 },
  call:  { color: '#062b13', fontWeight: 700 },
  allin: { color: '#fde68a', fontWeight: 700 },
  mixed: { color: '#ffffff', textShadow: '0 0 4px rgba(0,0,0,0.55), 0 1px 0 rgba(0,0,0,0.4)', fontWeight: 700 },
  empty: { color: 'rgba(237,232,222,0.55)', fontWeight: 500 },
}

function cellBackground(data: HandData, extraColor: string): string {
  const p1 = data.allin
  const p2 = p1 + data.raise
  const p3 = p2 + data.call
  const p4 = p3 + (data.extra ?? 0)
  if (p4 === 0) return 'transparent'
  return `linear-gradient(to right,
    ${C.allin} 0% ${p1}%,
    ${C.raise} ${p1}% ${p2}%,
    ${C.call}  ${p2}% ${p3}%,
    ${extraColor} ${p3}% ${p4}%,
    transparent ${p4}% 100%)`
}

type HandPerf = Record<string, { c: number; t: number }>

function heatColor(perf: { c: number; t: number } | undefined): string | null {
  if (!perf || perf.t === 0) return null
  const acc = perf.c / perf.t
  if (acc >= 0.8) return 'rgba(34,197,94,0.55)'
  if (acc >= 0.5) return 'rgba(234,179,8,0.55)'
  return 'rgba(239,68,68,0.58)'
}

const EMPTY_CELL: HandData = { fold: 100, call: 0, raise: 0, allin: 0 }

interface CellProps {
  hand: string
  data: HandData
  heatPerf: { c: number; t: number } | undefined
  isHeatmapMode: boolean
  showActions: boolean
  showHeatmap: boolean
  extraColor: string
  readOnly: boolean
  onDown: (hand: string) => void
  onEnter: (hand: string) => void
  onLeave: (hand: string) => void
}

const Cell = memo(function Cell({ hand, data, heatPerf, isHeatmapMode, showActions, showHeatmap, extraColor, readOnly, onDown, onEnter, onLeave }: CellProps) {
  countRender('handCell')
  const isEmpty = data.fold >= 100
  const bg   = showActions ? cellBackground(data, extraColor) : 'transparent'
  const heat = showHeatmap ? heatColor(heatPerf) : null
  const baseBg = showHeatmap && !isEmpty && !heat
    ? '#2a3444'
    : isEmpty ? '#1f1d1a' : '#16140f'
  const action = cellAction(data)
  const textStyle: CSSProperties = isHeatmapMode
    ? { color: isEmpty ? '#6b7280' : 'rgba(255,255,255,0.85)', fontWeight: isEmpty ? 500 : 700, textShadow: isEmpty ? 'none' : '0 0 3px rgba(0,0,0,0.8)' }
    : ACTION_TEXT[action]

  return (
    <div
      data-hand={hand}
      onMouseDown={() => onDown(hand)}
      onMouseEnter={() => onEnter(hand)}
      onMouseLeave={() => onLeave(hand)}
      className={[
        'relative aspect-square rounded-[6px] border flex items-center justify-center overflow-hidden',
        readOnly ? '' : 'cursor-pointer hover:border-warm-400',
        isEmpty ? 'border-warm-700/50' : 'border-warm-600/50',
      ].join(' ')}
      style={{ background: baseBg }}
    >
      <div className="absolute inset-0 z-0" style={{ background: bg }} />
      {heat && (
        <div className="absolute inset-0 z-[1]" style={{ background: heat }} />
      )}
      <span
        className="relative z-10"
        style={{
          fontSize: 11,
          letterSpacing: '0.02em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          ...textStyle,
        }}
      >
        {hand}
      </span>
    </div>
  )
})

interface Props {
  readOnly?: boolean
  grid?: Record<string, HandData>
  heatmap?: HandPerf
  customActionColor?: string
  forceViewMode?: ViewMode
}

type ViewMode = 'actions' | 'heatmap'

export function HandMatrix({ readOnly = false, grid: externalGrid, heatmap, customActionColor, forceViewMode }: Props) {
  const applyBrush      = useStore(s => s.applyBrush)
  const clearHand       = useStore(s => s.clearHand)
  const brush           = useStore(s => s.brush)
  const storeGrid       = useStore(s => s.rangeData.grid)
  const grid = externalGrid ?? storeGrid
  const effectiveExtraColor = customActionColor ?? brush.extraColor

  const isDrawing    = useRef(false)
  const drawMode     = useRef<'apply' | 'clear'>('apply')
  const paintedHands = useRef<Set<string>>(new Set())
  const [showWarning, setShowWarning] = useState(false)
  const [viewMode, setViewMode]       = useState<ViewMode>('heatmap')
  const [hoveredHand, setHoveredHand] = useState<string | null>(null)
  const [mousePos, setMousePos]       = useState({ x: 0, y: 0 })
  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeViewMode = forceViewMode ?? viewMode
  const isHeatmapMode = !!heatmap && activeViewMode === 'heatmap'

  // Refs lidos pelos handlers estáveis (useCallback) — evita recriar callbacks
  // a cada render (que quebraria o memo das células) sem usar closures stale.
  const gridRef = useRef(grid); gridRef.current = grid
  const brushRef = useRef(brush); brushRef.current = brush
  const readOnlyRef = useRef(readOnly); readOnlyRef.current = readOnly
  const heatmapModeRef = useRef(isHeatmapMode); heatmapModeRef.current = isHeatmapMode

  const triggerWarning = useCallback(() => {
    setShowWarning(true)
    if (warnTimer.current) clearTimeout(warnTimer.current)
    warnTimer.current = setTimeout(() => setShowWarning(false), 2000)
  }, [])

  const onDown = useCallback((hand: string) => {
    if (readOnlyRef.current) return
    isDrawing.current = true
    paintedHands.current = new Set([hand])
    const data = gridRef.current[hand] ?? { fold: 100, call: 0, raise: 0, allin: 0 }
    const isFilled = data.fold < 100

    if (isFilled) {
      drawMode.current = 'clear'
      clearHand(hand)
    } else {
      const b = brushRef.current
      if (b.call + b.raise + b.allin > 100) {
        triggerWarning()
        isDrawing.current = false
        return
      }
      drawMode.current = 'apply'
      applyBrush(hand)
    }
  }, [applyBrush, clearHand, triggerWarning])

  const onEnter = useCallback((hand: string) => {
    if (heatmapModeRef.current) setHoveredHand(hand)
    if (readOnlyRef.current || !isDrawing.current) return
    if (paintedHands.current.has(hand)) return
    paintedHands.current.add(hand)
    if (drawMode.current === 'clear') clearHand(hand)
    else applyBrush(hand)
  }, [applyBrush, clearHand])

  const onLeave = useCallback(() => {
    if (heatmapModeRef.current) setHoveredHand(null)
  }, [])

  const handleMouseUp = () => {
    isDrawing.current = false
    paintedHands.current = new Set()
  }

  const showActions = !heatmap || activeViewMode === 'actions'
  const showHeatmap = !!heatmap && activeViewMode === 'heatmap'

  return (
    <div className="relative">
      {showWarning && (
        <div className="absolute -top-9 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
            ⚠ Soma das frequências ultrapassa 100%
          </div>
        </div>
      )}

      {heatmap && !forceViewMode && (
        <div className="flex gap-1 mb-2">
          {(['actions', 'heatmap'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              aria-pressed={activeViewMode === mode}
              className={[
                'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                activeViewMode === mode
                  ? 'bg-brand-600 border-brand-500 text-white'
                  : 'bg-warm-800 border-warm-600 text-warm-400 hover:text-warm-200',
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
            className="fixed z-50 pointer-events-none px-2 py-1 rounded bg-warm-900 border border-warm-600 text-xs text-white shadow-lg whitespace-nowrap"
            style={{ left: mousePos.x + 14, top: mousePos.y - 28 }}
          >
            <span className="font-bold text-warm-300 mr-1">{hoveredHand}</span>{text}
          </div>
        )
      })()}

      <div
        className="grid gap-0.5 select-none mx-auto"
        style={{ gridTemplateColumns: 'repeat(13, 1fr)', maxWidth: 650 }}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setHoveredHand(null) }}
        onMouseMove={isHeatmapMode ? (e => setMousePos({ x: e.clientX, y: e.clientY })) : undefined}
      >
        {Array.from({ length: 13 }, (_, i) =>
          Array.from({ length: 13 }, (_, j) => {
            const hand = i === j
              ? RANKS[i] + RANKS[j]
              : i < j
                ? RANKS[i] + RANKS[j] + 's'
                : RANKS[j] + RANKS[i] + 'o'
            const data = grid[hand] ?? EMPTY_CELL
            return (
              <Cell
                key={hand}
                hand={hand}
                data={data}
                heatPerf={heatmap?.[hand]}
                isHeatmapMode={isHeatmapMode}
                showActions={showActions}
                showHeatmap={showHeatmap}
                extraColor={effectiveExtraColor}
                readOnly={readOnly}
                onDown={onDown}
                onEnter={onEnter}
                onLeave={onLeave}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
