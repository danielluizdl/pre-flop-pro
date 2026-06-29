import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useStore } from '../../store/useStore'
import { countRender } from '../../test/renderCount'
import { HandMatrix } from '../RangeBuilder/HandMatrix'
import { PokerTableEditor } from '../ui/PokerTableEditor'
import { HandQuickSelect } from '../ui/HandQuickSelect'
import { RangePreviewModal } from '../ui/RangePreviewModal'
import { Eye } from 'lucide-react'
import { RANKS, SUIT_ICONS } from '../../types'
import { ALL_HANDS, getRngBands, formatRngBands } from '../../utils/hands'
import { useModalA11y } from '../../utils/useModalA11y'
import type { CSSProperties } from 'react'
import type { HandHistoryEntry, Range, TrainingSession } from '../../types'

/* ── Label helpers (compartilhados entre mão atual e replay do histórico) ─── */
function gridForRange(range: Range, stackGridIdx: number): Record<string, import('../../types').HandData> {
  const sg = stackGridIdx >= 0 ? range.stackGrids?.[stackGridIdx] : undefined
  return sg?.grid ?? range.grid
}

function freqLabelFor(range: Range, stackGridIdx: number, hand: string): string {
  const d = gridForRange(range, stackGridIdx)[hand]
  if (!d) return ''
  const parts: string[] = []
  const extraLabel = range.customAction?.label
  if (d.allin > 0) parts.push(`${d.allin}% All-in`)
  if (d.raise > 0) parts.push(`${d.raise}% Raise`)
  if (d.call  > 0) parts.push(`${d.call}% Call`)
  if (d.extra && d.extra > 0 && extraLabel) parts.push(`${d.extra}% ${extraLabel}`)
  if (parts.length === 0) return '100% Fold'
  if (d.fold  > 0) parts.push(`${d.fold}% Fold`)
  return parts.join(' e ')
}

