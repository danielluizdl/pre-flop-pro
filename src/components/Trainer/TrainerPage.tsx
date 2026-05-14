import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { HandMatrix } from '../RangeBuilder/HandMatrix'
import { PokerTableEditor } from '../ui/PokerTableEditor'
import { HandQuickSelect } from '../ui/HandQuickSelect'
import { RangePreviewModal } from '../ui/RangePreviewModal'
import { Eye } from 'lucide-react'
import { RANKS, SUIT_ICONS } from '../../types'
import { ALL_HANDS } from '../../utils/hands'
import type { HandHistoryEntry, Range, TrainingSession } from '../../types'



/* ── Mini card for history ─────────────────────────────────────────────────── */
function MiniCard({ rank, suit }: { rank: string; suit: string }) {
  const colorClass: Record<string, string> = {
    h: 'text-red-400', d: 'text-blue-400', s: 'text-warm-300', c: 'text-emerald-400',
  }
  return (
    <span className={`font-bold ${colorClass[suit] ?? 'text-warm-300'}`}>
      {rank}{SUIT_ICONS[suit]}
    </span>
  )
}

/* ── Hand history item ──────────────────────────────────────────────────────── */
function HandHistoryItem({ entry, onClick }: { entry: HandHistoryEntry; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-2 rounded-lg border text-xs transition-all ${entry.correct ? 'border-emerald-700/40 bg-emerald-900/10' : 'border-red-700/40 bg-red-900/10'} ${onClick ? 'cursor-pointer hover:brightness-125' : ''}`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.correct ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <MiniCard rank={entry.hand[0]} suit={entry.suits[0]} />
        <MiniCard rank={entry.hand[1]} suit={entry.suits[1]} />
        <span className="ml-auto text-warm-500 tabular-nums">{entry.rng}</span>
      </div>
      <div className="pl-3.5">
        {entry.correct ? (
          <span className="text-emerald-400 font-semibold">{entry.actionTaken}</span>
        ) : (
          <>
            <span className="text-red-400">{entry.actionTaken}</span>
            <span className="text-warm-500"> → </span>
            <span className="text-emerald-400">{entry.correctAction}</span>
          </>
        )}
        {!!entry.raiseSize && <span className="text-warm-500"> ({entry.raiseSize})</span>}
      </div>
    </div>
  )
}

/* ── Hand history sidebar ────────────────────────────────────────────────────── */
function HandHistorySidebar({ onOpenModal, onReplayEntry }: { onOpenModal: () => void; onReplayEntry?: (entry: HandHistoryEntry) => void }) {
  const history = useStore(s => s.handHistory)
  const reversed = [...history].reverse()
  return (
    <div className="flex-1 min-h-0 bg-warm-800 rounded-xl border border-warm-700 p-3 flex flex-col">
      <button
        onClick={onOpenModal}
        className="text-xs font-bold text-warm-400 mb-2 flex-shrink-0 text-left hover:text-white transition-colors"
      >
        HISTÓRICO <span className="text-warm-500">({history.length})</span>
      </button>
      <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
        {reversed.length === 0 ? (
          <p className="text-xs text-warm-600 text-center mt-4">Sem mãos ainda</p>
        ) : (
          reversed.map(entry => (
            <HandHistoryItem key={entry.id} entry={entry} onClick={onReplayEntry ? () => onReplayEntry(entry) : undefined} />
          ))
        )}
      </div>
    </div>
  )
}

/* ── Session detail (used inside HistoryModal) ────────────────────────────── */
function SessionDetail({ session, ranges }: {
  session: TrainingSession
  ranges: Range[]
}) {
  const [openRangeId, setOpenRangeId] = useState<number | null>(null)
  const [viewMode, setViewMode]       = useState<'actions' | 'heatmap'>('heatmap')
  const [selectedStack, setSelectedStack] = useState('')

  useEffect(() => { setViewMode('heatmap') }, [openRangeId])
  useEffect(() => {
    if (openRangeId !== null) {
      const r = ranges.find(x => x.id === openRangeId)
      setSelectedStack(r?.stackGrids && r.stackGrids.length > 1 ? r.stackGrids[0].stackRange : '')
    } else {
      setSelectedStack('')
    }
  }, [openRangeId])

  const sessionRanges = session.rangeNames
    .map(name => ranges.find(r => r.name === name))
    .filter((r): r is Range => r !== undefined)

  const acc = session.hands > 0 ? Math.round(session.correct / session.hands * 100) : null
  const sessionPerf = session.handPerf ?? null

  return (
    <div className="border-t border-warm-700 bg-warm-900/40 p-4 space-y-4">
      <div className="bg-warm-800 border border-warm-700 rounded-xl p-4">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-2xl font-extrabold text-white">{session.hands}</div>
            <div className="text-xs text-warm-400">Mãos</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-emerald-400">{session.correct}</div>
            <div className="text-xs text-warm-400">Acertos</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-red-400">{session.errors}</div>
            <div className="text-xs text-warm-400">Erros</div>
          </div>
          <div>
            <div className={`text-2xl font-extrabold ${acc !== null ? (acc >= 80 ? 'text-emerald-400' : acc >= 50 ? 'text-yellow-400' : 'text-red-400') : 'text-warm-600'}`}>
              {acc !== null ? `${acc}%` : '—'}
            </div>
            <div className="text-xs text-warm-400">Precisão</div>
          </div>
        </div>
      </div>

      {sessionRanges.length === 0 ? (
        <p className="text-warm-500 text-sm text-center py-2">Ranges desta sessão não encontrados.</p>
      ) : (
        <div className="space-y-2">
          {sessionRanges.map(r => {
            const mergedPerf = sessionPerf?.[r.name] ?? {}
            const vals     = Object.values(mergedPerf)
            const total    = vals.reduce((s, v) => s + v.t, 0)
            const correct  = vals.reduce((s, v) => s + v.c, 0)
            const accuracy = total > 0 ? Math.round(correct / total * 100) : null
            const isOpenR  = openRangeId === r.id
            const stackRanges = r.stackGrids && r.stackGrids.length > 1 ? r.stackGrids.map(sg => sg.stackRange).filter(Boolean) : []
            const activeStack = isOpenR && stackRanges.length > 0 ? selectedStack : ''
            const perfKey  = activeStack ? `${r.name}|||${activeStack}` : r.name
            const perf     = sessionPerf?.[perfKey] ?? {}
            const gridIdx  = activeStack ? r.stackGrids!.findIndex(sg => sg.stackRange === activeStack) : 0
            const grid     = r.stackGrids && gridIdx >= 0 ? r.stackGrids[gridIdx].grid : (r.stackGrids?.[0]?.grid ?? r.grid)

            return (
              <div key={r.id} className="border border-warm-700/60 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenRangeId(isOpenR ? null : r.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-warm-800/60 hover:bg-warm-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-sm">{r.name}</span>
                    {r.positions.length > 0 && (
                      <span className="text-warm-400 text-xs">{r.positions.join(', ')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {accuracy !== null ? (
                      <span className={`text-sm font-bold ${accuracy >= 80 ? 'text-emerald-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {accuracy}%
                      </span>
                    ) : (
                      <span className="text-warm-600 text-xs">sem dados</span>
                    )}
                    <span className={`text-warm-400 text-lg transition-transform duration-200 inline-block ${isOpenR ? 'rotate-180' : ''}`}>›</span>
                  </div>
                </button>

                {isOpenR && (
                  <div className="border-t border-warm-700/60 bg-warm-900/40 p-4">
                    {sessionPerf === null ? (
                      <p className="text-warm-500 text-xs text-center py-4">Dados por mão não disponíveis para sessões anteriores.</p>
                    ) : (
                      <>
                        {stackRanges.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mb-3">
                            {stackRanges.map(sr => (
                              <button
                                key={sr}
                                onClick={() => setSelectedStack(sr)}
                                className={['px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors',
                                  selectedStack === sr ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:bg-warm-700',
                                ].join(' ')}
                              >
                                {sr}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-end gap-1.5 mb-3">
                          {(['heatmap', 'actions'] as const).map(mode => (
                            <button
                              key={mode}
                              onClick={() => setViewMode(mode)}
                              className={`px-2 py-0.5 text-xs border rounded-lg transition-colors ${viewMode === mode ? 'border-brand-500 bg-brand-900/30 text-brand-300' : 'border-warm-600 bg-warm-900/80 text-warm-300 hover:bg-warm-700'}`}
                            >
                              {mode === 'heatmap' ? 'Erro / Acerto' : 'Ver Range'}
                            </button>
                          ))}
                        </div>
                        <HandMatrix
                          readOnly
                          grid={grid}
                          heatmap={Object.keys(perf).length > 0 ? perf : undefined}
                          customActionColor={r.customAction?.color}
                          forceViewMode={viewMode}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── History modal ───────────────────────────────────────────────────────────── */
function HistoryModal({ onClose }: { onClose: () => void }) {
  const trainingHistory = useStore(s => s.trainingHistory)
  const ranges          = useStore(s => s.ranges)

  const [openId, setOpenId] = useState<number | null>(null)

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const sessions = [...trainingHistory].reverse()

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-1">Histórico de Treino</h2>
          <p className="text-warm-400 text-sm">Clique em uma sessão para ver o desempenho por mão.</p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-warm-600 bg-warm-800 text-warm-300 rounded-lg text-sm font-semibold hover:bg-warm-700 transition-colors"
        >
          Voltar
        </button>
      </div>

      {sessions.length === 0 && (
        <p className="text-warm-600 text-sm text-center py-16">Nenhuma sessão registrada ainda.</p>
      )}

      <div className="space-y-2">
        {sessions.map((session: TrainingSession) => {
          const acc    = session.hands > 0 ? Math.round(session.correct / session.hands * 100) : 0
          const isOpen = openId === session.id

          return (
            <div key={session.id} className="border border-warm-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : session.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-warm-800 hover:bg-warm-750 transition-colors text-left"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm">{formatDate(session.timestamp)}</div>
                  <div className="text-warm-400 text-xs truncate">{session.rangeNames.join(', ')}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <div className="text-right">
                    <div className={`text-sm font-bold ${acc >= 80 ? 'text-emerald-400' : acc >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {acc}%
                    </div>
                    <div className="text-xs text-warm-500">{session.hands} mãos</div>
                  </div>
                  <span className={`text-warm-400 text-lg transition-transform duration-200 inline-block ${isOpen ? 'rotate-180' : ''}`}>›</span>
                </div>
              </button>

              {isOpen && (
                <SessionDetail
                  session={session}
                  ranges={ranges}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Hand filter grid ─────────────────────────────────────────────────────────── */
function HandFilterGrid() {
  const excluded = useStore(s => s.drillExcludedHands)
  const setExcluded = useStore(s => s.setDrillExcluded)
  const useRng = useStore(s => s.useRngForFrequency)
  const setUseRng = useStore(s => s.setUseRng)
  const isDrawing = useRef(false)
  const drawAction = useRef<'exclude' | 'include'>('exclude')

  return (
    <div className="max-w-xl mx-auto border border-warm-700 p-3 rounded-xl bg-warm-800/60 mb-6">
      {/* Controles em uma linha compacta */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {/* Seleção rápida */}
        <HandQuickSelect
          mode="filter"
          excludedHands={excluded}
          onSetExcluded={setExcluded}
        />

        <div className="h-4 border-l border-warm-600 mx-0.5" />

        {/* Tudo / Nada */}
        <button
          onClick={() => setExcluded([])}
          className="px-2.5 py-1 text-xs border border-warm-600 bg-warm-800 rounded-md hover:bg-warm-700 text-warm-300 transition-colors"
        >
          Tudo ✓
        </button>
        <button
          onClick={() => setExcluded([...ALL_HANDS])}
          className="px-2.5 py-1 text-xs border border-warm-600 bg-warm-800 rounded-md hover:bg-warm-700 text-warm-300 transition-colors"
        >
          Nada ✗
        </button>

        <div className="h-4 border-l border-warm-600 mx-0.5" />

        {/* RNG */}
        <span className="text-xs text-warm-500">RNG:</span>
        <button
          onClick={() => setUseRng(true)}
          className={['px-2.5 py-1 text-xs rounded-md border font-semibold transition-colors',
            useRng ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:bg-warm-700',
          ].join(' ')}
        >
          Sim
        </button>
        <button
          onClick={() => setUseRng(false)}
          className={['px-2.5 py-1 text-xs rounded-md border font-semibold transition-colors',
            !useRng ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:bg-warm-700',
          ].join(' ')}
        >
          Não
        </button>
      </div>

      <div
        className="grid gap-0.5 select-none"
        style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}
        onMouseDown={() => { isDrawing.current = true }}
        onMouseUp={() => { isDrawing.current = false }}
        onMouseLeave={() => { isDrawing.current = false }}
      >
        {RANKS.flatMap((r1, i) =>
          RANKS.map((r2, j) => {
            const hand = i === j ? r1 + r2 : i < j ? r1 + r2 + 's' : r2 + r1 + 'o'
            const isPair = i === j
            const isSuited = i < j
            const isExcluded = excluded.includes(hand)
            const baseBg = isPair ? '#86efac' : isSuited ? '#fde047' : '#93c5fd'

            function toggle() {
              const next = excluded.includes(hand)
                ? excluded.filter(h => h !== hand)
                : [...excluded, hand]
              setExcluded(next)
            }

            return (
              <div
                key={hand}
                className="aspect-square flex items-center justify-center text-[0.55rem] font-bold text-warm-800 rounded-sm cursor-pointer border border-warm-600"
                style={{ background: isExcluded ? '#2f2c25' : baseBg, opacity: isExcluded ? 0.3 : 1 }}
                onMouseDown={e => {
                  e.preventDefault()
                  drawAction.current = isExcluded ? 'include' : 'exclude'
                  toggle()
                }}
                onMouseOver={() => { if (isDrawing.current) toggle() }}
              >
                {hand}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}


const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'UTG']

/* ── Range select screen ────────────────────────────────────────────────────── */
function DrillRangeSelect() {
  const ranges             = useStore(s => s.ranges)
  const selectedIds        = useStore(s => s.selectedDrillRangeIds)
  const toggleDrillRange   = useStore(s => s.toggleDrillRange)
  const startDrillSession  = useStore(s => s.startDrillSession)
  const nextDrillHand      = useStore(s => s.nextDrillHand)
  const setPage            = useStore(s => s.setPage)

  const [step, setStep]             = useState<'select' | 'filter'>('select')
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [previewId, setPreviewId]   = useState<number | null>(null)

  function toggleGroup(pos: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(pos) ? next.delete(pos) : next.add(pos)
      return next
    })
  }

  function handleStartDrill() {
    startDrillSession()
    const ok = nextDrillHand()
    if (!ok) alert('Nenhuma mão selecionada!')
  }

  if (step === 'select') {
    // Group ranges by each position label they belong to
    const grouped: Record<string, typeof ranges> = {}
    for (const r of ranges) {
      for (const pos of r.positions) {
        if (!grouped[pos]) grouped[pos] = []
        grouped[pos].push(r)
      }
    }

    // Order groups
    const orderedKeys = [
      ...POSITION_ORDER.filter(p => grouped[p]),
      ...Object.keys(grouped).filter(p => !POSITION_ORDER.includes(p)).sort(),
    ]

    return (
      <>
      <div className="space-y-4 max-w-2xl mx-auto">
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-1">Drill</h2>
          <p className="text-warm-400 text-sm">Selecione os ranges para o treino. Clique em uma posição para expandir.</p>
        </div>

        {ranges.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-warm-400 mb-4">Nenhum range criado.</p>
            <button
              onClick={() => setPage('ranges')}
              className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"
            >
              Ir para Meus Ranges
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {orderedKeys.map(pos => {
                const group = grouped[pos]
                const isOpen = openGroups.has(pos)
                const selectedInGroup = group.filter(r => selectedIds.includes(r.id)).length

                const allGroupSelected = group.length > 0 && group.every(r => selectedIds.includes(r.id))

                function toggleAllInGroup(e: React.MouseEvent) {
                  e.stopPropagation()
                  if (allGroupSelected) {
                    useStore.setState({ selectedDrillRangeIds: selectedIds.filter(id => !group.some(r => r.id === id)) })
                  } else {
                    const toAdd = group.filter(r => !selectedIds.includes(r.id)).map(r => r.id)
                    useStore.setState({ selectedDrillRangeIds: [...selectedIds, ...toAdd] })
                  }
                }

                return (
                  <div key={pos} className="border border-warm-700 rounded-xl overflow-hidden">
                    {/* Header */}
                    <button
                      onClick={() => toggleGroup(pos)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-warm-800 hover:bg-warm-750 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-white text-sm w-10 text-left">{pos}</span>
                        <span className="text-warm-400 text-xs">{group.length} range{group.length !== 1 ? 's' : ''}</span>
                        {selectedInGroup > 0 && (
                          <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {selectedInGroup} selecionado{selectedInGroup !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <span className={`text-warm-400 text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        ›
                      </span>
                    </button>

                    {/* Ranges list */}
                    {isOpen && (
                      <div className="border-t border-warm-700 bg-warm-900/40 p-3 space-y-2">
                        <button
                          onClick={toggleAllInGroup}
                          className={[
                            'w-full py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                            allGroupSelected
                              ? 'bg-brand-900/30 border-brand-600/50 text-brand-400 hover:bg-brand-900/50'
                              : 'bg-warm-800 border-warm-600 text-warm-400 hover:bg-warm-700 hover:text-warm-200',
                          ].join(' ')}
                        >
                          {allGroupSelected ? 'Desfazer seleção' : 'Selecionar todos'}
                        </button>
                      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                        {group.map(r => {
                          const selected = selectedIds.includes(r.id)
                          return (
                            <div
                              key={r.id}
                              onClick={() => toggleDrillRange(r.id)}
                              className={[
                                'border rounded-lg p-3 cursor-pointer transition-all relative',
                                selected
                                  ? 'border-brand-500 bg-brand-900/20'
                                  : 'border-warm-700 bg-warm-800/60 hover:border-warm-500',
                              ].join(' ')}
                            >
                              {selected && (
                                <div className="absolute -top-1.5 -right-1.5 bg-brand-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow">
                                  ✔
                                </div>
                              )}
                              <div className="flex items-start justify-between gap-1">
                                <div className="flex items-start gap-1.5 flex-wrap flex-1 min-w-0">
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
                                <button
                                  onClick={e => { e.stopPropagation(); setPreviewId(r.id) }}
                                  className="flex-shrink-0 text-warm-500 hover:text-blue-400 transition-colors"
                                  title="Visualizar range"
                                >
                                  <Eye size={13} />
                                </button>
                              </div>
                              <div className="text-xs text-warm-500 mt-1">{r.tableSize}-max · {r.scenarios.length} cenário{r.scenarios.length !== 1 ? 's' : ''}</div>
                            </div>
                          )
                        })}
                      </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-warm-400">
                {selectedIds.length > 0 ? `${selectedIds.length} range${selectedIds.length !== 1 ? 's' : ''} selecionado${selectedIds.length !== 1 ? 's' : ''}` : 'Nenhum selecionado'}
              </span>
              <button
                onClick={() => {
                  if (selectedIds.length === 0) { alert('Selecione pelo menos um range.'); return }
                  setStep('filter')
                }}
                className="px-8 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold transition-colors"
              >
                CONTINUAR →
              </button>
            </div>
          </>
        )}
      </div>
      {previewId !== null && (() => {
        const r = ranges.find(x => x.id === previewId)
        return r ? <RangePreviewModal range={r} onClose={() => setPreviewId(null)} /> : null
      })()}
      </>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-white mb-1">Filtro de Mãos</h2>
        <p className="text-warm-400 text-sm">Arraste para selecionar/remover várias mãos.</p>
      </div>
      <HandFilterGrid />
      <div className="flex gap-3 justify-center">
        <button
          onClick={handleStartDrill}
          className="px-8 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold transition-colors"
        >
          INICIAR TREINO
        </button>
        <button
          onClick={() => setStep('select')}
          className="px-4 py-2 border border-warm-600 bg-warm-800 text-warm-300 rounded-lg text-sm font-semibold hover:bg-warm-700"
        >
          Voltar
        </button>
      </div>
    </div>
  )
}

type PrevSnapshot = {
  hand: string
  suits: [string, string]
  rng: number
  feedback: string
  feedbackOk: boolean
  freqLabel: string
}

/* ── Drill summary ───────────────────────────────────────────────────────────── */
function DrillSummary({ onClose, onBack }: { onClose: () => void; onBack?: () => void }) {
  const ranges          = useStore(s => s.ranges)
  const selectedIds     = useStore(s => s.selectedDrillRangeIds)
  const handPerformance = useStore(s => s.handPerformance)
  const sessionStats    = useStore(s => s.sessionStats)
  const handHistory     = useStore(s => s.handHistory)
  const [openId, setOpenId]         = useState<number | null>(null)
  const [viewMode, setViewMode]     = useState<'actions' | 'heatmap'>('heatmap')
  const [selectedStack, setSelectedStack] = useState('')

  useEffect(() => { setViewMode('heatmap') }, [openId])
  useEffect(() => {
    if (openId !== null) {
      const r = ranges.find(x => x.id === openId)
      setSelectedStack(r?.stackGrids && r.stackGrids.length > 1 ? r.stackGrids[0].stackRange : '')
    } else {
      setSelectedStack('')
    }
  }, [openId])

  const trainedRanges = ranges.filter(r => selectedIds.includes(r.id))

  const sessionByRange = handHistory.reduce((acc, e) => {
    if (!acc[e.rangeName]) acc[e.rangeName] = { total: 0, correct: 0 }
    acc[e.rangeName].total++
    if (e.correct) acc[e.rangeName].correct++
    return acc
  }, {} as Record<string, { total: number; correct: number }>)

  const sessionAccuracy = sessionStats.hands > 0
    ? Math.round(sessionStats.correct / sessionStats.hands * 100)
    : null

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-1">Resumo do Treino</h2>
          <p className="text-warm-400 text-sm">Clique em um range para ver o desempenho por mão.</p>
        </div>
        <div className="flex gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 border border-brand-700/50 bg-brand-900/20 text-brand-400 rounded-lg text-sm font-semibold hover:bg-brand-900/40 transition-colors"
            >
              ← Voltar ao treino
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-warm-600 bg-warm-800 text-warm-300 rounded-lg text-sm font-semibold hover:bg-warm-700 transition-colors"
          >
            Encerrar
          </button>
        </div>
      </div>

      <div className="bg-warm-800 border border-warm-700 rounded-xl p-4">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-2xl font-extrabold text-white">{sessionStats.hands}</div>
            <div className="text-xs text-warm-400">Mãos</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-emerald-400">{sessionStats.correct}</div>
            <div className="text-xs text-warm-400">Acertos</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-red-400">{sessionStats.errors}</div>
            <div className="text-xs text-warm-400">Erros</div>
          </div>
          <div>
            <div className={`text-2xl font-extrabold ${sessionAccuracy !== null ? (sessionAccuracy >= 80 ? 'text-emerald-400' : sessionAccuracy >= 50 ? 'text-yellow-400' : 'text-red-400') : 'text-warm-600'}`}>
              {sessionAccuracy !== null ? `${sessionAccuracy}%` : '—'}
            </div>
            <div className="text-xs text-warm-400">Precisão</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {trainedRanges.map(r => {
          const sess     = sessionByRange[r.name] ?? { total: 0, correct: 0 }
          const accuracy = sess.total > 0 ? Math.round(sess.correct / sess.total * 100) : null
          const isOpen   = openId === r.id
          const stackRanges = r.stackGrids && r.stackGrids.length > 1 ? r.stackGrids.map(sg => sg.stackRange).filter(Boolean) : []
          const activeStack = isOpen && stackRanges.length > 0 ? selectedStack : ''
          const gridIdx  = activeStack ? r.stackGrids!.findIndex(sg => sg.stackRange === activeStack) : 0
          const grid     = r.stackGrids && gridIdx >= 0 ? r.stackGrids[gridIdx].grid : (r.stackGrids?.[0]?.grid ?? r.grid)
          const heatmapKey = activeStack ? `${r.id}|||${activeStack}` : String(r.id)
          const heatmap  = handPerformance[heatmapKey]

          return (
            <div key={r.id} className="border border-warm-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : r.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-warm-800 hover:bg-warm-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-sm">{r.name}</span>
                  {r.positions.length > 0 && (
                    <span className="text-warm-400 text-xs">{r.positions.join(', ')}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {accuracy !== null ? (
                    <span className={`text-sm font-bold ${accuracy >= 80 ? 'text-emerald-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {accuracy}% · {sess.total} mão{sess.total !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-warm-600 text-xs">sem dados</span>
                  )}
                  <span className={`text-warm-400 text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>›</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-warm-700 bg-warm-900/40 p-4">
                  {sess.total === 0 ? (
                    <p className="text-warm-500 text-sm text-center py-4">Nenhuma mão treinada neste range nesta sessão.</p>
                  ) : (
                    <>
                      {stackRanges.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          {stackRanges.map(sr => (
                            <button
                              key={sr}
                              onClick={() => setSelectedStack(sr)}
                              className={['px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors',
                                selectedStack === sr ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:bg-warm-700',
                              ].join(' ')}
                            >
                              {sr}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-end gap-1.5 mb-3">
                        <button
                          onClick={() => setViewMode('heatmap')}
                          className={`px-2 py-0.5 text-xs border rounded-lg transition-colors ${viewMode === 'heatmap' ? 'border-brand-500 bg-brand-900/30 text-brand-300' : 'border-warm-600 bg-warm-900/80 text-warm-300 hover:bg-warm-700'}`}
                        >
                          Erro / Acerto
                        </button>
                        <button
                          onClick={() => setViewMode('actions')}
                          className={`px-2 py-0.5 text-xs border rounded-lg transition-colors ${viewMode === 'actions' ? 'border-brand-500 bg-brand-900/30 text-brand-300' : 'border-warm-600 bg-warm-900/80 text-warm-300 hover:bg-warm-700'}`}
                        >
                          Ver Range
                        </button>
                      </div>
                      <HandMatrix
                        readOnly
                        grid={grid}
                        heatmap={heatmap}
                        customActionColor={r.customAction?.color}
                        forceViewMode={viewMode}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Active drill ──────────────────────────────────────────────────────────── */
function DrillActive({ onShowSummary, onShowHistory }: { onShowSummary: () => void; onShowHistory: () => void }) {
  const activeDrillRange       = useStore(s => s.activeDrillRange)
  const activeDrillStackRange  = useStore(s => s.activeDrillStackRange)
  const activeDrillStackGridIdx = useStore(s => s.activeDrillStackGridIdx)
  const handPerformance        = useStore(s => s.handPerformance)
  const activeHand             = useStore(s => s.activeHand)
  const currentHandSuits       = useStore(s => s.currentHandSuits)
  const currentRng             = useStore(s => s.currentRng)
  const currentHeroRaiseSize   = useStore(s => s.currentHeroRaiseSize)
  const currentScenario        = useStore(s => s.currentScenario)
  const useRng                 = useStore(s => s.useRngForFrequency)
  const checkAnswer            = useStore(s => s.checkDrillAnswer)
  const nextHand               = useStore(s => s.nextDrillHand)
  const stopDrill              = useStore(s => s.stopDrill)
  const incrementConsults      = useStore(s => s.incrementConsults)
  const stats                  = useStore(s => s.sessionStats)

  const heroStack = Object.values(currentScenario).find(p => p.isHero)?.stack ?? 100

  const [feedback, setFeedback]         = useState('')
  const [feedbackOk, setFeedbackOk]     = useState(true)
  const [answered, setAnswered]         = useState(false)
  const answeredRef                     = useRef(false)
  const [freqLabel, setFreqLabel]       = useState('')
  const [autoAdvance, setAutoAdvance]   = useState(false)
  const [prevSnapshot, setPrevSnapshot] = useState<PrevSnapshot | null>(null)
  const [viewingPrev, setViewingPrev]   = useState(false)
  const [modalViewMode, setModalViewMode] = useState<'actions' | 'heatmap' | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const goNextRef = useRef<() => void>(() => {})

  const sidebarW = sidebarCollapsed ? 28 : 208

  useEffect(() => {
    if (!answered || viewingPrev || !autoAdvance) return
    const t = setTimeout(() => goNextRef.current(), 2000)
    return () => clearTimeout(t)
  }, [answered, viewingPrev, autoAdvance])

  if (!activeDrillRange || !activeHand) return null

  function getFreqLabel(hand: string): string {
    const activeGrid = activeDrillStackGridIdx >= 0 && activeDrillRange!.stackGrids
      ? activeDrillRange!.stackGrids[activeDrillStackGridIdx].grid
      : activeDrillRange!.grid
    const d = activeGrid[hand]
    if (!d) return ''
    const parts: string[] = []
    const extraLabel = activeDrillRange!.customAction?.label
    if (d.allin > 0) parts.push(`${d.allin}% All-in`)
    if (d.raise > 0) parts.push(`${d.raise}% Raise`)
    if (d.call  > 0) parts.push(`${d.call}% Call`)
    if (d.extra && d.extra > 0 && extraLabel) parts.push(`${d.extra}% ${extraLabel}`)
    if (parts.length === 0) return '100% Fold'
    if (d.fold  > 0) parts.push(`${d.fold}% Fold`)
    return parts.join(' e ')
  }

  const displayHand    = viewingPrev ? prevSnapshot!.hand       : activeHand
  const displaySuits   = viewingPrev ? prevSnapshot!.suits      : currentHandSuits
  const displayRng     = viewingPrev ? prevSnapshot!.rng        : currentRng
  const showFeedback   = viewingPrev ? prevSnapshot!.feedback   : feedback
  const showFeedbackOk = viewingPrev ? prevSnapshot!.feedbackOk : feedbackOk
  const showFreqLabel  = viewingPrev ? prevSnapshot!.freqLabel  : freqLabel
  const isAnswered     = viewingPrev || answered

  const r1 = displayHand[0]
  const r2 = displayHand[1]
  const [s1, s2] = displaySuits

  function handleReplayEntry(entry: HandHistoryEntry) {
    const feedbackMsg = entry.correct ? `✓ ${entry.actionTaken}!` : `✗ Correto: ${entry.correctAction}`
    setPrevSnapshot({ hand: entry.hand, suits: entry.suits, rng: entry.rng, feedback: feedbackMsg, feedbackOk: entry.correct, freqLabel: '' })
    setViewingPrev(true)
  }

  function doGoNext() {
    if (viewingPrev) { setViewingPrev(false); return }
    if (answered) {
      setPrevSnapshot({ hand: activeHand, suits: currentHandSuits, rng: currentRng, feedback, feedbackOk, freqLabel })
    }
    answeredRef.current = false
    setAnswered(false)
    setFeedback('')
    setFreqLabel('')
    const ok = nextHand()
    if (!ok) { alert('Sem mais mãos!'); stopDrill() }
  }
  goNextRef.current = doGoNext

  function handleAction(act: string) {
    if (answeredRef.current || viewingPrev) return
    answeredRef.current = true
    const { correct, message } = checkAnswer(act)
    setFeedback(message)
    setFeedbackOk(correct)
    setFreqLabel(getFreqLabel(activeHand))
    setAnswered(true)
  }

  const customAction = activeDrillRange?.customAction
  const actionBtns = [
    { label: 'FOLD',                        action: 'Fold',               color: '#6b7280' },
    { label: 'CALL',                        action: 'Call',               color: '#22c55e' },
    ...(currentHeroRaiseSize > 0 ? [{ label: `RAISE (${currentHeroRaiseSize}bb)`, action: 'Raise', color: '#ef4444' }] : []),
    { label: `ALL IN (${heroStack}bb)`,     action: 'Allin',              color: '#6b2d0d' },
    ...(customAction ? [{ label: customAction.label.toUpperCase(), action: customAction.label, color: customAction.color }] : []),
  ]

  return (
    <div className="w-full h-[calc(100vh-90px)] overflow-auto">
      <div className="flex gap-2 min-h-full">

        {/* LEFT: dark box + controles */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">

          {/* Dark box: botões, mesa, cartas, resposta, ações */}
          <div
            className="rounded-2xl border border-warm-800 flex flex-col"
            style={{ background: '#16140f', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9)' }}
          >
            {/* Botões topo */}
            <div className="flex-shrink-0 flex items-center justify-between gap-1.5 pt-1.5 px-2">
              <div>
                {useRng && (
                  <span className="bg-warm-800 border border-warm-600 text-white text-xs rounded-full font-bold px-2.5 py-1 tracking-wider whitespace-nowrap">
                    RNG {displayRng}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setModalViewMode('heatmap')}
                  className="px-2 py-0.5 text-xs border border-warm-600 bg-warm-900/80 text-warm-300 rounded-lg hover:bg-warm-700 transition-colors"
                >
                  Erro / Acerto
                </button>
                <button
                  onClick={() => { setModalViewMode('actions'); incrementConsults() }}
                  className="px-2 py-0.5 text-xs border border-warm-600 bg-warm-900/80 text-warm-300 rounded-lg hover:bg-warm-700 transition-colors"
                >
                  Ver Range
                </button>
              </div>
            </div>

            {/* Mesa com cartas do hero */}
            <div className="flex justify-center px-10 pt-1 pb-[60px]">
              <div className="w-full max-w-[529px]">
                <PokerTableEditor heroCards={{ r1, s1, r2, s2 }} />
              </div>
            </div>

            {/* Resposta */}
            <div className="flex-shrink-0 min-h-[56px] flex flex-col justify-center text-center px-4 py-2">
              {!!showFeedback && (
                <>
                  <div className={`font-bold text-lg ${showFeedbackOk ? 'text-emerald-400' : 'text-red-400'}`}>
                    {showFeedback}
                  </div>
                  {!!showFreqLabel && (
                    <div className="text-warm-400 text-sm mt-0.5">
                      <span className="text-warm-300 font-semibold">{displayHand}</span>
                      <span className="text-warm-500"> — </span>
                      {showFreqLabel}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex-shrink-0 flex justify-center gap-2">
              {actionBtns.map(({ label, action, color }) => (
                <button
                  key={action}
                  onClick={() => handleAction(action)}
                  disabled={isAnswered}
                  className="text-white font-bold rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm"
                  style={{ backgroundColor: color }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Navegação */}
            <div className="flex-shrink-0 flex items-center justify-center gap-2 py-3">
              <button
                onClick={doGoNext}
                className={[
                  'px-6 py-2 rounded-xl font-bold text-sm transition-colors',
                  isAnswered ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-warm-700 hover:bg-warm-600 text-white',
                ].join(' ')}
              >
                {viewingPrev ? '← Mão atual' : 'Próxima Mão →'}
              </button>
              <button
                onClick={() => setAutoAdvance(a => !a)}
                className={[
                  'relative overflow-hidden px-6 py-2 rounded-xl border font-semibold text-sm transition-colors',
                  autoAdvance ? 'bg-brand-600/40 border-brand-500 text-brand-300' : 'bg-warm-800 border-warm-600 text-warm-400 hover:bg-warm-700',
                ].join(' ')}
              >
                {autoAdvance && answered && !viewingPrev && (
                  <span key={activeHand} className="absolute inset-y-0 left-0 bg-brand-500/30"
                    style={{ animation: 'btn-fill 2s linear forwards' }} />
                )}
                <span className="relative z-10">2s</span>
              </button>
              <button
                onClick={() => setViewingPrev(true)}
                disabled={!prevSnapshot || viewingPrev}
                className="px-4 py-2 rounded-xl border border-warm-600 bg-warm-800 text-warm-400 hover:bg-warm-700 font-semibold text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: histórico + stats */}
        <div className="flex-shrink-0 flex flex-col gap-2 sticky top-0 self-start" style={{ width: sidebarW, height: 'calc(100vh - 90px)' }}>
          {sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="flex-1 min-h-0 bg-warm-800 border border-warm-700 rounded-xl flex items-center justify-center text-warm-500 hover:text-white hover:bg-warm-700 transition-colors"
              title="Expandir histórico"
            >
              <span className="font-bold tracking-wider" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10 }}>HIST ›</span>
            </button>
          ) : (
            <>
              <div className="flex-1 min-h-0 flex flex-col relative">
                <HandHistorySidebar onOpenModal={onShowHistory} onReplayEntry={handleReplayEntry} />
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-warm-700 text-warm-400 hover:text-white hover:bg-warm-600 flex items-center justify-center text-xs transition-colors"
                  title="Minimizar histórico"
                >‹</button>
              </div>

              {/* Stats + info */}
              <div className="flex-shrink-0 bg-warm-800 border border-warm-700 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-white leading-tight truncate" title={activeDrillRange.name}>
                  {activeDrillRange.name}
                </div>
                {!!activeDrillStackRange && (
                  <span className="inline-block px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-900/40 border border-brand-700/50 text-brand-400 leading-tight">
                    {activeDrillStackRange}
                  </span>
                )}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                  <span className="text-warm-400">Mãos</span>
                  <span className="text-white font-bold text-right">{stats.hands}</span>
                  <span className="text-emerald-400">Acertos</span>
                  <span className="text-emerald-400 font-bold text-right">{stats.correct}</span>
                  <span className="text-red-400">Erros</span>
                  <span className="text-red-400 font-bold text-right">{stats.errors}</span>
                  <span className="text-warm-400">Consultas</span>
                  <span className="text-white font-bold text-right">{stats.consults}</span>
                </div>
                <div className="pt-1 border-t border-warm-700 space-y-1.5">
                  <button
                    onClick={stopDrill}
                    className="w-full py-1.5 text-xs border border-warm-700 bg-warm-900 text-warm-500 rounded-lg hover:bg-warm-700 hover:text-warm-200 font-semibold transition-colors"
                  >
                    Encerrar Treino
                  </button>
                  <button
                    onClick={onShowSummary}
                    className="w-full py-1.5 text-xs border border-brand-700/50 bg-brand-900/20 text-brand-400 rounded-lg hover:bg-brand-900/40 font-semibold transition-colors"
                  >
                    Encerrar e ver resumo
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal range */}
      {modalViewMode !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setModalViewMode(null)}>
          <div className="bg-warm-900 border border-warm-700 rounded-2xl p-6 max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-lg">{activeDrillRange!.name}</h3>
              <button onClick={() => setModalViewMode(null)} className="text-warm-400 hover:text-white text-xl">✕</button>
            </div>
            <HandMatrix
              readOnly
              grid={activeDrillStackGridIdx >= 0 && activeDrillRange!.stackGrids ? activeDrillRange!.stackGrids[activeDrillStackGridIdx].grid : activeDrillRange!.grid}
              heatmap={handPerformance[activeDrillRange!.id]}
              customActionColor={activeDrillRange!.customAction?.color}
              forceViewMode={modalViewMode ?? undefined}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main TrainerPage ─────────────────────────────────────────────────────── */
export function TrainerPage() {
  const activeDrillRange = useStore(s => s.activeDrillRange)
  const stopDrill        = useStore(s => s.stopDrill)
  const [showSummary, setShowSummary]   = useState(false)
  const [showHistory, setShowHistory]   = useState(false)

  if (showHistory) return <HistoryModal onClose={() => setShowHistory(false)} />
  if (showSummary) return (
    <DrillSummary
      onClose={() => { stopDrill(); setShowSummary(false) }}
      onBack={activeDrillRange ? () => setShowSummary(false) : undefined}
    />
  )
  if (activeDrillRange) return <DrillActive onShowSummary={() => setShowSummary(true)} onShowHistory={() => setShowHistory(true)} />

  return <DrillRangeSelect />
}
