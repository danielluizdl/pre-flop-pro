import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { HandMatrix } from './HandMatrix'
import { BrushControls } from './BrushControls'
import { HandQuickSelect } from '../ui/HandQuickSelect'
import { countNonFoldHands, stackRangesOverlap } from '../../utils/hands'
import type { SessionGrid } from '../../types'

export function RangeEditorPage() {
  const activePositions   = useStore(s => s.activePositions)
  const selectedPositions = useStore(s => s.selectedEditorPositions)
  const togglePosition    = useStore(s => s.toggleEditorPosition)
  const rangeData         = useStore(s => s.rangeData)
  const setRangeName      = useStore(s => s.setRangeName)
  const setStackRange     = useStore(s => s.setStackRange)
  const resetGrid         = useStore(s => s.resetGrid)
  const setPage           = useStore(s => s.setPage)
  const initTableConfig   = useStore(s => s.initTableConfig)
  const sessionGrids      = useStore(s => s.sessionGrids)
  const pushGridToSession = useStore(s => s.pushGridToSession)
  const updateSessionGrid = useStore(s => s.updateSessionGrid)

  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [snapshot, setSnapshot]     = useState<SessionGrid | null>(null)

  // Returns overlap error message against session grids of the same position,
  // optionally excluding one index (for save-edit validation).
  function checkOverlap(stackRange: string, excludeIdx: number | null = null): string | null {
    if (!stackRange) return null
    const posKey = [...selectedPositions].sort().join(',')
    for (let i = 0; i < sessionGrids.length; i++) {
      if (i === excludeIdx) continue
      const sg = sessionGrids[i]
      const sgKey = [...sg.positions].sort().join(',')
      if (sgKey !== posKey) continue
      if (stackRangesOverlap(stackRange, sg.stackRange)) {
        return `"${stackRange}" se sobrepõe com "${sg.stackRange || 'sem range'}" (grid #${i + 1}).`
      }
    }
    return null
  }

  function validate() {
    if (!rangeData.name.trim()) { alert('Dê um nome ao range.'); return false }
    if (selectedPositions.length === 0) { alert('Selecione pelo menos uma posição.'); return false }
    return true
  }

  function handleNext() {
    // If the current editor is empty but session grids exist, proceed without adding current state
    const currentIsEmpty = !rangeData.name.trim() && selectedPositions.length === 0
    if (currentIsEmpty && sessionGrids.length > 0) {
      initTableConfig()
      setPage('table-editor')
      return
    }
    if (!validate()) return
    useStore.setState({
      rangeData: { ...rangeData, positions: [...selectedPositions] },
      ...(rangeData.id === null && sessionGrids.length === 0 ? { tempScenarios: [] } : {}),
    })
    initTableConfig()
    setPage('table-editor')
  }

  function handlePushToSession() {
    if (!validate()) return
    const overlapMsg = checkOverlap(rangeData.stackRange)
    if (overlapMsg) { alert(`Stack range inválido: ${overlapMsg}`); return }
    pushGridToSession()
  }

  function loadSessionForEdit(idx: number) {
    const sg = sessionGrids[idx]
    setSnapshot({
      name: rangeData.name,
      stackRange: rangeData.stackRange,
      grid: JSON.parse(JSON.stringify(rangeData.grid)),
      positions: [...selectedPositions],
    })
    useStore.setState({
      rangeData: { ...rangeData, name: sg.name, stackRange: sg.stackRange, grid: JSON.parse(JSON.stringify(sg.grid)) },
      selectedEditorPositions: [...sg.positions],
    })
    setEditingIdx(idx)
  }

  function handleCancelSessionEdit() {
    if (!snapshot) return
    useStore.setState({
      rangeData: { ...rangeData, name: snapshot.name, stackRange: snapshot.stackRange, grid: snapshot.grid },
      selectedEditorPositions: snapshot.positions,
    })
    setEditingIdx(null)
    setSnapshot(null)
  }

  function handleSaveSessionEdit() {
    if (editingIdx === null) return
    const overlapMsg = checkOverlap(rangeData.stackRange, editingIdx)
    if (overlapMsg) { alert(`Stack range inválido: ${overlapMsg}`); return }
    updateSessionGrid(editingIdx, {
      name: rangeData.name,
      stackRange: rangeData.stackRange,
      grid: JSON.parse(JSON.stringify(rangeData.grid)),
      positions: [...selectedPositions],
    })
    if (snapshot) {
      useStore.setState({
        rangeData: { ...rangeData, name: snapshot.name, stackRange: snapshot.stackRange, grid: snapshot.grid },
        selectedEditorPositions: snapshot.positions,
      })
    }
    setEditingIdx(null)
    setSnapshot(null)
  }

  const editingOriginal = editingIdx !== null ? sessionGrids[editingIdx] : null
  const hasChanges = editingOriginal !== null && (
    rangeData.name !== editingOriginal.name ||
    rangeData.stackRange !== editingOriginal.stackRange ||
    JSON.stringify(selectedPositions) !== JSON.stringify(editingOriginal.positions) ||
    JSON.stringify(rangeData.grid) !== JSON.stringify(editingOriginal.grid)
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">
          {rangeData.id !== null ? 'Editar Range' : 'Criar Range'}
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Pinte as mãos com as frequências de cada ação, depois configure os cenários.
        </p>
      </div>

      {/* Preview da sessão */}
      {sessionGrids.length > 0 && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Salvos nesta sessão ({sessionGrids.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {sessionGrids.map((sg, i) => (
              <button
                key={i}
                onClick={() => editingIdx === i ? handleCancelSessionEdit() : loadSessionForEdit(i)}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border transition-colors text-left',
                  editingIdx === i
                    ? 'bg-brand-900/30 border-brand-600/60 ring-1 ring-brand-600/40'
                    : 'bg-gray-900 border-gray-700 hover:border-gray-500',
                ].join(' ')}
              >
                <span className="text-xs font-semibold text-white">{sg.name}</span>
                {sg.stackRange && (
                  <span className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-900/40 border border-brand-700/50 text-brand-400 leading-tight">
                    {sg.stackRange}
                  </span>
                )}
                <span className="text-xs text-gray-500">{countNonFoldHands(sg.grid)} mãos</span>
                {editingIdx === i && <span className="text-[10px] text-brand-400 font-bold ml-1">editando</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-5">
        {/* Left: positions + name + matrix */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Posição do HERO — single select */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              Posição do HERO
            </label>
            <div className="flex gap-1.5 flex-wrap">
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

          {/* Nome */}
          <div className="flex items-center gap-2 max-w-xs">
            <label className="text-xs font-semibold text-gray-400 whitespace-nowrap flex-shrink-0">
              Nome:
            </label>
            <input
              type="text"
              className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-600 rounded-lg text-sm bg-gray-800 text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
              placeholder="Ex: Defesa BB vs UTG"
              value={rangeData.name}
              onChange={e => setRangeName(e.target.value)}
            />
          </div>

          {/* Stack Efetivo */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-400 whitespace-nowrap flex-shrink-0">
                Stack:
              </label>
              <input
                type="text"
                className="w-52 px-2.5 py-1.5 border border-gray-600 rounded-lg text-sm bg-gray-800 text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
                placeholder="Ex: <= 250, ou 250-300"
                value={rangeData.stackRange}
                onChange={e => setStackRange(e.target.value)}
              />
              {rangeData.stackRange && (
                <button
                  onClick={() => setStackRange('')}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  limpar
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['<=250bb', '250-300bb', '>=300bb'].map(p => (
                <button
                  key={p}
                  onClick={() => setStackRange(rangeData.stackRange === p ? '' : p)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors',
                    rangeData.stackRange === p
                      ? 'bg-brand-600 border-brand-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500',
                  ].join(' ')}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Matrix */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              Grade de Mãos
            </label>
            <HandMatrix />
          </div>
        </div>

        {/* Right: ações + frequências */}
        <div className="xl:w-80 space-y-3 flex-shrink-0">
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider whitespace-nowrap">
                Ações &amp; Frequências
              </h3>
              <HandQuickSelect mode="brush" />
            </div>

            <div className="border-t border-gray-700/60" />

            <BrushControls />
          </div>

          <button
            onClick={() => { if (confirm('Limpar todo o grid?')) resetGrid() }}
            className="w-full py-2 bg-gray-800 text-red-400 border border-red-900/50 rounded-lg font-semibold text-sm hover:bg-red-900/20 transition-colors"
          >
            Limpar Grid
          </button>

          {editingIdx !== null ? (
            <>
              <button
                onClick={handleSaveSessionEdit}
                disabled={!hasChanges}
                className={[
                  'w-full py-2.5 rounded-lg font-bold text-sm transition-colors border',
                  hasChanges
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed',
                ].join(' ')}
              >
                Salvar alterações no #{editingIdx + 1}
              </button>
              <button
                onClick={handleCancelSessionEdit}
                className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold text-sm transition-colors border border-gray-600"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={handlePushToSession}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold text-sm transition-colors border border-gray-600"
            >
              + Salvar e criar outro
            </button>
          )}

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
