import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { HandMatrix } from './HandMatrix'
import { BrushControls } from './BrushControls'
import { HandQuickSelect } from '../ui/HandQuickSelect'
import { ComboCounter } from '../ui/ComboCounter'
import { countNonFoldHands, stackRangesOverlap } from '../../utils/hands'
import { Link2, X } from 'lucide-react'
import { PrereqRangePicker } from '../ui/PrereqRangePicker'
import { t } from '../../i18n'
import type { SessionGrid } from '../../types'

export function RangeEditorPage() {
  const activePositions   = useStore(s => s.activePositions)
  const selectedPositions = useStore(s => s.selectedEditorPositions)
  const togglePosition    = useStore(s => s.toggleEditorPosition)
  const rangeData         = useStore(s => s.rangeData)
  const setRangeName      = useStore(s => s.setRangeName)
  const setStackRange     = useStore(s => s.setStackRange)
  const setEditorPrereq   = useStore(s => s.setEditorPrereq)
  const ranges            = useStore(s => s.ranges)
  const resetGrid         = useStore(s => s.resetGrid)
  const setPage           = useStore(s => s.setPage)
  const initTableConfig   = useStore(s => s.initTableConfig)
  const sessionGrids      = useStore(s => s.sessionGrids)
  const pushGridToSession = useStore(s => s.pushGridToSession)
  const updateSessionGrid = useStore(s => s.updateSessionGrid)
  const removeSessionGrid = useStore(s => s.removeSessionGrid)
  const brush             = useStore(s => s.brush)

  const [editingIdx, setEditingIdx]       = useState<number | null>(null)
  const [snapshot, setSnapshot]           = useState<SessionGrid | null>(null)
  const [prereqPickerOpen, setPrereqPickerOpen] = useState(false)

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
    if (!rangeData.name.trim()) { alert(t.editor.alertNameRequired); return false }
    if (selectedPositions.length === 0) { alert(t.editor.alertSelectPosition); return false }
    return true
  }

  function handleNext() {
    // If viewing/editing a session grid: save only if changes were made, otherwise cancel
    if (editingIdx !== null) {
      if (hasChanges) handleSaveSessionEdit()
      else handleCancelSessionEdit()
    }

    const s = useStore.getState()
    const freshName      = s.rangeData.name
    const freshPositions = s.selectedEditorPositions
    const freshSessions  = s.sessionGrids

    const currentIsEmpty = !freshName.trim() && freshPositions.length === 0
    if (currentIsEmpty && freshSessions.length > 0) {
      initTableConfig()
      setPage('table-editor')
      return
    }
    if (!freshName.trim()) { alert('Dê um nome ao range.'); return }
    if (freshPositions.length === 0) { alert('Selecione pelo menos uma posição.'); return }
    useStore.setState({
      rangeData: { ...s.rangeData, positions: freshPositions },
      ...(s.rangeData.id === null && freshSessions.length === 0 ? { tempScenarios: [] } : {}),
    })
    initTableConfig()
    setPage('table-editor')
  }

  function handlePushToSession() {
    if (!validate()) return
    const overlapMsg = checkOverlap(rangeData.stackRange)
    if (overlapMsg) { alert(t.editor.alertInvalidStack(overlapMsg)); return }
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
    if (overlapMsg) { alert(t.editor.alertInvalidStack(overlapMsg)); return }
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
        <h1 className="font-display uppercase text-warm-100 text-[28px] leading-none tracking-wide">
          {rangeData.id !== null ? t.editor.titleEdit : t.editor.titleCreate}
        </h1>
        <p className="text-xs text-warm-500 mt-0.5">
          {t.editor.subtitle}
        </p>
      </div>

      {/* Preview da sessão */}
      {sessionGrids.length > 0 && (
        <div className="card-surface p-3 space-y-2">
          <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide">
            {t.editor.savedThisSession(sessionGrids.length)}
          </p>
          <div className="flex flex-wrap gap-2">
            {sessionGrids.map((sg, i) => (
              <div
                key={i}
                className={[
                  'relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 pr-7 border transition-colors cursor-pointer',
                  editingIdx === i
                    ? 'bg-brand-900/30 border-brand-600/60 ring-1 ring-brand-600/40'
                    : 'bg-warm-900 border-warm-700 hover:border-warm-500',
                ].join(' ')}
                onClick={() => editingIdx === i ? handleCancelSessionEdit() : loadSessionForEdit(i)}
              >
                <span className="text-xs font-semibold text-warm-100">{sg.name}</span>
                {sg.stackRange && (
                  <span className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-500/10 border border-brand-500/40 text-brand-400 leading-tight">
                    {sg.stackRange}
                  </span>
                )}
                <span className="text-xs text-warm-500">{countNonFoldHands(sg.grid)} {t.common.hands}</span>
                {editingIdx === i && <span className="text-[10px] text-brand-400 font-bold ml-1">{t.editor.editing}</span>}
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (!confirm(t.editor.removeConfirm(`${sg.name}${sg.stackRange ? ` (${sg.stackRange})` : ''}`))) return
                    if (editingIdx === i) {
                      handleCancelSessionEdit()
                    } else if (editingIdx !== null && editingIdx > i) {
                      setEditingIdx(editingIdx - 1)
                    }
                    removeSessionGrid(i)
                  }}
                  className="absolute top-1 right-1 p-0.5 rounded text-warm-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-5">
        {/* Left: positions + name + matrix */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Posição do HERO — single select */}
          <div>
            <label className="eyebrow mb-2 block">{t.editor.heroPosition}</label>
            <div className="flex gap-1.5 flex-wrap">
              {activePositions.map(p => {
                const active = selectedPositions.includes(p.label)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePosition(p.label)}
                    className="border transition-colors"
                    style={{
                      minWidth: 42, height: 26, padding: '0 10px',
                      borderRadius: 999,
                      fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, letterSpacing: '0.06em',
                      background: active ? '#c95f3a' : '#1f1d1a',
                      borderColor: active ? '#d97757' : '#4a463e',
                      color: active ? '#fff' : '#8a857a',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Nome */}
          <div className="flex items-center gap-2 max-w-xs">
            <label className="text-xs font-semibold text-warm-400 whitespace-nowrap flex-shrink-0">
              {t.editor.name}
            </label>
            <input
              type="text"
              className="input flex-1 min-w-0"
              placeholder={t.editor.namePlaceholder}
              value={rangeData.name}
              onChange={e => setRangeName(e.target.value)}
            />
          </div>

          {/* Stack Efetivo */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-warm-400 whitespace-nowrap flex-shrink-0">
                {t.editor.stack}
              </label>
              <input
                type="text"
                className="input w-52"
                placeholder={t.editor.stackPlaceholder}
                value={rangeData.stackRange}
                onChange={e => setStackRange(e.target.value)}
              />
              {rangeData.stackRange && (
                <button
                  onClick={() => setStackRange('')}
                  className="text-xs text-warm-500 hover:text-warm-300 transition-colors"
                >
                  {t.editor.clear}
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
                      : 'bg-warm-800 border-warm-600 text-warm-400 hover:text-warm-200 hover:border-warm-500',
                  ].join(' ')}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Pré-requisito */}
          <div className="flex items-center gap-2">
            <Link2 size={13} className="text-warm-500 flex-shrink-0" />
            <label className="text-xs font-semibold text-warm-400 whitespace-nowrap flex-shrink-0">
              {t.editor.prereq}
            </label>
            <button
              type="button"
              onClick={() => setPrereqPickerOpen(true)}
              className={[
                'flex-1 min-w-0 px-2.5 py-1.5 border rounded-lg text-sm text-left transition-colors',
                rangeData.prereqRangeId !== undefined
                  ? 'bg-sky-900/20 border-sky-700/50 text-sky-300 hover:border-sky-500'
                  : 'bg-warm-800 border-warm-600 text-warm-500 hover:border-warm-400',
              ].join(' ')}
            >
              {rangeData.prereqRangeId !== undefined
                ? (ranges.find(x => x.id === rangeData.prereqRangeId)?.name ?? '?')
                : t.editor.noPrereq}
            </button>
          </div>

          {/* Matrix */}
          <div>
            <label className="block text-xs font-semibold text-warm-400 mb-1.5 uppercase tracking-wider">
              {t.editor.handGrid}
            </label>
            <HandMatrix />
          </div>
        </div>

        {/* Right: ações + frequências */}
        <div className="xl:w-80 space-y-3 flex-shrink-0">
          <div className="bg-warm-800/60 rounded-xl p-4 border border-warm-700 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-bold text-xs text-warm-400 uppercase tracking-wider whitespace-nowrap">
                {t.editor.actionsFreq}
              </h2>
              <HandQuickSelect mode="brush" />
            </div>

            <div className="border-t border-warm-700/60" />

            <BrushControls />

            <div className="border-t border-warm-700/60" />

            <ComboCounter grid={rangeData.grid} extraLabel={brush.extraLabel} extraColor={brush.extraColor} />
          </div>

          <button
            onClick={() => { if (confirm(t.editor.clearGridConfirm)) resetGrid() }}
            className="w-full py-2 bg-warm-800 text-red-400 border border-red-900/50 rounded-lg font-semibold text-sm hover:bg-red-900/20 transition-colors"
          >
            {t.editor.clearGrid}
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
                    : 'bg-warm-800 text-warm-600 border-warm-700 cursor-not-allowed',
                ].join(' ')}
              >
                {t.editor.saveChangesTo(editingIdx + 1)}
              </button>
              <button
                onClick={handleCancelSessionEdit}
                className="w-full py-2.5 bg-warm-700 hover:bg-warm-600 text-warm-100 rounded-lg font-bold text-sm transition-colors border border-warm-600"
              >
                {t.editor.cancel}
              </button>
            </>
          ) : (
            <button
              onClick={handlePushToSession}
              className="w-full py-2.5 bg-warm-700 hover:bg-warm-600 text-warm-100 rounded-lg font-bold text-sm transition-colors border border-warm-600"
            >
              {t.editor.saveAndCreate}
            </button>
          )}

          <button
            onClick={handleNext}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold text-sm transition-colors"
          >
            {t.editor.nextScenarios}
          </button>
        </div>
      </div>

      {prereqPickerOpen && (
        <PrereqRangePicker
          ranges={ranges}
          excludeId={rangeData.id}
          filterPositions={selectedPositions}
          currentPrereqId={rangeData.prereqRangeId}
          onSelect={id => setEditorPrereq(id)}
          onClose={() => setPrereqPickerOpen(false)}
        />
      )}
    </div>
  )
}
