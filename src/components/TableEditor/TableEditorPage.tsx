import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { PokerTableEditor } from '../ui/PokerTableEditor'
import { SEAT_ROLE_LABELS } from '../../types'
import type { PositionConfig } from '../../types'
import { countNonFoldHands } from '../../utils/hands'
import { useModalA11y } from '../../utils/useModalA11y'
import { X } from 'lucide-react'

function getStackLabel(data: Record<string, PositionConfig>): string {
  const stacks = Object.values(data).map(p => p.stack)
  const unique = [...new Set(stacks)]
  if (unique.length === 1) return `${unique[0]}bb`
  const freq: Record<number, number> = {}
  stacks.forEach(s => { freq[s] = (freq[s] ?? 0) + 1 })
  const mode = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0])
  const outliers = stacks.filter(s => s !== mode)
  if (outliers.length === 1) return `* ${outliers[0]}bb`
  return `${mode}bb`
}

function getScenarioSummary(
  scenario: Record<string, { role: string; bet: number }>,
  positions: { id: string; label: string }[]
): string {
  const acts: string[] = []
  positions.forEach(p => {
    const d = scenario[p.id]
    if (!d || d.role === 'fold' || d.role === 'post') return
    acts.push(`${p.label} ${d.role.charAt(0).toUpperCase() + d.role.slice(1)} (${d.bet}bb)`)
  })
  return acts.length === 0 ? 'Nenhuma ação agressiva' : acts.join(' → ')
}

