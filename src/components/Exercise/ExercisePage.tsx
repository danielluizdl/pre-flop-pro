import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { HandMatrix } from '../RangeBuilder/HandMatrix'
import { BrushControls } from '../RangeBuilder/BrushControls'
import { RangeActionGrid } from '../Admin/RangeActionGrid'
import { ComboCounter } from '../ui/ComboCounter'
import { HandQuickSelect } from '../ui/HandQuickSelect'
import { RANKS } from '../../utils/hands'
import { t } from '../../i18n'

const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'UTG']

function fmtScore(s: number): string {
  return Math.abs(s - Math.round(s)) < 0.05 ? String(Math.round(s)) : s.toFixed(1)
}

function scoreColor(s: number): string {
  return s >= 80 ? 'text-emerald-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400'
}

/* ── Seleção de ranges (acordeão por posição, como no drill) ────────────────── */
function BuildRangeSelect() {
  const ranges           = useStore(s => s.ranges)
  const selectedIds      = useStore(s => s.buildSelectedRangeIds)
  const toggleBuildRange = useStore(s => s.toggleBuildRange)
  const startBuild       = useStore(s => s.startBuildSession)
  const setPage          = useStore(s => s.setPage)

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [notice, setNotice]         = useState('')

  function toggleGroup(pos: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(pos) ? next.delete(pos) : next.add(pos)
      return next
    })
  }

  const grouped: Record<string, typeof ranges> = {}
  for (const r of ranges) {
    for (const pos of r.positions) {
      if (!grouped[pos]) grouped[pos] = []
      grouped[pos].push(r)
    }
  }
  const orderedKeys = [
    ...POSITION_ORDER.filter(p => grouped[p]),
    ...Object.keys(grouped).filter(p => !POSITION_ORDER.includes(p)).sort(),
  ]

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h2 className="font-display uppercase text-warm-100 mb-1 text-[28px] leading-none tracking-wide">{t.exercise.title}</h2>
        <p className="text-warm-400 text-sm">{t.exercise.selectIntro}</p>
      </div>

      {ranges.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-warm-400 mb-4">{t.exercise.noRanges}</p>
          <button
            onClick={() => setPage('ranges')}
            className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"
          >
            {t.exercise.goToRanges}
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
                <div key={pos} className="border border-warm-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleGroup(pos)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between px-4 py-3 bg-warm-800 hover:bg-warm-750 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-white text-sm w-10 text-left">{pos}</span>
                      <span className="text-warm-400 text-xs">{t.ranges.rangeCount(group.length)}</span>
                      {selectedInGroup > 0 && (
                        <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {t.drill.selectedBadge(selectedInGroup)}
                        </span>
                      )}
                    </div>
                    <span className={`text-warm-400 text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>›</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-warm-700 bg-warm-900/40 p-3">
                      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                        {group.map(r => {
                          const selected = selectedIds.includes(r.id)
                          const roundsInRange = r.stackGrids && r.stackGrids.length > 0 ? r.stackGrids.length : 1
                          return (
                            <div
                              key={r.id}
                              onClick={() => toggleBuildRange(r.id)}
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
                              <div className="flex items-start gap-1.5 flex-wrap">
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
                              <div className="text-xs text-warm-500 mt-1">{r.tableSize}-max · {t.exercise.roundsCount(roundsInRange)}</div>
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
              {selectedIds.length > 0 ? t.drill.selectedCount(selectedIds.length) : t.drill.noneSelected}
            </span>
            <button
              onClick={() => {
                if (selectedIds.length === 0) { setNotice(t.exercise.selectAtLeastOne); return }
                setNotice('')
                startBuild()
              }}
              className="btn-commit"
            >
              {t.exercise.start}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Confirmação pré-rounds ─────────────────────────────────────────────────── */
function BuildConfirm() {
  const rounds       = useStore(s => s.buildRounds)
  const confirmBuild = useStore(s => s.confirmBuildSession)
  const stopBuild    = useStore(s => s.stopBuildSession)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h2 className="font-display uppercase text-warm-100 mb-1 text-[28px] leading-none tracking-wide">{t.exercise.confirmTitle}</h2>
        <p className="text-warm-400 text-sm">{t.exercise.confirmIntro}</p>
      </div>

      <div className="space-y-2">
        {rounds.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 bg-warm-800 border border-warm-700 rounded-xl">
            <span className="text-warm-500 text-xs font-bold tabular-nums w-14">{t.exercise.roundOf(i + 1, rounds.length)}</span>
            <span className="font-bold text-white text-sm">{r.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => stopBuild()}
          className="px-4 py-2 border border-warm-600 bg-warm-800 text-warm-300 rounded-lg text-sm font-semibold hover:bg-warm-700 transition-colors"
        >
          {t.exercise.confirmBack}
        </button>
        <button onClick={() => confirmBuild()} className="btn-commit">
          {t.exercise.confirmStart}
        </button>
      </div>
    </div>
  )
}

/* ── Heatmap de diferença por mão ───────────────────────────────────────────── */
function diffColor(f: number): string {
  if (f <= 0.001) return 'rgba(34,197,94,0.4)'
  if (f <= 0.15) return 'rgba(234,179,8,0.5)'
  if (f <= 0.4) return 'rgba(249,115,22,0.55)'
  return 'rgba(239,68,68,0.6)'
}

function DiffGrid({ perHand }: { perHand: Record<string, number> }) {
  return (
    <div>
      <div className="mb-2">
        <h4 className="text-xs font-semibold text-warm-200">{t.exercise.diffTitle}</h4>
        <p className="text-[0.7rem] text-warm-500">{t.exercise.diffLegend}</p>
      </div>
      <div className="grid gap-0.5 select-none" style={{ gridTemplateColumns: 'repeat(13, 1fr)', maxWidth: 380 }}>
        {Array.from({ length: 13 }, (_, i) =>
          Array.from({ length: 13 }, (_, j) => {
            const hand = i === j ? RANKS[i] + RANKS[j] : i < j ? RANKS[i] + RANKS[j] + 's' : RANKS[j] + RANKS[i] + 'o'
            const f = perHand[hand] ?? 0
            return (
              <div
                key={hand}
                title={t.exercise.diffTooltip(hand, Math.round(f * 100))}
                className="relative aspect-square rounded-[4px] border border-warm-700/50 flex items-center justify-center overflow-hidden"
                style={{ background: '#16140f' }}
              >
                <div className="absolute inset-0 z-0" style={{ background: diffColor(f) }} />
                <span
                  className="relative z-10"
                  style={{ fontSize: 8, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: 'rgba(255,255,255,0.92)', fontWeight: 700, textShadow: '0 0 3px rgba(0,0,0,0.85)' }}
                >
                  {hand}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

/* ── Round ativo: pintar → nota + comparação ────────────────────────────────── */
function BuildRound() {
  const rounds        = useStore(s => s.buildRounds)
  const roundIdx      = useStore(s => s.buildRoundIdx)
  const lastResult    = useStore(s => s.buildLastResult)
  const submitRound   = useStore(s => s.submitBuildRound)
  const nextRound     = useStore(s => s.nextBuildRound)
  const stopBuild     = useStore(s => s.stopBuildSession)
  const buildResults  = useStore(s => s.buildResults)
  const userGrid      = useStore(s => s.rangeData.grid)
  const brush         = useStore(s => s.brush)

  const round = rounds[roundIdx]
  if (!round) return null
  const isLast = roundIdx === rounds.length - 1

  function finishEarly() {
    if (buildResults.length > 0) {
      useStore.setState({ buildRoundIdx: rounds.length, buildLastResult: null })
    } else {
      stopBuild()
    }
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display uppercase text-warm-100 mb-1 text-[28px] leading-none tracking-wide">
            {t.exercise.roundOf(roundIdx + 1, rounds.length)}
          </h2>
          <p className="text-warm-400 text-sm">
            {t.exercise.reproduceLabel} <span className="font-bold text-warm-100">{round.label}</span>
          </p>
        </div>
        <button
          onClick={finishEarly}
          className="px-4 py-2 border border-warm-600 bg-warm-800 text-warm-300 rounded-lg text-sm font-semibold hover:bg-warm-700 transition-colors"
        >
          {t.exercise.finishExercise}
        </button>
      </div>

      {!lastResult ? (
        <>
          <p className="text-warm-500 text-sm">{t.exercise.paintIntro}</p>
          <div className="flex flex-col xl:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0 w-full">
              <HandMatrix />
            </div>
            <div className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-3">
              <BrushControls />
              <HandQuickSelect mode="brush" />
              <ComboCounter grid={userGrid} extraLabel={brush.extraLabel || undefined} extraColor={brush.extraColor} />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => submitRound()} className="btn-commit">
              {t.exercise.submit}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-warm-800 border border-warm-700 rounded-xl p-4 flex items-center justify-center gap-3">
            <span className="text-xs font-bold text-warm-400 uppercase tracking-wider">{t.exercise.scoreLabel}</span>
            <span className={`text-3xl font-extrabold tabular-nums ${scoreColor(lastResult.score)}`}>
              {t.exercise.scoreOf(fmtScore(lastResult.score))}
            </span>
          </div>

          <div className="flex flex-wrap gap-6 items-start">
            <RangeActionGrid title={t.exercise.yourRange} subtitle={t.exercise.yourRangeSub} grid={lastResult.userGrid} />
            <RangeActionGrid title={t.exercise.answerKey} subtitle={t.exercise.answerKeySub} grid={round.grid} />
            <DiffGrid perHand={lastResult.perHand} />
          </div>

          <div className="max-w-sm">
            <ComboCounter grid={lastResult.userGrid} extraLabel={round.customAction?.label} extraColor={round.customAction?.color} />
          </div>

          <div className="flex justify-end">
            <button onClick={() => nextRound()} className="btn-commit">
              {isLast ? t.exercise.viewSummary : t.exercise.nextRound}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Resumo da sessão ───────────────────────────────────────────────────────── */
function BuildSummary() {
  const buildResults = useStore(s => s.buildResults)
  const stopBuild    = useStore(s => s.stopBuildSession)

  const avg = buildResults.length > 0
    ? buildResults.reduce((s, r) => s + r.score, 0) / buildResults.length
    : null

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display uppercase text-warm-100 mb-1 text-[28px] leading-none tracking-wide">{t.exercise.summaryTitle}</h2>
          <p className="text-warm-400 text-sm">{t.exercise.summaryIntro}</p>
        </div>
        <button
          onClick={() => stopBuild()}
          className="px-4 py-2 border border-warm-600 bg-warm-800 text-warm-300 rounded-lg text-sm font-semibold hover:bg-warm-700 transition-colors"
        >
          {t.exercise.finish}
        </button>
      </div>

      <div className="bg-warm-800 border border-warm-700 rounded-xl p-4 text-center">
        <div className={`text-3xl font-extrabold tabular-nums ${avg !== null ? scoreColor(avg) : 'text-warm-600'}`}>
          {avg !== null ? t.exercise.scoreOf(fmtScore(avg)) : '—'}
        </div>
        <div className="text-xs text-warm-400 mt-1">{t.exercise.avgScore}</div>
      </div>

      <div className="space-y-2">
        {buildResults.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 bg-warm-800 border border-warm-700 rounded-xl">
            <span className="font-bold text-white text-sm">{r.label}</span>
            <span className={`text-sm font-bold tabular-nums ${scoreColor(r.score)}`}>
              {t.exercise.scoreOf(fmtScore(r.score))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ExercisePage() {
  const rounds    = useStore(s => s.buildRounds)
  const roundIdx  = useStore(s => s.buildRoundIdx)
  const confirmed = useStore(s => s.buildConfirmed)

  if (rounds.length === 0) return <BuildRangeSelect />
  if (!confirmed) return <BuildConfirm />
  if (roundIdx >= rounds.length) return <BuildSummary />
  return <BuildRound />
}
