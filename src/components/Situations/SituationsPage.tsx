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
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 hover:border-gray-500 transition-all flex flex-col gap-2">
      <div>
        <div className="flex items-start gap-1.5 flex-wrap">
          <h3 className="font-bold text-white text-sm leading-tight">{r.name}</h3>
          {r.stackGrids && r.stackGrids.length > 0 ? (
            r.stackGrids.map((sg, i) => sg.stackRange && (
              <span key={i} className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-900/40 border border-brand-700/50 text-brand-400 flex-shrink-0 leading-tight">
                {sg.stackRange}
              </span>
            ))
          ) : r.stackRange ? (
            <span className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-900/40 border border-brand-700/50 text-brand-400 flex-shrink-0 leading-tight">
              {r.stackRange}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-gray-500">{nonFold} mãos · {r.scenarios.length} cenário{r.scenarios.length !== 1 ? 's' : ''}</span>
          {accuracy !== null && (
            <span className={[
              'text-xs font-bold',
              accuracy >= 80 ? 'text-emerald-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400',
            ].join(' ')}>
              {accuracy}% ({totalAnswered})
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
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 transition-colors"
        >
          <Edit3 size={11} /> Editar
        </button>
        <button
          onClick={() => onPreview(r.id)}
          className="flex items-center justify-center py-1.5 px-2 rounded-md bg-gray-700 hover:bg-blue-900/30 text-xs text-gray-400 hover:text-blue-400 transition-colors"
          title="Visualizar range"
        >
          <Eye size={11} />
        </button>
        <button
          onClick={() => onViewHeatmap(r.id)}
          className="flex items-center justify-center py-1.5 px-2 rounded-md bg-gray-700 hover:bg-orange-900/30 text-xs text-gray-400 hover:text-orange-400 transition-colors"
          title="Ver heatmap"
        >
          <BarChart2 size={11} />
        </button>
        <button
          onClick={() => { if (confirm('Apagar este range?')) deleteRange(r.id) }}
          className="flex items-center justify-center py-1.5 px-2 rounded-md bg-gray-700 hover:bg-red-900/30 text-xs text-gray-400 hover:text-red-400 transition-colors"
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

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [heatmapId, setHeatmapId]   = useState<number | null>(null)
  const [previewId, setPreviewId]   = useState<number | null>(null)

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

  const heatmapRange = heatmapId !== null ? ranges.find(r => r.id === heatmapId) : null
  const heatmapPerf  = heatmapId !== null ? handPerformance[heatmapId] : undefined
  const hasData      = !!heatmapPerf && Object.values(heatmapPerf).some(p => p.t > 0)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Meus Ranges</h1>
          <p className="text-xs text-gray-400 mt-0.5">{ranges.length} range{ranges.length !== 1 ? 's' : ''} criado{ranges.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setPage('range-setup')}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          + Novo Range
        </button>
      </div>

      {ranges.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-700 rounded-xl">
          <p className="text-gray-400 mb-4">Nenhum range criado ainda.</p>
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
              <div key={pos} className="border border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(pos)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-white text-sm w-10 text-left">{pos}</span>
                    <span className="text-gray-400 text-xs">{group.length} range{group.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span className={`text-gray-400 text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    ›
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-700 bg-gray-900/40 p-3 grid gap-2"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                    {group.map(r => (
                      <RangeCard key={r.id} r={r} allRanges={ranges} onViewHeatmap={setHeatmapId} onPreview={setPreviewId} />
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
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-3xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-white text-lg">{heatmapRange.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Heatmap de erros por combo</p>
              </div>
              <button onClick={() => setHeatmapId(null)} className="text-gray-400 hover:text-white text-xl ml-4">✕</button>
            </div>

            {!hasData ? (
              <div className="text-center py-12 text-gray-500">
                <p className="mb-2">Nenhum dado de treino ainda.</p>
                <p className="text-xs">Treine este range para gerar o heatmap.</p>
              </div>
            ) : (
              <HandMatrix readOnly grid={heatmapRange.grid} heatmap={heatmapPerf} />
            )}

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
              <div className="flex gap-4 text-xs text-gray-400">
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
                  <span className="w-3 h-3 rounded-sm inline-block bg-gray-700 border border-gray-600" />
                  Não treinado
                </span>
              </div>
              {hasData && (
                <button
                  onClick={() => { clearHandPerformance(heatmapId!); setHeatmapId(null) }}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
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
