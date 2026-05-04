import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { countNonFoldHands } from '../../utils/hands'
import { Edit3, Trash2, PlayCircle, BarChart2, ChevronLeft } from 'lucide-react'
import { HandMatrix } from '../RangeBuilder/HandMatrix'
import { POS_6MAX, POS_8MAX, SLOTS_6MAX, SLOTS_8MAX } from '../../types'
import type { Range, TableSize } from '../../types'

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

type Step = 'select' | 'list'

export function SituationsPage() {
  const ranges               = useStore(s => s.ranges)
  const setPage              = useStore(s => s.setPage)
  const handPerformance      = useStore(s => s.handPerformance)
  const clearHandPerformance = useStore(s => s.clearHandPerformance)

  const [step, setStep]                 = useState<Step>('select')
  const [selectedSize, setSelectedSize] = useState<TableSize | null>(null)
  const [selectedPos, setSelectedPos]   = useState<string[]>([])
  const [heatmapId, setHeatmapId]       = useState<number | null>(null)

  const positions = selectedSize === 6 ? POS_6MAX : POS_8MAX
  const slots     = selectedSize === 6 ? SLOTS_6MAX : SLOTS_8MAX

  function handleSizeSelect(size: TableSize) {
    if (selectedSize !== size) setSelectedPos([])
    setSelectedSize(size)
  }

  function togglePos(label: string) {
    setSelectedPos(prev => prev.includes(label) ? prev.filter(p => p !== label) : [...prev, label])
  }

  const filteredRanges = step === 'list' && selectedSize !== null
    ? ranges.filter(r => r.tableSize === selectedSize && r.positions.some(p => selectedPos.includes(p)))
    : []

  const heatmapRange = heatmapId !== null ? ranges.find(r => r.id === heatmapId) : null
  const heatmapPerf  = heatmapId !== null ? handPerformance[heatmapId] : undefined
  const hasData      = !!heatmapPerf && Object.values(heatmapPerf).some(p => p.t > 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        {step === 'list' && (
          <button onClick={() => setStep('select')} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-white">Meus Ranges</h1>
          <p className="text-xs text-gray-400">{ranges.length} range(s) criado(s)</p>
        </div>
      </div>

      {step === 'select' && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex gap-6">
            {([6, 8] as TableSize[]).map(size => (
              <button
                key={size}
                onClick={() => handleSizeSelect(size)}
                className={[
                  'w-36 h-24 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1',
                  selectedSize === size
                    ? 'border-brand-500 bg-brand-700/30 text-white'
                    : 'border-gray-600 bg-gray-800 hover:border-gray-400 text-gray-300',
                ].join(' ')}
              >
                <span className="text-2xl font-bold">{size}-max</span>
                <span className="text-xs text-gray-400">{ranges.filter(r => r.tableSize === size).length} range(s)</span>
              </button>
            ))}
          </div>

          {selectedSize !== null && (
            <div className="flex flex-col items-center gap-4 w-full max-w-sm">
              <p className="text-gray-300 text-sm">Selecione uma ou mais posições para o HERO.</p>

              {/* Poker table */}
              <div className="w-full" style={{ maxWidth: 320 }}>
                <div
                  className="relative w-full"
                  style={{
                    paddingBottom: '63%',
                    background: 'radial-gradient(ellipse at 40% 35%, #35654d 0%, #244a36 100%)',
                    borderRadius: '50%',
                    border: '10px solid #2e2e2e',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5), 0 0 0 4px #111',
                  }}
                >
                  {positions.map((pos, i) => {
                    const slot   = slots[i]
                    const active = selectedPos.includes(pos.label)
                    return (
                      <button
                        key={pos.id}
                        onClick={() => togglePos(pos.label)}
                        style={{ top: `${slot.t}%`, left: `${slot.l}%`, transform: 'translate(-50%,-50%)' }}
                        className={[
                          'absolute w-[46px] h-[46px] rounded-full border-2 font-bold text-xs flex items-center justify-center transition-all z-10',
                          active
                            ? 'bg-brand-600 border-white text-white shadow-[0_0_12px_rgba(99,102,241,0.8)]'
                            : 'bg-gray-800 border-gray-500 text-gray-300 hover:border-gray-200 hover:text-white',
                        ].join(' ')}
                      >
                        {pos.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={() => setStep('list')}
                disabled={selectedPos.length === 0}
                className="px-8 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'list' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-sm text-gray-300">
              {selectedSize}-max · {selectedPos.join(', ')}
            </h2>
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-500">{filteredRanges.length} range(s)</span>
          </div>

          {filteredRanges.length === 0 ? (
            <div className="bg-gray-800/30 border border-dashed border-gray-700 rounded-xl p-8 text-center">
              <p className="text-gray-500 text-sm mb-3">Nenhum range encontrado para as posições selecionadas.</p>
              <button
                onClick={() => setPage('range-setup')}
                className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Criar novo range
              </button>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {filteredRanges.map(r => <RangeCard key={r.id} r={r} onViewHeatmap={setHeatmapId} />)}
            </div>
          )}
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