function bandLabelFor(range: Range, stackGridIdx: number, hand: string): string {
  const d = gridForRange(range, stackGridIdx)[hand]
  return formatRngBands(getRngBands(d, range.customAction?.label))
}



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
const HandHistorySidebar = memo(function HandHistorySidebar({ onOpenModal, onReplayEntry }: { onOpenModal: () => void; onReplayEntry?: (entry: HandHistoryEntry) => void }) {
  countRender('historySidebar')
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
})

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
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
            // handPerf de sessões novas é chaveado por rangeId; sessões antigas, por rangeName (fallback).
            const mergedPerf = sessionPerf?.[String(r.id)] ?? sessionPerf?.[r.name] ?? {}
            const vals     = Object.values(mergedPerf)
            const total    = vals.reduce((s, v) => s + v.t, 0)
            const correct  = vals.reduce((s, v) => s + v.c, 0)
            const accuracy = total > 0 ? Math.round(correct / total * 100) : null
            const isOpenR  = openRangeId === r.id
            const stackRanges = r.stackGrids && r.stackGrids.length > 1 ? r.stackGrids.map(sg => sg.stackRange).filter(Boolean) : []
            const activeStack = isOpenR && stackRanges.length > 0 ? selectedStack : ''
            const perf     = (activeStack
              ? (sessionPerf?.[`${r.id}|||${activeStack}`] ?? sessionPerf?.[`${r.name}|||${activeStack}`])
              : (sessionPerf?.[String(r.id)] ?? sessionPerf?.[r.name])) ?? {}
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
          <h2 className="font-display uppercase text-warm-100 mb-1 text-[28px] leading-none tracking-wide">Histórico de Treino</h2>
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
  const acceptAnyFreq = useStore(s => s.acceptAnyFreq)
  const setAcceptAnyFreq = useStore(s => s.setAcceptAnyFreq)
  const focusErrors = useStore(s => s.focusErrors)
  const setFocusErrors = useStore(s => s.setFocusErrors)
  const isDrawing    = useRef(false)
  const drawAction   = useRef<'exclude' | 'include'>('exclude')
  const paintedHands = useRef<Set<string>>(new Set())

  function stopDraw() {
    isDrawing.current = false
    paintedHands.current = new Set()
  }

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

        {!useRng && (
          <>
            <div className="h-4 border-l border-warm-600 mx-0.5" />
            <button
              onClick={() => setAcceptAnyFreq(!acceptAnyFreq)}
              title="Aceita como acerto qualquer ação com frequência maior que zero"
              className={['px-2.5 py-1 text-xs rounded-md border font-semibold transition-colors',
                acceptAnyFreq ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:bg-warm-700',
              ].join(' ')}
            >
              Aceitar freq. {'>'} 0
            </button>
          </>
        )}

        <div className="h-4 border-l border-warm-600 mx-0.5" />
        <button
          onClick={() => setFocusErrors(!focusErrors)}
          title="Sorteia mais as mãos em que você erra mais (e as nunca treinadas)"
          className={['px-2.5 py-1 text-xs rounded-md border font-semibold transition-colors',
            focusErrors ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:bg-warm-700',
          ].join(' ')}
        >
          Focar erros
        </button>
      </div>

      <div
        className="grid gap-0.5 select-none"
        style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
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
                className="aspect-square flex items-center justify-center cursor-pointer"
                style={{
                  background: baseBg,
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                  color: '#1a1714',
                  ...(isExcluded
                    ? { opacity: 0.35, filter: 'saturate(0.6)' }
                    : { outline: '2px solid #d97757', outlineOffset: '-2px', zIndex: 2 }),
                }}
                onMouseDown={e => {
                  e.preventDefault()
                  isDrawing.current = true
                  paintedHands.current = new Set([hand])
                  drawAction.current = isExcluded ? 'include' : 'exclude'
                  toggle()
                }}
                onMouseOver={() => {
                  if (!isDrawing.current) return
                  if (paintedHands.current.has(hand)) return
                  paintedHands.current.add(hand)
                  if (drawAction.current === 'exclude') {
                    if (!excluded.includes(hand)) setExcluded([...excluded, hand])
                  } else {
                    if (excluded.includes(hand)) setExcluded(excluded.filter(h => h !== hand))
                  }
                }}
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
  const [notice, setNotice]         = useState('')

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
    if (!ok) setNotice('Nenhuma mão selecionada para treinar. Volte e inclua ao menos uma mão.')
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
          <h2 className="font-display uppercase text-warm-100 mb-1 text-[28px] leading-none tracking-wide">Drill</h2>
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
                      aria-expanded={isOpen}
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
                                      <span key={i} className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-500/10 border border-brand-500/40 text-brand-400 flex-shrink-0 leading-tight">
                                        {sg.stackRange}
                                      </span>
                                    ))
                                  ) : r.stackRange ? (
                                    <span className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-500/10 border border-brand-500/40 text-brand-400 flex-shrink-0 leading-tight">
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

            {notice && <p role="alert" className="text-sm text-red-400 pt-2 text-right">{notice}</p>}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-warm-400">
                {selectedIds.length > 0 ? `${selectedIds.length} range${selectedIds.length !== 1 ? 's' : ''} selecionado${selectedIds.length !== 1 ? 's' : ''}` : 'Nenhum selecionado'}
              </span>
              <button
                onClick={() => {
                  if (selectedIds.length === 0) { setNotice('Selecione pelo menos um range.'); return }
                  setNotice('')
                  setStep('filter')
                }}
                className="btn-commit"
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
        <h2 className="font-display uppercase text-warm-100 mb-1 text-[28px] leading-none tracking-wide">Filtro de Mãos</h2>
        <p className="text-warm-400 text-sm">Arraste para selecionar/remover várias mãos.</p>
      </div>
      <HandFilterGrid />
      {notice && <p role="alert" className="text-sm text-red-400 text-center">{notice}</p>}
      <div className="flex gap-3 justify-center">
        <button
          onClick={handleStartDrill}
          className="btn-commit"
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
  bandLabel: string
  range: import('../../types').Range
  stackGridIdx: number
}

