import { useStore } from '../../store/useStore'
import { countNonFoldHands } from '../../utils/hands'
import { Edit3, Trash2, PlayCircle } from 'lucide-react'
import type { Range } from '../../types'

function RangeCard({ r }: { r: Range }) {
  const deleteRange      = useStore(s => s.deleteRange)
  const loadRangeForEdit = useStore(s => s.loadRangeForEdit)
  const startDrillSession = useStore(s => s.startDrillSession)
  const nextDrillHand    = useStore(s => s.nextDrillHand)
  const setPage          = useStore(s => s.setPage)

  function handleQuickDrill() {
    useStore.setState({ selectedDrillRangeIds: [r.id], drillExcludedHands: [] })
    startDrillSession()
    const ok = nextDrillHand()
    if (!ok) { alert('Nenhuma mão disponível neste range.'); return }
    setPage('drill')
  }

  const nonFold = countNonFoldHands(r.grid)

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 hover:border-gray-500 transition-all flex flex-col gap-3">
      <div>
        <div className="text-xs text-gray-500 font-semibold mb-1">
          {r.positions.join(', ')} · {r.scenarios.length} cenário(s)
        </div>
        <h3 className="font-bold text-white">{r.name}</h3>
        <div className="text-xs text-gray-400 mt-0.5">{nonFold} mãos não-fold</div>
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
          onClick={() => { if (confirm('Apagar este range?')) deleteRange(r.id) }}
          className="flex items-center justify-center py-1.5 px-2.5 rounded-lg bg-gray-700 hover:bg-red-900/30 text-xs text-gray-400 hover:text-red-400"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function RangeSection({ title, ranges, onCreateNew }: { title: string; ranges: Range[]; onCreateNew: () => void }) {
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
          {ranges.map(r => <RangeCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  )
}

export function SituationsPage() {
  const ranges  = useStore(s => s.ranges)
  const setPage = useStore(s => s.setPage)

  const ranges6 = ranges.filter(r => r.tableSize === 6)
  const ranges8 = ranges.filter(r => r.tableSize === 8)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Meus Ranges</h1>
        <p className="text-xs text-gray-400">{ranges.length} range(s) criado(s)</p>
      </div>

      <RangeSection title="6-max" ranges={ranges6} onCreateNew={() => setPage('range-setup')} />
      <RangeSection title="8-max" ranges={ranges8} onCreateNew={() => setPage('range-setup')} />
    </div>
  )
}
