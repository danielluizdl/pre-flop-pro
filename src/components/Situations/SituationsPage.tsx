import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { countNonFoldHands } from '../../utils/hands'
import { Edit3, Trash2, PlayCircle, BarChart2 } from 'lucide-react'
import { HandMatrix } from '../RangeBuilder/HandMatrix'
import type { Range } from '../../types'

interface CardProps {
  r: Range
  onViewHeatmap: (id: number) => void
}

function RangeCard({ r, onViewHeatmap }: CardProps) {
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

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 hover:border-gray-500 transition-all flex flex-col gap-3">
      <div>
        <div className="text-xs text-gray-500 font-semibold mb-1">
          {r.positions.join(', ')} · {r.scenarios.length} cenário(s)
        </div>
        <h3 className="font-bold text-white">{r.name}</h3>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-gray-400">{nonFold} mãos não-fold</span>
          {accuracy !== null && (
            <span className={[
              'text-xs font-bold',
              accuracy >= 80 ? 'text-emerald-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400',
            ].join(' ')}>
              {accuracy}% acerto ({totalAnswered} mãos)
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-auto">
        <button
          onClick={handleQuickDrill}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-xs text-white"
        >
          <PlayCircle size={12} /> Treinar
        </button>
        <button
          onClick={() => loadRangeForEdit(r.id)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-200"
        >
          <Edit3 size={12} /> Editar
        </button>
        <button
          onClick={() => onViewHeatmap(r.id)}
          className="flex items-center justify-center py-1.5 px-2.5 rounded-lg bg-gray-700 hover:bg-orange-900/30 text-xs text-gray-400 hover:text-orange-400 transition-colors"
          title="Ver heatmap de erros"
        >
          <BarChart2 size={12} />
        </button>
        <button
          onClick={() => { if (confirm('Apagar este range?')) deleteRange(r.id) }}
          className="flex items-center justify-center py-1.5 px-2.5 rounded-lg bg-gray-700 hover:bg-red-900/30 text-xs text-gray-400 hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function RangeSection({ title, ranges, onCreateNew, onViewHeatmap }: {
  title: string
  ranges: Range[]
  onCreateNew: () => void
  onViewHeatmap: (id: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="font-bold text-sm text-gray-300">{title}</h2>
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-xs text-gray-500">{ranges.length} range(s)</span>
      </div>

      {ranges.length === 0 ? (
        <div className="bg-gray-800/30 border border-dashed border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm mb-3">Nenhum range {title.toLowerCase()} criado.</p>
          <button
            onClick={onCreateNew}
            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Criar range {title.toLowerCase()}
          </button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {ranges.map(r => <RangeCard key={r.id} r={r} onViewHeatmap={onViewHeatmap} />)}
        </div>
      )}
    </div>
  )
}

export function SituationsPage() {
  const ranges              = useStore(s => s.ranges)
  const setPage             = useStore(s => s.setPage)
  const handPerformance     = useStore(s => s.handPerformance)
  const clearHandPerformance = useStore(s => s.clearHandPerformance)

  const [heatmapId, setHeatmapId] = useState<number | null>(null)

  const ranges6 = ranges.filter(r => r.tableSize === 6)
  const ranges8 = ranges.filter(r => r.tableSize === 8)

  const heatmapRange = heatmapId !== null ? ranges.find(r => r.id === heatmapId) : null
  const heatmapPerf  = heatmapId !== null ? handPerformance[heatmapId] : undefined
  const hasData      = !!heatmapPerf && Object.values(heatmapPerf).some(p => p.t > 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Meus Ranges</h1>
        <p className="text-xs text-gray-400">{ranges.length} range(s) criado(s)</p>
      </div>

      <RangeSection title="6-max" ranges={ranges6} onCreateNew={() => setPage('range-setup')} onViewHeatmap={setHeatmapId} />
      <RangeSection title="8-max" ranges={ranges8} onCreateNew={() => setPage('range-setup')} onViewHeatmap={setHeatmapId} />

      {/* Heatmap modal */}
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
                <p className="text-xs text-gray-400 mt-0.5">
                  Heatmap de erros por combo — baseado em todo o histórico de treino
                </p>
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
                  ≥ 80% acerto
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(234,179,8,0.6)' }} />
                  50 – 79%
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
    </div>
  )
}
