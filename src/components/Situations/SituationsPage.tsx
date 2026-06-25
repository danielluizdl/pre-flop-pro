import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { countNonFoldHands } from '../../utils/hands'
import { Edit3, Trash2, PlayCircle, BarChart2, Eye, Link2 } from 'lucide-react'

import { HandMatrix } from '../RangeBuilder/HandMatrix'
import { RangePreviewModal } from '../ui/RangePreviewModal'
import type { Range } from '../../types'

const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'UTG']

interface CardProps {
  r: Range
  allRanges: Range[]
  onViewHeatmap: (id: number) => void
  onPreview: (id: number) => void
}

function RangeCard({ r, allRanges, onViewHeatmap, onPreview }: CardProps) {
  const deleteRange       = useStore(s => s.deleteRange)
  const loadRangeForEdit  = useStore(s => s.loadRangeForEdit)
  const startDrillSession = useStore(s => s.startDrillSession)
  const nextDrillHand     = useStore(s => s.nextDrillHand)
  const setPage           = useStore(s => s.setPage)
  const handPerformance   = useStore(s => s.handPerformance)

  function handleQuickDrill() {
    useStore.setState({ selectedDrillRangeIds: [r.id], drillExcludedHands: [] })
    startDrillSession()
    const ok = nextDrillHand()
    if (!ok) { alert('Nenhuma mão disponível neste range.'); return }
    setPage('drill')
  }

  const nonFold = countNonFoldHands(r.grid)
  const perf    = handPerformance[r.id]
  const perfEntries = perf ? Object.values(perf) : []
  const totalAnswered = perfEntries.reduce((s, p) => s + p.t, 0)
  const totalCorrect  = perfEntries.reduce((s, p) => s + p.c, 0)
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : null
  const prereqRange = r.prereqRangeId !== undefined ? allRanges.find(x => x.id === r.prereqRangeId) : undefined

  return (
    <div className="card-surface rounded-lg p-3 hover:border-warm-500 transition-all flex flex-col gap-2">
      <div>
        <div className="flex items-start gap-1.5 flex-wrap">
          <h2 className="font-bold text-white text-sm leading-tight">{r.name}</h2>
          {r.stackGrids && r.stackGrids.length > 0 ? (
            r.stackGrids.map((sg, i) => sg.stackRange && (
              <span key={i} className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-500/10 border border-brand-500/40 text-brand-400 flex-shrink-0 leading-tight">
                {sg.stackRange}
              </span>
            ))
          ) : r.stackRange ? (
            <span className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-500/10 border border-brand-500/40 text-brand-400 flex-shrink-0 leading-tight">
              {r.stackRange}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-warm-500">{nonFold} mãos · {r.scenarios.length} cenário{r.scenarios.length !== 1 ? 's' : ''}</span>
          {accuracy !== null && (
            <span className={[
              'font-stat font-black tabular-nums text-sm',
              accuracy >= 80 ? 'text-brand-500' : accuracy >= 50 ? 'text-gold' : 'text-result-bad',
            ].join(' ')}>
              {accuracy}%
              <span className="text-warm-500 font-medium text-xs ml-1">({totalAnswered})</span>
            </span>
          )}
        </div>
        {prereqRange && (
          <div className="flex items-center gap-1 mt-1">
            <Link2 size={9} className="text-sky-500 flex-shrink-0" />
            <span className="text-[0.6rem] text-sky-400 leading-tight truncate">{prereqRange.name}</span>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 mt-auto">
        <button
          onClick={handleQuickDrill}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-brand-700 hover:bg-brand-600 text-xs text-white transition-colors"
        >
          <PlayCircle size={11} /> Treinar
        </button>
        <button
          onClick={() => loadRangeForEdit(r.id)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-warm-700 hover:bg-warm-600 text-xs text-warm-200 transition-colors"
        >
          <Edit3 size={11} /> Editar
        </button>
        <button
          onClick={() => onPreview(r.id)}
          className="flex items-center justify-center py-1.5 px-2 rounded-md bg-warm-700 hover:bg-blue-900/30 text-xs text-warm-400 hover:text-blue-400 transition-colors"
          title="Visualizar range"
        >
          <Eye size={11} />
        </button>
        <button
          onClick={() => onViewHeatmap(r.id)}
          className="flex items-center justify-center py-1.5 px-2 rounded-md bg-warm-700 hover:bg-orange-900/30 text-xs text-warm-400 hover:text-orange-400 transition-colors"
          title="Ver heatmap"
        >
          <BarChart2 size={11} />
        </button>
        <button
          onClick={() => { if (confirm('Apagar este range?')) deleteRange(r.id) }}
          className="flex items-center justify-center py-1.5 px-2 rounded-md bg-warm-700 hover:bg-red-900/30 text-xs text-warm-400 hover:text-red-400 transition-colors"
          title="Apagar range"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

export function SituationsPage() {
  const ranges               = useStore(s => s.ranges)
  const setPage              = useStore(s => s.setPage)
  const handPerformance      = useStore(s => s.handPerformance)
  const clearHandPerformance = useStore(s => s.clearHandPerformance)

  const [openGroups, setOpenGroups]       = useState<Set<string>>(new Set())
  const [heatmapId, setHeatmapId]         = useState<number | null>(null)
  const [heatmapGridIdx, setHeatmapGridIdx] = useState(0)
  const [previewId, setPreviewId]         = useState<number | null>(null)

  function openHeatmap(id: number) {
    setHeatmapId(id)
    setHeatmapGridIdx(0)
  }

  function toggleGroup(pos: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(pos) ? next.delete(pos) : next.add(pos)
      return next
    })
  }

  // Group ranges by each position label
  const grouped: Record<string, Range[]> = {}
  for (const r of ranges) {
    for (const pos of r.positions) {
      if (!grouped[pos]) grouped[pos] = []
      grouped[pos].push(r)
    }
  }

  const orderedKeys = [
    ...POSITION_ORDER.filter(p => grouped[p]),
    ...Object.keys(grouped).filter(p => !POSITION_ORDER.includes(p)).sort(),
  ]

  const heatmapRange    = heatmapId !== null ? ranges.find(r => r.id === heatmapId) : null
  const heatmapPerf     = heatmapId !== null ? handPerformance[heatmapId] : undefined
  const hasData         = !!heatmapPerf && Object.values(heatmapPerf).some(p => p.t > 0)
  const heatmapGrids    = heatmapRange?.stackGrids && heatmapRange.stackGrids.length > 0
    ? heatmapRange.stackGrids
    : null
  const safeGridIdx     = heatmapGrids ? Math.min(heatmapGridIdx, heatmapGrids.length - 1) : 0
  const heatmapGrid     = heatmapGrids ? heatmapGrids[safeGridIdx].grid : (heatmapRange?.grid ?? {})

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display uppercase text-warm-100 text-[28px] leading-none tracking-wide">Meus Ranges</h1>
          <p className="text-xs text-warm-400 mt-0.5">{ranges.length} range{ranges.length !== 1 ? 's' : ''} criado{ranges.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setPage('range-setup')}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          + Novo Range
        </button>
      </div>

      {ranges.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-warm-700 rounded-xl">
          <p className="text-warm-400 mb-4">Nenhum range criado ainda.</p>
          <button
            onClick={() => setPage('range-setup')}
            className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"
          >
            Criar primeiro range
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {orderedKeys.map(pos => {
            const group  = grouped[pos]
            const isOpen = openGroups.has(pos)

            return (
              <div key={pos} className="border border-warm-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(pos)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-warm-800 hover:bg-warm-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-white text-sm w-10 text-left">{pos}</span>
                    <span className="text-warm-400 text-xs">{group.length} range{group.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span className={`text-warm-400 text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    ›
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-warm-700 bg-warm-900/40 p-3 grid gap-2"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                    {group.map(r => (
                      <RangeCard key={r.id} r={r} allRanges={ranges} onViewHeatmap={openHeatmap} onPreview={setPreviewId} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {heatmapRange && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setHeatmapId(null)}
        >
          <div
            className="bg-warm-900 border border-warm-700 rounded-2xl p-6 max-w-3xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-white text-lg">{heatmapRange.name}</h3>
                <p className="text-xs text-warm-400 mt-0.5">Heatmap de erros por combo</p>
              </div>
              <button onClick={() => setHeatmapId(null)} className="text-warm-400 hover:text-white text-xl ml-4">✕</button>
            </div>

            {heatmapGrids && (
              <div className="flex gap-1.5 flex-wrap mb-4">
                {heatmapGrids.map((sg, i) => (
                  <button
                    key={i}
                    onClick={() => setHeatmapGridIdx(i)}
                    className={[
                      'px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors',
                      safeGridIdx === i
                        ? 'bg-brand-600 border-brand-500 text-white'
                        : 'bg-warm-800 border-warm-600 text-warm-400 hover:bg-warm-700',
                    ].join(' ')}
                  >
                    {sg.stackRange || `Grid ${i + 1}`}
                  </button>
                ))}
              </div>
            )}

            {!hasData ? (
              <div className="text-center py-12 text-warm-500">
                <p className="mb-2">Nenhum dado de treino ainda.</p>
                <p className="text-xs">Treine este range para gerar o heatmap.</p>
              </div>
            ) : (
              <HandMatrix readOnly grid={heatmapGrid} heatmap={heatmapPerf} />
            )}

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-warm-700">
              <div className="flex gap-4 text-xs text-warm-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(34,197,94,0.6)' }} />
                  ≥ 80%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(234,179,8,0.6)' }} />
                  50–79%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(239,68,68,0.6)' }} />
                  &lt; 50%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block bg-warm-700 border border-warm-600" />
                  Não treinado
                </span>
              </div>
              {hasData && (
                <button
                  onClick={() => { clearHandPerformance(heatmapId!); setHeatmapId(null) }}
                  className="text-xs text-warm-500 hover:text-red-400 transition-colors"
                >
                  Resetar dados
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {previewId !== null && (() => {
        const r = ranges.find(x => x.id === previewId)
        return r ? <RangePreviewModal range={r} onClose={() => setPreviewId(null)} /> : null
      })()}
    </div>
  )
}
