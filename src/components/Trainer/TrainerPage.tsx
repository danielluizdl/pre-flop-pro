import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { HandMatrix } from '../RangeBuilder/HandMatrix'
import { PokerTableEditor } from '../ui/PokerTableEditor'
import { HandQuickSelect } from '../ui/HandQuickSelect'
import { RANKS, SUIT_ICONS } from '../../types'
import { ALL_HANDS } from '../../utils/hands'
import type { HandHistoryEntry } from '../../types'

/* ── Stats bar ──────────────────────────────────────────────────────────────── */
function StatsBar() {
  const stats = useStore(s => s.sessionStats)
  return (
    <div className="flex justify-center gap-5 bg-gray-800 border border-gray-700 py-2.5 px-5 rounded-xl font-semibold text-sm mb-4">
      <span className="text-gray-300">Mãos: <strong className="text-white">{stats.hands}</strong></span>
      <span className="text-emerald-400">Acertos: <strong>{stats.correct}</strong></span>
      <span className="text-red-400">Erros: <strong>{stats.errors}</strong></span>
      <span className="text-gray-400">Consultas: <strong>{stats.consults}</strong></span>
    </div>
  )
}

/* ── Playing card ────────────────────────────────────────────────────────────── */
function PlayingCard({ rank, suit }: { rank: string; suit: string }) {
  const colorMap: Record<string, string> = {
    h: 'bg-red-600',
    d: 'bg-blue-600',
    s: 'bg-gray-800',
    c: 'bg-emerald-700',
  }
  return (
    <div
      className={`relative w-16 h-24 rounded-lg ${colorMap[suit] ?? 'bg-gray-500'} shadow-lg border-2 border-white/30`}
    >
      <div className="absolute top-1 left-1.5 font-extrabold text-lg text-white leading-none">{rank}</div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl text-white">
        {SUIT_ICONS[suit]}
      </div>
      <div className="absolute bottom-1 right-1.5 font-extrabold text-lg text-white leading-none rotate-180">{rank}</div>
    </div>
  )
}

/* ── Mini card for history ─────────────────────────────────────────────────── */
function MiniCard({ rank, suit }: { rank: string; suit: string }) {
  const colorClass: Record<string, string> = {
    h: 'text-red-400', d: 'text-blue-400', s: 'text-gray-300', c: 'text-emerald-400',
  }
  return (
    <span className={`font-bold ${colorClass[suit] ?? 'text-gray-300'}`}>
      {rank}{SUIT_ICONS[suit]}
    </span>
  )
}

/* ── Hand history item ──────────────────────────────────────────────────────── */
function HandHistoryItem({ entry }: { entry: HandHistoryEntry }) {
  return (
    <div className={`p-2 rounded-lg border text-xs ${entry.correct ? 'border-emerald-700/40 bg-emerald-900/10' : 'border-red-700/40 bg-red-900/10'}`}>
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.correct ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <MiniCard rank={entry.hand[0]} suit={entry.suits[0]} />
        <MiniCard rank={entry.hand[1]} suit={entry.suits[1]} />
        <span className="ml-auto text-gray-500 tabular-nums">{entry.rng}</span>
      </div>
      <div className="pl-3.5">
        {entry.correct ? (
          <span className="text-emerald-400 font-semibold">{entry.actionTaken}</span>
        ) : (
          <>
            <span className="text-red-400">{entry.actionTaken}</span>
            <span className="text-gray-500"> → </span>
            <span className="text-emerald-400">{entry.correctAction}</span>
          </>
        )}
        {!!entry.raiseSize && <span className="text-gray-500"> ({entry.raiseSize})</span>}
      </div>
    </div>
  )
}

