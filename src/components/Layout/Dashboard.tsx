import { useStore } from '../../store/useStore'
import { PlayCircle, Edit3, Plus, ChevronRight } from 'lucide-react'
import { countNonFoldHands } from '../../utils/hands'

export function Dashboard() {
  const ranges          = useStore(s => s.ranges)
  const setPage         = useStore(s => s.setPage)
  const trainingHistory = useStore(s => s.trainingHistory)

  const totalHands = trainingHistory.reduce((s, x) => s + x.hands, 0)
  const totalCorrect = trainingHistory.reduce((s, x) => s + x.correct, 0)
  const globalAccuracy = totalHands > 0 ? Math.round((totalCorrect / totalHands) * 100) : null

  const recentRanges = [...ranges].slice(-3).reverse()

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-900/40 to-gray-800/60 border border-brand-800/50 rounded-2xl p-6">
        <h1 className="text-3xl font-black text-white mb-1">
          Free<span className="text-brand-400">Bet</span>Range
        </h1>
        <p className="text-gray-400 mb-5">Treine seus ranges pré-flop e melhore suas decisões na mesa.</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setPage('drill')}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-105"
          >
            <PlayCircle size={18} /> Iniciar Treino
          </button>
          <button
            onClick={() => setPage('range-setup')}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm"
          >
            <Plus size={18} /> Novo Range
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Ranges', value: ranges.length.toString(), color: 'text-brand-400' },
          { label: 'Mãos Treinadas', value: totalHands > 0 ? totalHands.toLocaleString() : '0', color: 'text-blue-400' },
          {
            label: 'Precisão Global',
            value: globalAccuracy !== null ? `${globalAccuracy}%` : '—',
            color: globalAccuracy === null ? 'text-gray-500'
                 : globalAccuracy >= 70 ? 'text-emerald-400'
                 : globalAccuracy >= 50 ? 'text-yellow-400' : 'text-red-400',
          },
        ].map(item => (
          <div key={item.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Recent ranges */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Ranges Recentes</h2>
          <button
            onClick={() => setPage('ranges')}
            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
          >
            Ver todos <ChevronRight size={12} />
          </button>
        </div>

        {recentRanges.length === 0 ? (
          <div className="bg-gray-800/40 border border-dashed border-gray-600 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm mb-3">Nenhum range criado.</p>
            <button
              onClick={() => setPage('range-setup')}
              className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm"
            >
              Criar primeiro range
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentRanges.map(r => {
              const nonFold = countNonFoldHands(r.grid)
              return (
                <div
                  key={r.id}
                  className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex flex-col gap-3"
                >
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">
                      {r.positions.join(', ')} · {r.tableSize}-max
                    </div>
                    <div className="font-semibold text-white text-sm">{r.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{nonFold} mãos não-fold · {r.scenarios.length} cenário(s)</div>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => {
                        useStore.setState({ selectedDrillRangeIds: [r.id], drillExcludedHands: [] })
                        useStore.getState().startDrillSession()
                        const ok = useStore.getState().nextDrillHand()
                        if (ok) setPage('drill')
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-xs text-white"
                    >
                      <PlayCircle size={11} /> Treinar
                    </button>
                    <button
                      onClick={() => useStore.getState().loadRangeForEdit(r.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-200"
                    >
                      <Edit3 size={11} /> Editar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { icon: '🎯', title: 'Treino com RNG', desc: 'Veja uma mão, o RNG sorteado e escolha a ação correta', page: 'drill' as const },
          { icon: '🛠️', title: 'Editor de Ranges', desc: 'Crie ranges com frequências por ação (Call/Raise/All-In) e configure múltiplos cenários de mesa', onClick: () => setPage('range-setup') },
          { icon: '📊', title: 'Histórico', desc: 'Acompanhe sua precisão, sessões e evolução ao longo do tempo', page: 'history' as const },
        ].map(feature => (
          <button
            key={feature.title}
            onClick={feature.onClick ?? (() => feature.page && setPage(feature.page))}
            className="bg-gray-800/40 hover:bg-gray-800/80 border border-gray-700 hover:border-gray-500 rounded-xl p-4 text-left transition-all group"
          >
            <div className="text-2xl mb-2">{feature.icon}</div>
            <div className="font-semibold text-white text-sm group-hover:text-brand-400 transition-colors">{feature.title}</div>
            <div className="text-xs text-gray-400 mt-1">{feature.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