export function TableEditorPage() {
  const activePositions       = useStore(s => s.activePositions)
  const currentScenario       = useStore(s => s.currentScenario)
  const currentAnte           = useStore(s => s.currentAnte)
  const tempScenarios         = useStore(s => s.tempScenarios)
  const currentHeroRaiseSize  = useStore(s => s.currentHeroRaiseSize)
  const initTableConfig       = useStore(s => s.initTableConfig)
  const updateHero            = useStore(s => s.updateHero)
  const updateRole            = useStore(s => s.updateRole)
  const updateBet             = useStore(s => s.updateBet)
  const updateStack           = useStore(s => s.updateStack)
  const setHeroRaiseSize      = useStore(s => s.setHeroRaiseSize)
  const setAllStacks          = useStore(s => s.setAllStacks)
  const addScenario           = useStore(s => s.addScenarioToBuffer)
  const updateScenario        = useStore(s => s.updateScenarioInBuffer)
  const removeScenario        = useStore(s => s.removeScenario)
  const loadScenario          = useStore(s => s.loadScenarioFromBuffer)
  const finalizeRange         = useStore(s => s.finalizeRange)
  const setPage               = useStore(s => s.setPage)
  const sessionGrids          = useStore(s => s.sessionGrids)
  const rangeData             = useStore(s => s.rangeData)
  const ranges                = useStore(s => s.ranges)
  const removeSessionGrid     = useStore(s => s.removeSessionGrid)

  const [customStack, setCustomStack]     = useState(0)
  const [editingIdx, setEditingIdx]       = useState<number | null>(null)
  const [nameModalOpen, setNameModalOpen] = useState(false)
  const [primaryName, setPrimaryName]     = useState('')
  const nameDialogRef = useModalA11y<HTMLDivElement>(nameModalOpen, () => setNameModalOpen(false))

  useEffect(() => {
    if (Object.keys(currentScenario).length === 0) initTableConfig()
  }, [])

  const numPlayers = activePositions.length
  let pot = currentAnte * numPlayers
  activePositions.forEach(p => { pot += parseFloat(String(currentScenario[p.id]?.bet ?? 0)) })

  // Grids of the same position (session + current) that will be merged
  const posKey = [...rangeData.positions].sort().join(',')
  const samePosSessions = sessionGrids.filter(sg => [...sg.positions].sort().join(',') === posKey)
  const willBeCombined  = samePosSessions.length > 0

  // Non-empty entries shown in the name modal, with their sessionGrids index (-1 = current editor)
  const modalEntries = [
    ...sessionGrids
      .map((sg, i) => ({ ...sg, sessionIdx: i }))
      .filter(e => [...e.positions].sort().join(',') === posKey && countNonFoldHands(e.grid) > 0),
    ...(countNonFoldHands(rangeData.grid) > 0
      ? [{ name: rangeData.name, stackRange: rangeData.stackRange, grid: rangeData.grid, positions: rangeData.positions, sessionIdx: -1 }]
      : []),
  ]

  function handleAddScenario() {
    const summary = getScenarioSummary(currentScenario, activePositions)
    addScenario(pot.toFixed(1), summary)
    setEditingIdx(null)
  }

  function handleSaveEdit() {
    if (editingIdx === null) return
    const summary = getScenarioSummary(currentScenario, activePositions)
    updateScenario(editingIdx, pot.toFixed(1), summary)
    setEditingIdx(null)
  }

  function handleFinalize() {
    if (tempScenarios.length === 0) {
      if (!confirm('Nenhum cenário salvo. Salvar o cenário atual?')) return
      const summary = getScenarioSummary(currentScenario, activePositions)
      addScenario(pot.toFixed(1), summary)
    }
    if (willBeCombined) {
      const originalName = rangeData.id !== null
        ? (ranges.find(r => r.id === rangeData.id)?.name ?? '')
        : ''
      setPrimaryName(originalName || samePosSessions[0]?.name || rangeData.name)
      setNameModalOpen(true)
    } else {
      finalizeRange()
    }
  }

  function handleConfirmName() {
    if (!primaryName.trim()) { alert('Digite um nome para o range.'); return }
    setNameModalOpen(false)
    finalizeRange(primaryName.trim())
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display uppercase text-warm-100 text-[28px] leading-none tracking-wide">Configurar Cenários</h1>
        <p className="text-xs text-warm-400 mt-0.5">
          Configure as ações de cada posição na mesa. Você pode salvar múltiplos cenários por range.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: config panel */}
        <div className="lg:w-80 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-warm-300">Ação na Mesa</h2>
            <button
              onClick={initTableConfig}
              className="text-xs px-2 py-1 border border-warm-600 bg-warm-800 rounded text-warm-400 hover:bg-warm-700"
            >
              ↺ Resetar
            </button>
          </div>

          {/* Global stack setter */}
          <div className="flex items-center gap-1.5 py-2 border-b border-warm-700 flex-wrap">
            <span className="text-xs text-warm-400 flex-shrink-0">Todos os stacks:</span>
            {[100, 250].map(v => (
              <button
                key={v}
                onClick={() => setAllStacks(v)}
                className="px-2 py-1 text-xs border border-warm-600 bg-warm-800 rounded hover:bg-warm-700 text-warm-300 flex-shrink-0"
              >
                {v}bb
              </button>
            ))}
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                type="number" min={1}
                aria-label="Stack para todos os jogadores"
                className="flex-1 min-w-0 p-1 border border-warm-600 rounded text-xs bg-warm-900 text-warm-200 text-center"
                placeholder="Preencher"
                value={customStack || ''}
                onChange={e => setCustomStack(Number(e.target.value))}
              />
              <button
                onClick={() => { if (customStack > 0) setAllStacks(customStack) }}
                className="px-2 py-1 text-xs border border-warm-600 bg-warm-700 rounded hover:bg-warm-600 text-warm-200 flex-shrink-0"
                title="Aplicar"
              >
                ✓
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid items-center gap-1 px-2" style={{ gridTemplateColumns: '20px 44px 1fr 56px 56px' }}>
            <span className="text-[10px] text-amber-400 font-bold text-center" title="Clique para definir como HERO">H</span>
            <span className="text-[10px] text-warm-500 text-center">Pos</span>
            <span className="text-[10px] text-warm-500">Ação</span>
            <span className="text-[10px] text-warm-500 text-center">Stack</span>
            <span className="text-[10px] text-warm-500 text-center">Aposta</span>
          </div>

          {/* Position rows */}
          {activePositions.map(pos => {
            const data = currentScenario[pos.id]
            if (!data) return null
            return (
              <div
                key={pos.id}
                className={[
                  'flex flex-col p-2 bg-warm-800 border rounded-lg gap-1.5',
                  data.isHero ? 'border-amber-600/60' : 'border-warm-700',
                ].join(' ')}
              >
                <div className="grid items-center gap-1" style={{ gridTemplateColumns: '20px 44px 1fr 56px 56px' }}>
                  <input
                    type="radio" name="hero-select"
                    aria-label={`Definir ${pos.label} como HERO`}
                    className="w-4 h-4 cursor-pointer accent-amber-500"
                    onChange={() => updateHero(pos.id)}
                    checked={data.isHero}
                  />
                  <div className={[
                    'font-extrabold text-xs text-center leading-tight',
                    data.isHero ? 'text-amber-400' : 'text-warm-300',
                  ].join(' ')}>
                    {pos.label}
                    {data.isHero && <div className="text-[8px] text-amber-500 font-bold">HERO</div>}
                  </div>
                  <select
                    aria-label={`Ação de ${pos.label}`}
                    className="w-full p-1 rounded border border-warm-600 text-xs bg-warm-900 text-warm-200 cursor-pointer"
                    value={data.role}
                    onChange={e => updateRole(pos.id, e.target.value)}
                  >
                    {(Object.keys(SEAT_ROLE_LABELS) as Array<keyof typeof SEAT_ROLE_LABELS>).map(r => (
                      <option key={r} value={r}>{SEAT_ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    aria-label={`Stack de ${pos.label}`}
                    className="p-1 text-center border border-warm-600 rounded text-xs bg-warm-900 text-warm-200"
                    value={data.stack}
                    onChange={e => updateStack(pos.id, Number(e.target.value))}
                    title="Stack (bb)"
                  />
                  <input
                    type="number" step={0.1}
                    aria-label={`Aposta de ${pos.label}`}
                    className="p-1 text-center border border-warm-600 rounded text-xs bg-warm-900 text-warm-200"
                    value={data.bet}
                    onChange={e => updateBet(pos.id, parseFloat(e.target.value) || 0)}
                    placeholder="bb"
                  />
                </div>

                {/* Hero raise size input */}
                {data.isHero && (
                  <div className="flex items-center gap-2 pl-6 pt-1 border-t border-amber-800/30">
                    <label className="text-xs text-amber-400 flex-shrink-0">Raise futuro:</label>
                    <input
                      type="number" min={0} step={0.5}
                      aria-label="Tamanho do raise futuro"
                      className="w-20 p-1 border border-amber-600/50 rounded text-xs bg-warm-900 text-amber-200 text-center"
                      placeholder="bb"
                      value={currentHeroRaiseSize || ''}
                      onChange={e => setHeroRaiseSize(parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-xs text-warm-500">bb</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Summary */}
          <div className="text-xs text-warm-500 pt-1 border-t border-warm-700">
            {getScenarioSummary(currentScenario, activePositions)}
          </div>
        </div>

        {/* Right: table visual + scenario buffer */}
        <div className="flex-1 space-y-4">
          {/* Table */}
          <div className="flex justify-center">
            <div className="w-full" style={{ maxWidth: 575 }}>
              <div
                className="rounded-2xl border border-warm-800 px-10 pt-8 pb-16"
                style={{ background: '#1b1a17', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)' }}
              >
                <PokerTableEditor />
              </div>
            </div>
          </div>

          {/* Add / Save buttons */}
          {editingIdx !== null ? (
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors"
              >
                Salvar alterações no #{editingIdx + 1}
              </button>
              <button
                onClick={() => setEditingIdx(null)}
                className="px-4 py-3 bg-warm-700 hover:bg-warm-600 text-white rounded-lg font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddScenario}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors"
            >
              + Adicionar Cenário à Lista
            </button>
          )}

          {/* Saved scenarios */}
          {tempScenarios.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-warm-400 uppercase tracking-wider">
                Cenários Salvos ({tempScenarios.length})
              </h3>
              {tempScenarios.map((scen, idx) => (
                <div
                  key={scen.id}
                  onClick={() => { loadScenario(idx); setEditingIdx(idx) }}
                  className={[
                    'border p-2.5 rounded-lg text-sm flex justify-between items-center cursor-pointer transition-colors',
                    editingIdx === idx
                      ? 'bg-emerald-900/20 border-emerald-600/60'
                      : 'bg-warm-800 border-warm-700 hover:border-warm-500',
                  ].join(' ')}
                >
                  <span className="text-warm-200">
                    <span className="font-bold text-warm-400">#{idx + 1}</span>{' '}
                    {scen.summary}{' '}
                    <span className="text-warm-500">(Pote: {scen.pot}bb)</span>
                    {!!scen.heroRaiseSize && <span className="text-amber-500"> · Raise: {scen.heroRaiseSize}bb</span>}
                    <span className="text-blue-400"> · {getStackLabel(scen.data)}</span>
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); removeScenario(idx); if (editingIdx === idx) setEditingIdx(null) }}
                    className="text-red-400 hover:text-red-300 font-bold px-2 ml-2 flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-warm-700">
            <button
              onClick={handleFinalize}
              className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold transition-colors"
            >
              ✅ Finalizar e Salvar Range
            </button>
            <button
              onClick={() => setPage('editor')}
              className="w-28 py-3 bg-warm-700 hover:bg-warm-600 text-white rounded-lg font-bold transition-colors"
            >
              ← Voltar
            </button>
          </div>
        </div>
      </div>

      {/* Name modal for combined ranges */}
      {nameModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setNameModalOpen(false)}
        >
          <div
            ref={nameDialogRef}
            className="bg-warm-900 border border-warm-700 rounded-2xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="range-name-modal-title"
          >
            <h3 id="range-name-modal-title" className="font-bold text-white text-lg mb-1">Nome do Range</h3>
            <p className="text-xs text-warm-400 mb-4">
              {modalEntries.length} variações de stack serão salvas em um único range. Escolha o nome principal.
            </p>

            {/* Preview das variações */}
            <div className="flex flex-wrap gap-2 mb-4">
              {modalEntries.map((entry, i) => (
                <div key={i} className="relative flex items-center gap-1.5 bg-warm-800 border border-warm-700 rounded-lg px-2.5 py-1.5 pr-7">
                  <span className="text-xs text-warm-300">{entry.name}</span>
                  {entry.stackRange && (
                    <span className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-500/10 border border-brand-500/40 text-brand-400 leading-tight">
                      {entry.stackRange}
                    </span>
                  )}
                  <span className="text-xs text-warm-500">{countNonFoldHands(entry.grid)} mãos</span>
                  {entry.sessionIdx >= 0 && (
                    <button
                      onClick={() => removeSessionGrid(entry.sessionIdx)}
                      className="absolute top-1 right-1 p-0.5 rounded text-warm-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <input
              type="text"
              autoFocus
              aria-label="Nome do range"
              className="w-full px-3 py-2.5 border border-warm-600 rounded-lg text-sm bg-warm-800 text-white placeholder-warm-500 focus:border-brand-500 focus:outline-none mb-4"
              placeholder="Ex: Defesa BB vs UTG"
              value={primaryName}
              onChange={e => setPrimaryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmName() }}
            />

            <div className="flex gap-3">
              <button
                onClick={handleConfirmName}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={() => setNameModalOpen(false)}
                className="px-4 py-2.5 bg-warm-700 hover:bg-warm-600 text-white rounded-lg font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
