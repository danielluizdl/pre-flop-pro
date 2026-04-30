import { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { HandMatrix } from '../RangeBuilder/HandMatrix'
import { PokerTableEditor } from '../ui/PokerTableEditor'
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
    <div className="w-48 flex-shrink-0 bg-gray-800 rounded-xl border border-gray-700 p-3 flex flex-col" style={{ maxHeight: 680, minHeight: 400 }}>
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
      <div className="flex gap-2 justify-center mb-3 flex-wrap">
        <button
          onClick={() => setExcluded([])}
          className="px-3 py-1.5 text-xs border border-gray-600 bg-gray-800 rounded hover:bg-gray-700 text-gray-300"
        >
          Selecionar Tudo
        </button>
        <button
          onClick={() => setExcluded([...ALL_HANDS])}
          className="px-3 py-1.5 text-xs border border-gray-600 bg-gray-800 rounded hover:bg-gray-700 text-gray-300"
        >
          Remover Tudo
        </button>
        <div className="flex items-center gap-1.5 ml-2 border-l border-gray-600 pl-2">
          <span className="text-xs text-gray-400">Usar RNG?</span>
          <button
            onClick={() => setUseRng(true)}
            className={['px-2.5 py-1 text-xs rounded border font-semibold transition-colors',
              useRng ? 'bg-brand-600 border-brand-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700',
            ].join(' ')}
          >
            Sim
          </button>
          <button
            onClick={() => setUseRng(false)}
            className={['px-2.5 py-1 text-xs rounded border font-semibold transition-colors',
              !useRng ? 'bg-brand-600 border-brand-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700',
            ].join(' ')}
          >
            Não
          </button>
        </div>
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

/* ── Range select screen ────────────────────────────────────────────────────── */
function DrillRangeSelect() {
  const ranges = useStore(s => s.ranges)
  const selectedIds = useStore(s => s.selectedDrillRangeIds)
  const toggleDrillRange = useStore(s => s.toggleDrillRange)
  const startDrillSession = useStore(s => s.startDrillSession)
  const nextDrillHand = useStore(s => s.nextDrillHand)
  const setPage = useStore(s => s.setPage)

  const [step, setStep] = useState<'select' | 'filter'>('select')

  function handleStartDrill() {
    startDrillSession()
    const ok = nextDrillHand()
    if (!ok) alert('Nenhuma mão selecionada!')
  }

  if (step === 'select') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-1">Selecionar Ranges</h2>
          <p className="text-gray-400 text-sm">Clique nos ranges que deseja incluir no treino.</p>
        </div>

        {ranges.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">Nenhum range criado. Crie um range primeiro.</p>
            <button
              onClick={() => setPage('ranges')}
              className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"
            >
              Ir para Meus Ranges
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {ranges.map(r => (
                <div
                  key={r.id}
                  onClick={() => toggleDrillRange(r.id)}
                  className={[
                    'border rounded-xl p-4 cursor-pointer transition-all relative',
                    selectedIds.includes(r.id)
                      ? 'border-brand-500 bg-brand-900/20'
                      : 'border-gray-700 bg-gray-800/60 hover:border-gray-500',
                  ].join(' ')}
                >
                  {selectedIds.includes(r.id) && (
                    <div className="absolute -top-2 -right-2 bg-brand-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow">
                      ✔
                    </div>
                  )}
                  <div className="text-xs text-gray-400 font-semibold">{r.positions.join(', ')}</div>
                  <h3 className="font-bold text-white mt-0.5">{r.name}</h3>
                  <div className="text-xs text-gray-500 mt-0.5">{r.tableSize}-max · {r.scenarios.length} cenário(s)</div>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
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
    <div className="space-y-6">
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

  const [feedback, setFeedback] = useState('')
  const [feedbackOk, setFeedbackOk] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  if (!activeDrillRange || !activeHand) return null

  const r1 = activeHand[0]
  const r2 = activeHand[1]
  const [s1, s2] = currentHandSuits

  function advanceToNextHand() {
    const ok = nextHand()
    if (!ok) { alert('Sem mais mãos!'); stopDrill() }
  }

  function handleAction(act: string) {
    const { correct, message } = checkAnswer(act)
    setFeedback(message)
    setFeedbackOk(correct)
    setTimeout(() => { setFeedback(''); advanceToNextHand() }, correct ? 900 : 1500)
  }

  const actionBtns = [
    { label: 'FOLD', action: 'Fold', color: '#6b7280' },
    { label: 'CALL', action: 'Call', color: '#22c55e' },
    { label: currentHeroRaiseSize ? `RAISE (${currentHeroRaiseSize}bb)` : 'RAISE', action: 'Raise', color: '#ef4444' },
    { label: `ALL IN (${heroStack}bb)`, action: 'Allin', color: '#8b5cf6' },
  ]

  return (
    <div className="flex gap-4 items-start">
      <HandHistorySidebar />

      <div className="flex-1 min-w-0">
        <StatsBar />

        {/* Range name */}
        <div className="flex justify-center items-center gap-3 mb-4">
          <h2 className="font-extrabold text-xl text-white">{activeDrillRange.name}</h2>
          <button
            onClick={() => { setModalOpen(true); incrementConsults() }}
            className="px-3 py-1.5 text-xs border border-gray-600 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
          >
            👁 Ver Range
          </button>
        </div>

        {/* Dark table box */}
        <div className="rounded-2xl border border-gray-800 overflow-visible"
          style={{ background: '#030712', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9)' }}>
          <div className="flex justify-center pt-8 pb-14 px-16">
            <div className="w-full max-w-2xl">
              <PokerTableEditor />
            </div>
          </div>

          {/* Bottom strip — cards aligned with table center */}
          <div className="px-16 py-5 border-t border-gray-800">
            <div className="w-full max-w-2xl mx-auto relative flex items-center justify-center gap-4">
              {useRng && (
                <span className="bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded-full text-sm font-bold tracking-wider flex-shrink-0">
                  RNG {currentRng}
                </span>
              )}
              <PlayingCard rank={r1} suit={s1} />
              <PlayingCard rank={r2} suit={s2} />
              <button
                onClick={() => { setFeedback(''); advanceToNextHand() }}
                className="absolute right-0 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold text-sm transition-colors"
              >
                Próxima Mão →
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center mt-5">
          {actionBtns.map(({ label, action, color }) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              className="text-white font-bold px-7 py-4 rounded-lg cursor-pointer min-w-[100px] transition-transform active:scale-95 text-sm"
              style={{ backgroundColor: color }}
            >
              {label}
            </button>
          ))}
        </div>

        {feedback && (
          <div className={`mt-4 text-xl font-bold text-center ${feedbackOk ? 'text-emerald-400' : 'text-red-400'}`}>
            {feedback}
          </div>
        )}

        <div className="flex justify-end mt-5">
          <button
            onClick={stopDrill}
            className="px-4 py-2 border border-gray-700 bg-gray-800 text-gray-400 rounded-lg text-sm font-semibold hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            Encerrar Treino
          </button>
        </div>

        {/* Range view modal */}
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
    </div>
  )
}

/* ── Main TrainerPage ─────────────────────────────────────────────────────── */
export function TrainerPage() {
  const activeDrillRange = useStore(s => s.activeDrillRange)

  if (activeDrillRange) return <DrillActive />

  return <DrillRangeSelect />
}
