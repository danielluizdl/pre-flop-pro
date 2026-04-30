import { useStore } from '../../store/useStore'
import { HandMatrix } from './HandMatrix'
import { BrushControls } from './BrushControls'

export function RangeEditorPage() {
  const activePositions    = useStore(s => s.activePositions)
  const selectedPositions  = useStore(s => s.selectedEditorPositions)
  const togglePosition     = useStore(s => s.toggleEditorPosition)
  const rangeData          = useStore(s => s.rangeData)
  const setRangeName       = useStore(s => s.setRangeName)
  const resetGrid          = useStore(s => s.resetGrid)
  const setPage            = useStore(s => s.setPage)
  const initTableConfig    = useStore(s => s.initTableConfig)

  function handleNext() {
    if (!rangeData.name.trim()) { alert('Dê um nome ao range.'); return }
    if (selectedPositions.length === 0) { alert('Selecione pelo menos uma posição.'); return }
    useStore.setState({
      rangeData: { ...rangeData, positions: [...selectedPositions] },
      ...(rangeData.id === null ? { tempScenarios: [] } : {}),
    })
    initTableConfig()
    setPage('table-editor')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">
          {rangeData.id !== null ? 'Editar Range' : 'Criar Range'}
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Pinte as mãos com as frequências de cada ação, depois configure os cenários de mesa.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left: positions + name + matrix */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Positions */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              1. Posições onde este range se aplica
            </label>
            <div className="flex gap-2 flex-wrap">
              {activePositions.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePosition(p.label)}
                  className={[
                    'px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
                    selectedPositions.includes(p.label)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              2. Nome do Range / Situação
            </label>
            <input
              type="text"
              className="w-full p-2.5 border border-gray-600 rounded-lg text-sm bg-gray-800 text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
              placeholder="Ex: Defesa BB vs UTG"
              value={rangeData.name}
              onChange={e => setRangeName(e.target.value)}
            />
          </div>

          {/* Matrix */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              3. Grade de Mãos
            </label>
            <HandMatrix />
          </div>
        </div>

        {/* Right: brush + actions */}
        <div className="xl:w-72 space-y-3">
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
            <h3 className="font-bold text-sm text-gray-300 mb-3 uppercase tracking-wider">
              4. Ações & Frequências
            </h3>
            <BrushControls />
          </div>

          <button
            onClick={() => { if (confirm('Limpar todo o grid?')) resetGrid() }}
            className="w-full py-2.5 bg-gray-800 text-red-400 border border-red-900/50 rounded-lg font-semibold text-sm hover:bg-red-900/20 transition-colors"
          >
            Limpar Grid
          </button>

          <button
            onClick={handleNext}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold text-sm transition-colors"
          >
            PRÓXIMO: CONFIGURAR CENÁRIOS →
          </button>
        </div>
      </div>
    </div>
  )
}