/* ── Drill summary ───────────────────────────────────────────────────────────── */
function DrillSummary({ onClose, onBack }: { onClose: () => void; onBack?: () => void }) {
  const ranges          = useStore(s => s.ranges)
  const selectedIds     = useStore(s => s.selectedDrillRangeIds)
  const handPerformance = useStore(s => s.handPerformance)
  const sessionStats    = useStore(s => s.sessionStats)
  const sessionHandPerf = useStore(s => s.sessionHandPerf)
  const sessionSeverity = useStore(s => s.sessionSeverity)
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

  // Stats por range vêm do acumulador da sessão (não limitado ao cap de 50 do histórico visual).
  const sessionByRange = Object.entries(sessionHandPerf).reduce((acc, [key, hands]) => {
    if (key.includes('|||')) return acc
    const total = Object.values(hands).reduce((s, v) => s + v.t, 0)
    const correct = Object.values(hands).reduce((s, v) => s + v.c, 0)
    acc[key] = { total, correct }
    return acc
  }, {} as Record<string, { total: number; correct: number }>)

  const sessionAccuracy = sessionStats.hands > 0
    ? Math.round(sessionStats.correct / sessionStats.hands * 100)
    : null

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display uppercase text-warm-100 mb-1 text-[28px] leading-none tracking-wide">Resumo do Treino</h2>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
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
        {sessionStats.errors > 0 && (
          <div className="mt-3 pt-3 border-t border-warm-700 flex justify-center gap-6 text-xs">
            <span className="text-warm-400">Blunders: <span className="text-red-400 font-bold">{sessionSeverity.grave}</span></span>
            <span className="text-warm-400">Imprecisos: <span className="text-yellow-400 font-bold">{sessionSeverity.impreciso}</span></span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {trainedRanges.map(r => {
          const sess     = sessionByRange[String(r.id)] ?? { total: 0, correct: 0 }
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

/* ── Drill action button with LED perimeter trace ──────────────────────────── */
const LED: Record<string, { color: string; glow: string }> = {
  Call:  { color: '#22c55e', glow: 'rgba(34,197,94,0.55)' },
  Raise: { color: '#ef4444', glow: 'rgba(239,68,68,0.55)' },
  Allin: { color: '#c95f3a', glow: 'rgba(201,95,58,0.65)' },
}
function DrillActionButton({ name, sub, action, hotkey, isPressed, isDisabled, onClick }: {
  name: string; sub?: string; action: string; hotkey?: string; isPressed: boolean; isDisabled: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const led = LED[action]
  const active = hovered || isPressed
  const isFold = action === 'Fold'
  return (
    <button
      onClick={onClick}
      disabled={isDisabled && !isPressed}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 132, height: 54, padding: '0 22px',
        background: isPressed ? 'linear-gradient(180deg,#252220 0%,#16140f 100%)' : 'linear-gradient(180deg,#1f1d1a 0%,#16140f 100%)',
        border: `1px solid ${isPressed ? 'rgba(217,119,87,0.45)' : hovered ? '#4a463e' : '#2f2c25'}`,
        borderRadius: 8,
        boxShadow: isPressed
          ? 'inset 0 1px 0 rgba(255,255,255,0.06),0 0 0 1px rgba(217,119,87,0.35),0 0 22px rgba(217,119,87,0.18)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04),0 1px 0 rgba(0,0,0,0.5)',
        cursor: (isDisabled && !isPressed) ? 'not-allowed' : 'pointer',
        opacity: (isDisabled && !isPressed) ? 0.4 : 1,
        color: '#ede8de',
        transition: 'transform 0.08s ease',
      }}
    >
      {hotkey && (
        <span style={{ position:'absolute', top:4, right:6, fontSize:9, fontWeight:700, color:'#6b665c', letterSpacing:'0.05em', pointerEvents:'none' }}>
          {hotkey}
        </span>
      )}
      <span style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, lineHeight:1 }}>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:17, textTransform:'uppercase', letterSpacing:'0.10em' }}>
          {name}
        </span>
        {sub && (
          <span style={{ fontWeight:600, fontSize:10, letterSpacing:'0.05em', color:'#8a857a', fontVariantNumeric:'tabular-nums' }}>
            {sub}
          </span>
        )}
      </span>
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', overflow:'visible', pointerEvents:'none' }}
           viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="1" y="1" width="98" height="98" rx="5" ry="5" pathLength="100"
          style={{
            fill:'none',
            stroke: isFold ? (hovered ? 'rgba(168,161,147,0.55)' : 'transparent') : (led?.color ?? 'transparent'),
            strokeWidth: 2, strokeLinecap:'round',
            strokeDasharray: active ? '100 0' : '10 90',
            strokeDashoffset: active ? 0 : -33,
            filter: active
              ? `drop-shadow(0 0 12px ${isFold ? 'rgba(168,161,147,0.35)' : led?.glow})`
              : `drop-shadow(0 0 5px ${led?.glow ?? 'transparent'})`,
            transition: 'stroke-dasharray 0.6s cubic-bezier(0.2,0.7,0.2,1),stroke-dashoffset 0.6s cubic-bezier(0.2,0.7,0.2,1),filter 0.25s ease',
          }}
        />
      </svg>
    </button>
  )
}

/* Escolhe a primeira letra do label que não colida com as teclas já usadas */
function pickHotkey(label: string, used: Set<string>): string | undefined {
  for (const ch of label.toUpperCase()) {
    if (/[A-Z]/.test(ch) && !used.has(ch)) return ch
  }
  return undefined
}

/* ── Active drill ──────────────────────────────────────────────────────────── */
function DrillActive({ onShowSummary, onShowHistory }: { onShowSummary: () => void; onShowHistory: () => void }) {
  const ranges                 = useStore(s => s.ranges)
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
  const logConsult             = useStore(s => s.logConsult)
  const stats                  = useStore(s => s.sessionStats)

  const heroStack = Object.values(currentScenario).find(p => p.isHero)?.stack ?? 100

  const [feedback, setFeedback]         = useState('')
  const [feedbackOk, setFeedbackOk]     = useState(true)
  const [answered, setAnswered]         = useState(false)
  const [pressedAction, setPressedAction] = useState('')
  const answeredRef                     = useRef(false)
  const [freqLabel, setFreqLabel]       = useState('')
  const [bandLabel, setBandLabel]       = useState('')
  const [autoAdvance, setAutoAdvance]   = useState(false)
  const [prevSnapshot, setPrevSnapshot] = useState<PrevSnapshot | null>(null)
  const [viewingPrev, setViewingPrev]   = useState(false)
  const [modalViewMode, setModalViewMode] = useState<'actions' | 'heatmap' | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const viewRangeDialogRef = useModalA11y<HTMLDivElement>(modalViewMode !== null, () => setModalViewMode(null))

  const goNextRef = useRef<() => void>(() => {})
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {})

  // A mesa (PokerTableEditor) tem assentos em px fixos posicionados por %, então
  // encolher só a largura faz os assentos se sobreporem. Escalamos a mesa inteira
  // de forma proporcional quando o espaço fica abaixo da largura de projeto (529px),
  // preservando o layout do desktop em telas pequenas.
  const TABLE_DESIGN_W = 529
  const TABLE_DESIGN_H = TABLE_DESIGN_W * 0.63
  const tableFitRef = useRef<HTMLDivElement>(null)
  const [tableScale, setTableScale] = useState(1)
  useEffect(() => {
    const el = tableFitRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      setTableScale(w > 0 && w < TABLE_DESIGN_W ? w / TABLE_DESIGN_W : 1)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sidebarW = sidebarCollapsed ? 28 : 208

  useEffect(() => {
    if (!answered || viewingPrev || !autoAdvance) return
    const t = setTimeout(() => goNextRef.current(), 2000)
    return () => clearTimeout(t)
  }, [answered, viewingPrev, autoAdvance])

  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandlerRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const handleReplayEntry = useCallback((entry: HandHistoryEntry) => {
    const feedbackMsg = entry.correct ? `✓ ${entry.actionTaken}!` : `✗ Correto: ${entry.correctAction}`
    // Resolve por id (fallback por nome para entradas antigas) e reusa o stackGridIdx gravado.
    const entryRange = ranges.find(r => r.id === entry.rangeId) ?? ranges.find(r => r.name === entry.rangeName) ?? activeDrillRange!
    const stackGridIdx = entry.stackGridIdx ?? -1
    setPrevSnapshot({
      hand: entry.hand, suits: entry.suits, rng: entry.rng,
      feedback: feedbackMsg, feedbackOk: entry.correct,
      freqLabel: freqLabelFor(entryRange, stackGridIdx, entry.hand),
      bandLabel: bandLabelFor(entryRange, stackGridIdx, entry.hand),
      range: entryRange, stackGridIdx,
    })
    setViewingPrev(true)
  }, [ranges, activeDrillRange])

  if (!activeDrillRange || !activeHand) return null

  const displayHand    = viewingPrev ? prevSnapshot!.hand       : activeHand
  const displaySuits   = viewingPrev ? prevSnapshot!.suits      : currentHandSuits
  const displayRng     = viewingPrev ? prevSnapshot!.rng        : currentRng
  const showFeedback   = viewingPrev ? prevSnapshot!.feedback   : feedback
  const showFeedbackOk = viewingPrev ? prevSnapshot!.feedbackOk : feedbackOk
  const showFreqLabel  = viewingPrev ? prevSnapshot!.freqLabel  : freqLabel
  const showBandLabel  = viewingPrev ? prevSnapshot!.bandLabel  : bandLabel
  const isAnswered     = viewingPrev || answered

  const r1 = displayHand[0]
  const r2 = displayHand[1]
  const [s1, s2] = displaySuits

  function doGoNext() {
    if (viewingPrev) { setViewingPrev(false); return }
    if (answered) {
      setPrevSnapshot({ hand: activeHand, suits: currentHandSuits, rng: currentRng, feedback, feedbackOk, freqLabel, bandLabel, range: activeDrillRange!, stackGridIdx: activeDrillStackGridIdx })
    }
    answeredRef.current = false
    setAnswered(false)
    setPressedAction('')
    setFeedback('')
    setFreqLabel('')
    setBandLabel('')
    const ok = nextHand()
    // Sem mais mãos no filtro/range: mostra o resumo (em vez de um alert que
    // jogava o jogador de volta pra seleção). "Encerrar"/"Voltar" ficam no resumo.
    if (!ok) onShowSummary()
  }
  goNextRef.current = doGoNext

  function handleAction(act: string) {
    if (answeredRef.current || viewingPrev) return
    answeredRef.current = true
    setPressedAction(act)
    const { correct, message } = checkAnswer(act)
    setFeedback(message)
    setFeedbackOk(correct)
    setFreqLabel(freqLabelFor(activeDrillRange!, activeDrillStackGridIdx, activeHand))
    setBandLabel(bandLabelFor(activeDrillRange!, activeDrillStackGridIdx, activeHand))
    setAnswered(true)
  }

  const customAction = activeDrillRange?.customAction
  const baseBtns = [
    { name: 'FOLD',    sub: undefined,                        action: 'Fold',  hotkey: 'F' },
    { name: 'CALL',    sub: undefined,                        action: 'Call',  hotkey: 'C' },
    ...(currentHeroRaiseSize > 0 ? [{ name: 'RAISE', sub: `${currentHeroRaiseSize} BB`, action: 'Raise', hotkey: 'R' }] : []),
    { name: 'ALL-IN',  sub: `${heroStack} BB`,                action: 'Allin', hotkey: 'A' },
  ]
  const usedKeys = new Set(baseBtns.map(b => b.hotkey))
  const customHotkey = customAction ? pickHotkey(customAction.label, usedKeys) : undefined
  const actionBtns: { name: string; sub?: string; action: string; hotkey?: string }[] = [
    ...baseBtns,
    ...(customAction ? [{ name: customAction.label.toUpperCase(), sub: undefined, action: customAction.label, hotkey: customHotkey }] : []),
  ]
  const hotkeyMap: Record<string, string> = {}
  actionBtns.forEach(b => { if (b.hotkey) hotkeyMap[b.hotkey.toLowerCase()] = b.action })

  keyHandlerRef.current = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
    const key = e.key.toLowerCase()
    if (key === 'v') {
      e.preventDefault()
      if (modalViewMode === null) { setModalViewMode('actions'); incrementConsults(); if (activeDrillRange) logConsult(activeDrillRange.id, activeDrillRange.name, activeHand) }
      else setModalViewMode(null)
      return
    }
    if (modalViewMode !== null) return
    if (e.code === 'Space' || key === ' ') { e.preventDefault(); doGoNext(); return }
    if (key === 'arrowleft') { e.preventDefault(); if (prevSnapshot && !viewingPrev) setViewingPrev(true); return }
    const action = hotkeyMap[key]
    if (action) { e.preventDefault(); handleAction(action) }
  }

  return (
    <div className="w-full h-[calc(100vh-96px)] overflow-auto">
      <div className="flex flex-col lg:flex-row gap-2 min-h-full">

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
                  onClick={() => { setModalViewMode('actions'); incrementConsults(); if (activeDrillRange) logConsult(activeDrillRange.id, activeDrillRange.name, activeHand) }}
                  className="px-2 py-0.5 text-xs border border-warm-600 bg-warm-900/80 text-warm-300 rounded-lg hover:bg-warm-700 transition-colors"
                >
                  Ver Range
                </button>
              </div>
            </div>

            {/* Mesa com cartas do hero */}
            <div className="flex justify-center px-8 sm:px-10 pt-1 pb-[60px]">
              <div
                ref={tableFitRef}
                className="w-full max-w-[529px]"
                style={tableScale < 1 ? { height: TABLE_DESIGN_H * tableScale } : undefined}
              >
                <div style={tableScale < 1 ? { width: TABLE_DESIGN_W, transform: `scale(${tableScale})`, transformOrigin: 'top center' } : undefined}>
                  <PokerTableEditor heroCards={{ r1, s1, r2, s2 }} />
                </div>
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
                  {useRng && !!showBandLabel && (
                    <div className="text-warm-500 text-xs mt-0.5 tabular-nums">
                      RNG {displayRng}: {showBandLabel}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex-shrink-0 flex justify-center gap-2 flex-wrap px-4">
              {actionBtns.map(({ name, sub, action, hotkey }) => (
                <DrillActionButton
                  key={action}
                  name={name}
                  sub={sub}
                  action={action}
                  hotkey={hotkey}
                  isPressed={pressedAction === action}
                  isDisabled={isAnswered}
                  onClick={() => handleAction(action)}
                />
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
                aria-pressed={autoAdvance}
                aria-label="Avanço automático em 2 segundos"
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
        <div
          className="flex flex-col gap-2 w-full h-[60vh] lg:flex-shrink-0 lg:w-[var(--sw)] lg:h-[calc(100vh-96px)] lg:sticky lg:top-0 lg:self-start"
          style={{ ['--sw']: `${sidebarW}px` } as CSSProperties}
        >
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
                  <span className="inline-block px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-500/10 border border-brand-500/40 text-brand-400 leading-tight">
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
      {modalViewMode !== null && (() => {
        const modalRange = viewingPrev ? prevSnapshot!.range : activeDrillRange!
        const modalStackIdx = viewingPrev ? prevSnapshot!.stackGridIdx : activeDrillStackGridIdx
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setModalViewMode(null)}>
            <div ref={viewRangeDialogRef} className="bg-warm-900 border border-warm-700 rounded-2xl p-6 max-w-3xl w-full" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="drill-range-modal-title">
              <div className="flex justify-between items-center mb-4">
                <h3 id="drill-range-modal-title" className="font-bold text-white text-lg">{modalRange.name}</h3>
                <button onClick={() => setModalViewMode(null)} aria-label="Fechar" className="text-warm-400 hover:text-white text-xl">✕</button>
              </div>
              <HandMatrix
                readOnly
                grid={(modalStackIdx >= 0 ? modalRange.stackGrids?.[modalStackIdx]?.grid : undefined) ?? modalRange.grid}
                heatmap={handPerformance[modalRange.id]}
                customActionColor={modalRange.customAction?.color}
                forceViewMode={modalViewMode ?? undefined}
              />
            </div>
          </div>
        )
      })()}
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