/* ── Hand history sidebar ────────────────────────────────────────────────────── */
function HandHistorySidebar() {
  const history = useStore(s => s.handHistory)
  const reversed = [...history].reverse()
  return (
    <div className="flex-1 min-h-0 bg-gray-800 rounded-xl border border-gray-700 p-3 flex flex-col">
      <h3 className="text-xs font-bold text-gray-400 mb-2 flex-shrink-0">
        HISTÓRICO <span className="text-gray-500">({history.length})</span>
      </h3>
      <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
        {reversed.length === 0 ? (
          <p className="text-xs text-gray-600 text-center mt-4">Sem mãos ainda</p>
        ) : (
          reversed.map(entry => <HandHistoryItem key={entry.id} entry={entry} />)
        )}
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
    <div className="max-w-xl mx-auto border border-gray-700 p-3 rounded-xl bg-gray-800/60 mb-6">
      {/* Controles em uma linha compacta */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {/* Seleção rápida */}
        <HandQuickSelect
          mode="filter"
          excludedHands={excluded}
          onSetExcluded={setExcluded}
        />

        <div className="h-4 border-l border-gray-600 mx-0.5" />

        {/* Tudo / Nada */}
        <button
          onClick={() => setExcluded([])}
          className="px-2.5 py-1 text-xs border border-gray-600 bg-gray-800 rounded-md hover:bg-gray-700 text-gray-300 transition-colors"
        >
          Tudo ✓
        </button>
        <button
          onClick={() => setExcluded([...ALL_HANDS])}
          className="px-2.5 py-1 text-xs border border-gray-600 bg-gray-800 rounded-md hover:bg-gray-700 text-gray-300 transition-colors"
        >
          Nada ✗
        </button>

        <div className="h-4 border-l border-gray-600 mx-0.5" />

        {/* RNG */}
        <span className="text-xs text-gray-500">RNG:</span>
        <button
          onClick={() => setUseRng(true)}
          className={['px-2.5 py-1 text-xs rounded-md border font-semibold transition-colors',
            useRng ? 'bg-brand-600 border-brand-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700',
          ].join(' ')}
        >
          Sim
        </button>
        <button
          onClick={() => setUseRng(false)}
          className={['px-2.5 py-1 text-xs rounded-md border font-semibold transition-colors',
            !useRng ? 'bg-brand-600 border-brand-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700',
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
                className="aspect-square flex items-center justify-center text-[0.55rem] font-bold text-gray-800 rounded-sm cursor-pointer border border-gray-600"
                style={{ background: isExcluded ? '#374151' : baseBg, opacity: isExcluded ? 0.3 : 1 }}
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


const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'EP', 'LJ', 'UTG']

/* ── Range select screen ────────────────────────────────────────────────────── */
function DrillRangeSelect() {
  const ranges        = useStore(s => s.ranges)
  const selectedIds   = useStore(s => s.selectedDrillRangeIds)
  const toggleDrillRange   = useStore(s => s.toggleDrillRange)
  const startDrillSession  = useStore(s => s.startDrillSession)
  const nextDrillHand      = useStore(s => s.nextDrillHand)
  const setPage            = useStore(s => s.setPage)

  const [step, setStep]           = useState<'select' | 'filter'>('select')
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

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
      <div className="space-y-4 max-w-2xl mx-auto">
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-1">Drill</h2>
          <p className="text-gray-400 text-sm">Selecione os ranges para o treino. Clique em uma posição para expandir.</p>
        </div>

        {ranges.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">Nenhum range criado.</p>
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

                return (
                  <div key={pos} className="border border-gray-700 rounded-xl overflow-hidden">
                    {/* Header */}
                    <button
                      onClick={() => toggleGroup(pos)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-white text-sm w-10 text-left">{pos}</span>
                        <span className="text-gray-400 text-xs">{group.length} range{group.length !== 1 ? 's' : ''}</span>
                        {selectedInGroup > 0 && (
                          <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {selectedInGroup} selecionado{selectedInGroup !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <span className={`text-gray-400 text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        ›
                      </span>
                    </button>

                    {/* Ranges list */}
                    {isOpen && (
                      <div className="border-t border-gray-700 bg-gray-900/40 p-3 grid gap-2"
                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
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
                                  : 'border-gray-700 bg-gray-800/60 hover:border-gray-500',
                              ].join(' ')}
                            >
                              {selected && (
                                <div className="absolute -top-1.5 -right-1.5 bg-brand-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow">
                                  ✔
                                </div>
                              )}
                              <h3 className="font-bold text-white text-sm leading-tight">{r.name}</h3>
                              <div className="text-xs text-gray-500 mt-1">{r.tableSize}-max · {r.scenarios.length} cenário{r.scenarios.length !== 1 ? 's' : ''}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-400">
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
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-white mb-1">Filtro de Mãos</h2>
        <p className="text-gray-400 text-sm">Arraste para selecionar/remover várias mãos.</p>
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
          className="px-4 py-2 border border-gray-600 bg-gray-800 text-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-700"
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

/* ── Active drill ──────────────────────────────────────────────────────────── */
function DrillActive() {
  const activeDrillRange = useStore(s => s.activeDrillRange)
  const handPerformance  = useStore(s => s.handPerformance)
  const activeHand = useStore(s => s.activeHand)
  const currentHandSuits = useStore(s => s.currentHandSuits)
  const currentRng = useStore(s => s.currentRng)
  const currentHeroRaiseSize = useStore(s => s.currentHeroRaiseSize)
  const currentScenario = useStore(s => s.currentScenario)
  const useRng = useStore(s => s.useRngForFrequency)
  const checkAnswer = useStore(s => s.checkDrillAnswer)
  const nextHand = useStore(s => s.nextDrillHand)
  const stopDrill = useStore(s => s.stopDrill)
  const incrementConsults = useStore(s => s.incrementConsults)

  const heroStack = Object.values(currentScenario).find(p => p.isHero)?.stack ?? 100

  const [feedback, setFeedback]       = useState('')
  const [feedbackOk, setFeedbackOk]   = useState(true)
  const [answered, setAnswered]       = useState(false)
  const [freqLabel, setFreqLabel]     = useState('')
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [prevSnapshot, setPrevSnapshot] = useState<PrevSnapshot | null>(null)
  const [viewingPrev, setViewingPrev] = useState(false)
  const [modalOpen, setModalOpen]     = useState(false)

  const goNextRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!answered || viewingPrev || !autoAdvance) return
    const t = setTimeout(() => goNextRef.current(), 2000)
    return () => clearTimeout(t)
  }, [answered, viewingPrev, autoAdvance])

  if (!activeDrillRange || !activeHand) return null

  function getFreqLabel(hand: string): string {
    const d = activeDrillRange!.grid[hand]
    if (!d) return ''
    const parts: string[] = []
    if (d.allin > 0) parts.push(`${d.allin}% All-in`)
    if (d.raise > 0) parts.push(`${d.raise}% Raise`)
    if (d.call  > 0) parts.push(`${d.call}% Call`)
    if (parts.length === 0) return '100% Fold'
    if (d.fold  > 0) parts.push(`${d.fold}% Fold`)
    return parts.join(' e ')
  }

  const displayHand    = viewingPrev ? prevSnapshot!.hand      : activeHand
  const displaySuits   = viewingPrev ? prevSnapshot!.suits     : currentHandSuits
  const displayRng     = viewingPrev ? prevSnapshot!.rng       : currentRng
  const showFeedback   = viewingPrev ? prevSnapshot!.feedback  : feedback
  const showFeedbackOk = viewingPrev ? prevSnapshot!.feedbackOk : feedbackOk
  const showFreqLabel  = viewingPrev ? prevSnapshot!.freqLabel : freqLabel
  const isAnswered     = viewingPrev || answered

  const r1 = displayHand[0]
  const r2 = displayHand[1]
  const [s1, s2] = displaySuits

  function doGoNext() {
    if (viewingPrev) { setViewingPrev(false); return }
    if (answered) {
      setPrevSnapshot({ hand: activeHand, suits: currentHandSuits, rng: currentRng, feedback, feedbackOk, freqLabel })
    }
    setAnswered(false)
    setFeedback('')
    setFreqLabel('')
    const ok = nextHand()
    if (!ok) { alert('Sem mais mãos!'); stopDrill() }
  }
  goNextRef.current = doGoNext

  function handleAction(act: string) {
    if (answered || viewingPrev) return
    const { correct, message } = checkAnswer(act)
    setFeedback(message)
    setFeedbackOk(correct)
    setFreqLabel(getFreqLabel(activeHand))
    setAnswered(true)
  }

  const actionBtns = [
    { label: 'FOLD', action: 'Fold', color: '#6b7280' },
    { label: 'CALL', action: 'Call', color: '#22c55e' },
    ...(currentHeroRaiseSize > 0 ? [{ label: `RAISE (${currentHeroRaiseSize}bb)`, action: 'Raise', color: '#ef4444' }] : []),
    { label: `ALL IN (${heroStack}bb)`, action: 'Allin', color: '#92400e' },
  ]

  const stats = useStore(s => s.sessionStats)

  return (
    <div className="flex gap-3 h-[calc(100vh-90px)] overflow-hidden">

      {/* LEFT: mesa (com cartas e ver range dentro) + botões + resposta + nav */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">

        {/* Dark box: mesa + cartas + botão Ver Range */}
        <div className="flex-1 min-h-0 rounded-2xl border border-gray-800 overflow-hidden relative flex flex-col"
          style={{ background: '#030712', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9)' }}>

          {/* Ver Range — canto superior direito */}
          <button
            onClick={() => { setModalOpen(true); incrementConsults() }}
            className="absolute top-3 right-3 z-10 px-2.5 py-1 text-xs border border-gray-600 bg-gray-900/80 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Ver Range
          </button>

          {/* Tabela */}
          <div className="flex-1 min-h-0 flex items-start justify-center" style={{ padding: '16px 44px 8px' }}>
            <div className="w-full" style={{ maxWidth: 'calc((100vh - 500px) / 0.63)' }}>
              <PokerTableEditor />
            </div>
          </div>

          {/* Cartas centralizadas — abaixo da mesa, dentro do box */}
          <div className="flex-shrink-0 border-t border-gray-800 py-3 px-6 flex items-center justify-center gap-3">
            <div className="w-20 flex justify-end flex-shrink-0">
              {useRng && (
                <span className="bg-gray-800 border border-gray-600 text-white px-2.5 py-1.5 rounded-full text-xs font-bold tracking-wider whitespace-nowrap">
                  RNG {displayRng}
                </span>
              )}
            </div>
            <PlayingCard rank={r1} suit={s1} />
            <PlayingCard rank={r2} suit={s2} />
            <div className="w-20 flex-shrink-0" />
          </div>
        </div>

        {/* Resposta */}
        <div className="flex-shrink-0 min-h-[44px] flex flex-col justify-center text-center">
          {!!showFeedback && (
            <>
              <div className={`text-xl font-bold ${showFeedbackOk ? 'text-emerald-400' : 'text-red-400'}`}>
                {showFeedback}
              </div>
              {!!showFreqLabel && (
                <div className="text-sm text-gray-400 mt-0.5">{showFreqLabel}</div>
              )}
            </>
          )}
        </div>

        {/* Botões de ação */}
        <div className="flex-shrink-0 flex gap-2 justify-center">
          {actionBtns.map(({ label, action, color }) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              disabled={isAnswered}
              className="text-white font-bold px-7 py-3.5 rounded-lg transition-all active:scale-95 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: color }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Navegação */}
        <div className="flex-shrink-0 flex items-center justify-center gap-2">
          <button
            onClick={doGoNext}
            className={[
              'px-8 py-2.5 rounded-xl font-bold text-sm transition-colors',
              isAnswered
                ? 'bg-brand-600 hover:bg-brand-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white',
            ].join(' ')}
          >
            {viewingPrev ? '← Mão atual' : 'Próxima Mão →'}
          </button>
          <button
            onClick={() => setAutoAdvance(a => !a)}
            className={[
              'px-3 py-2.5 text-xs rounded-xl border font-semibold transition-colors',
              autoAdvance
                ? 'bg-brand-600/40 border-brand-500 text-brand-300'
                : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700',
            ].join(' ')}
          >
            2s
          </button>
          <button
            onClick={() => setViewingPrev(true)}
            disabled={!prevSnapshot || viewingPrev}
            className="px-3 py-2.5 text-xs rounded-xl border border-gray-600 bg-gray-800 text-gray-400 hover:bg-gray-700 font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>
        </div>
      </div>

      {/* RIGHT: histórico + stats/info */}
      <div className="w-52 flex-shrink-0 flex flex-col gap-2">
        <HandHistorySidebar />

        {/* Stats + info */}
        <div className="flex-shrink-0 bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2">
          <div className="text-xs font-bold text-white leading-tight truncate" title={activeDrillRange.name}>
            {activeDrillRange.name}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
            <span className="text-gray-400">Mãos</span>
            <span className="text-white font-bold text-right">{stats.hands}</span>
            <span className="text-emerald-400">Acertos</span>
            <span className="text-emerald-400 font-bold text-right">{stats.correct}</span>
            <span className="text-red-400">Erros</span>
            <span className="text-red-400 font-bold text-right">{stats.errors}</span>
            <span className="text-gray-400">Consultas</span>
            <span className="text-white font-bold text-right">{stats.consults}</span>
          </div>
          <div className="pt-1 border-t border-gray-700">
            <button
              onClick={stopDrill}
              className="w-full py-1.5 text-xs border border-gray-700 bg-gray-900 text-gray-500 rounded-lg hover:bg-gray-700 hover:text-gray-200 font-semibold transition-colors"
            >
              Encerrar Treino
            </button>
          </div>
        </div>
      </div>

      {/* Modal range */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-lg">{activeDrillRange.name}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <HandMatrix readOnly grid={activeDrillRange.grid} heatmap={handPerformance[activeDrillRange.id]} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main TrainerPage ─────────────────────────────────────────────────────── */
export function TrainerPage() {
  const activeDrillRange = useStore(s => s.activeDrillRange)

  if (activeDrillRange) return <DrillActive />

  return <DrillRangeSelect />
}
