import { useStore } from '../../store/useStore'
import { countNonFoldHands } from '../../utils/hands'

const CATEGORY_POSITIONS: Record<string, string[]> = {
  early:    ['UTG', 'MP', 'HJ'],
  late:     ['CO', 'BTN'],
  blinds:   ['SB', 'BB'],
  straddle: ['STR'],
}

const CATEGORY_LABELS: Record<string, { name: string; sub: string }> = {
  early:    { name: 'EARLY',    sub: 'UTG · MP · HJ' },
  late:     { name: 'LATE',     sub: 'CO · BTN' },
  blinds:   { name: 'BLINDS',  sub: 'SB · BB' },
  straddle: { name: 'STRADDLE', sub: 'STR' },
}

export function CategoryDetailPage() {
  const ranges            = useStore(s => s.ranges)
  const activeCategory    = useStore(s => s.activeCategory)
  const setPage           = useStore(s => s.setPage)
  const loadRangeForEdit  = useStore(s => s.loadRangeForEdit)
  const startDrillSession = useStore(s => s.startDrillSession)
  const nextDrillHand     = useStore(s => s.nextDrillHand)
  const handPerformance   = useStore(s => s.handPerformance)

  const catPositions   = CATEGORY_POSITIONS[activeCategory ?? ''] ?? []
  const categoryRanges = ranges.filter(r => r.positions.some(p => catPositions.includes(p)))
  const label          = CATEGORY_LABELS[activeCategory ?? ''] ?? { name: activeCategory?.toUpperCase() ?? '', sub: '' }

  function handleQuickDrill(rangeId: number) {
    useStore.setState({ selectedDrillRangeIds: [rangeId], drillExcludedHands: [] })
    startDrillSession()
    const ok = nextDrillHand()
    if (!ok) { alert('Nenhuma mão disponível neste range.'); return }
    setPage('drill')
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display uppercase text-warm-100 text-[28px] leading-none tracking-wide">
            {label.name}
          </h1>
          <p className="text-xs text-warm-400 mt-1">
            {label.sub} · {categoryRanges.length} range{categoryRanges.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setPage('dashboard')}
          className="px-4 py-2 bg-warm-800 hover:bg-warm-700 text-warm-300 border border-warm-600 rounded-lg text-sm font-semibold transition-colors"
        >
          ← Início
        </button>
      </div>

      {categoryRanges.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-warm-700 rounded-xl">
          <p className="text-warm-400 mb-4">Nenhum range nesta categoria.</p>
          <button
            onClick={() => setPage('range-setup')}
            className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Criar range
          </button>
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {categoryRanges.map(r => {
            const perf    = handPerformance[r.id]
            const entries = perf ? Object.values(perf) : []
            const totalT  = entries.reduce((s, p) => s + p.t, 0)
            const totalC  = entries.reduce((s, p) => s + p.c, 0)
            const accuracy = totalT > 0 ? Math.round((totalC / totalT) * 100) : null

            return (
              <div key={r.id} className="card-surface rounded-lg p-3 hover:border-warm-500 transition-all flex flex-col gap-2">
                <div>
                  <h3 className="font-bold text-white text-sm leading-tight">{r.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-warm-500">
                      {r.positions.join(', ')} · {countNonFoldHands(r.grid)} mãos · {r.scenarios.length} cenário{r.scenarios.length !== 1 ? 's' : ''}
                    </span>
                    {accuracy !== null && (
                      <span className={[
                        'font-bold tabular-nums text-sm ml-auto',
                        accuracy >= 80 ? 'text-green-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400',
                      ].join(' ')}>
                        {accuracy}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 mt-auto">
                  <button
                    onClick={() => handleQuickDrill(r.id)}
                    className="flex-1 py-1.5 rounded-md bg-warm-700 hover:bg-warm-600 text-xs text-white font-semibold transition-colors"
                    style={{ background: 'var(--claude-600)' }}
                  >
                    Treinar
                  </button>
                  <button
                    onClick={() => loadRangeForEdit(r.id)}
                    className="flex-1 py-1.5 rounded-md bg-warm-700 hover:bg-warm-600 text-xs text-warm-200 font-semibold transition-colors"
                  >
                    Editar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
