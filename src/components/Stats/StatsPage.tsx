import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import type { BuildHistoryRound, BuildSession, HandData, HandHistoryEntry, Range, TrainingSession } from '../../types'
import { HandMatrix } from '../RangeBuilder/HandMatrix'
import { PageTutorialButton } from '../ui/PageTutorialButton'
import { MyAccountStats } from './MyAccountStats'
import { BuildAccountStats } from './BuildAccountStats'
import { MyCoachPanel } from './MyCoachPanel'
import { AccuracySparkline } from './AccuracySparkline'
import { Skeleton } from '../ui/Skeleton'
import { t, dateLocale } from '../../i18n'
import { downloadText } from '../../utils/download'
import { buildSessionCsv, sessionCsvFilename } from '../../utils/sessionCsv'
import { resolveSessionRanges, sessionRangeKey } from '../../utils/sessionRanges'
import { SessionHandLog } from '../ui/SessionHandLog'
import { usePagedList, ShowMoreButton } from '../ui/PagedList'
import { RangeActionGrid } from '../Admin/RangeActionGrid'
import { DiffGrid } from '../ui/DiffGrid'
import { decodeSparse } from '../../utils/sparseGrid'
import { scoreBuild } from '../../utils/buildScore'
import { makeEmptyGrid } from '../../utils/hands'

const EMPTY_GRID = makeEmptyGrid()

const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'EP', 'LJ', 'UTG']

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(dateLocale(), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/* ── Histórico na nuvem — a lista vem do servidor pra quem está logado
   (functions/api/me/stats), o replay de cada sessão é buscado sob demanda
   só quando abre o detalhe, pra não pesar a lista inteira de uma vez. ────── */

function mapCloudSession(row: Record<string, unknown>): TrainingSession {
  let rangeNames: string[] = []
  try { rangeNames = JSON.parse(String(row.range_names ?? '[]')) } catch { /* mantém vazio */ }
  return {
    id: Number(row.id),
    timestamp: Number(row.started_at ?? 0) * 1000,
    rangeNames,
    tableSize: Number(row.table_size ?? 8),
    hands: Number(row.hands ?? 0),
    correct: Number(row.correct ?? 0),
    errors: Number(row.errors ?? 0),
    consults: Number(row.consults ?? 0),
    durationSeconds: Number(row.duration_seconds ?? 0),
    sessionUuid: (row.session_uuid as string | null) ?? undefined,
  }
}

function mapCloudHandRow(row: Record<string, unknown>): HandHistoryEntry {
  const suits = typeof row.suits === 'string' ? row.suits : ''
  return {
    id: Number(row.createdAt ?? Date.now()),
    hand: String(row.hand),
    suits: [suits[0] ?? 's', suits[1] ?? 'h'],
    actionTaken: String(row.actionTaken),
    correctAction: String(row.correctAction),
    rng: Number(row.rng ?? 0),
    correct: row.isCorrect === 1,
    rangeName: String(row.rangeName ?? ''),
    rangeId: Number(row.rangeId),
    stackGridIdx: Number(row.stackGridIdx ?? -1),
    raiseSize: (row.raiseSize as string | null) ?? undefined,
    stackRange: (row.stackRange as string | null) ?? undefined,
    severity: (row.severity as 'grave' | 'impreciso' | null) ?? undefined,
  }
}

// Deriva handPerf (heatmap por range/mão) direto do log — mais preciso que
// guardar um agregado à parte, já que vem da mesma fonte de verdade.
function computeHandPerf(handLog: HandHistoryEntry[]): Record<string, Record<string, { c: number; t: number }>> {
  const map: Record<string, Record<string, { c: number; t: number }>> = {}
  const bump = (key: string, hand: string, correct: boolean) => {
    if (!map[key]) map[key] = {}
    const prev = map[key][hand] ?? { c: 0, t: 0 }
    map[key][hand] = { c: prev.c + (correct ? 1 : 0), t: prev.t + 1 }
  }
  for (const e of handLog) {
    bump(String(e.rangeId), e.hand, e.correct)
    if (e.stackRange) bump(`${e.rangeId}|||${e.stackRange}`, e.hand, e.correct)
  }
  return map
}

// rangeIds não vem no registro da sessão em si (só rangeNames) — resolve pelo
// primeiro hand_event de cada nome, na mesma ordem de rangeNames.
function deriveRangeIds(rangeNames: string[], handLog: HandHistoryEntry[]): number[] {
  const ids: number[] = []
  for (const name of rangeNames) {
    const found = handLog.find(e => e.rangeName === name)
    if (found) ids.push(found.rangeId)
  }
  return ids
}

async function fetchSessionHandLog(sessionUuid: string, authToken: string): Promise<HandHistoryEntry[]> {
  const res = await fetch(`/api/me/stats?view=session-hands&session_uuid=${encodeURIComponent(sessionUuid)}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  const data = await res.json()
  return ((data.rows ?? []) as Record<string, unknown>[]).map(mapCloudHandRow)
}

function mapCloudBuildSession(row: Record<string, unknown>): BuildSession {
  const rangeNames = typeof row.rangeNames === 'string' ? row.rangeNames.split(',') : []
  const startedAt = Number(row.startedAt ?? 0)
  return {
    id: startedAt || Date.now(),
    timestamp: startedAt * 1000,
    rangeNames,
    rounds: [],
    avgScore: Number(row.avgScore ?? 0),
    sessionUuid: (row.sessionUuid as string | null) ?? undefined,
  }
}

function mapCloudBuildRound(row: Record<string, unknown>): BuildHistoryRound {
  let userGrid: Record<string, HandData> | undefined
  let answerGrid: Record<string, HandData> | undefined
  try { userGrid = row.userGrid ? JSON.parse(String(row.userGrid)) : undefined } catch { /* sem replay */ }
  try { answerGrid = row.answerGrid ? JSON.parse(String(row.answerGrid)) : undefined } catch { /* sem replay */ }
  const rangeName = String(row.rangeName ?? '')
  const stackRange = (row.stackRange as string | null) ?? undefined
  return {
    label: stackRange ? `${rangeName} — ${stackRange}` : rangeName,
    score: Number(row.score ?? 0),
    attempt: Number(row.attempt ?? 1),
    rangeId: Number(row.rangeId),
    stackRange,
    userGrid,
    answerGrid,
  }
}

async function fetchBuildSessionRounds(sessionUuid: string, authToken: string): Promise<BuildHistoryRound[]> {
  const res = await fetch(`/api/me/stats?view=build-session-rounds&session_uuid=${encodeURIComponent(sessionUuid)}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  const data = await res.json()
  return ((data.rows ?? []) as Record<string, unknown>[]).map(mapCloudBuildRound)
}

/* ── Detalhe de sessão ─────────────────────────────────────────────────────── */
function SessionDetailView({ session, ranges, onBack }: {
  session: TrainingSession
  ranges: Range[]
  onBack: () => void
}) {
  const [openKey, setOpenKey]         = useState<string | null>(null)
  const [viewMode, setViewMode]       = useState<'actions' | 'heatmap'>('heatmap')
  const [selectedStack, setSelectedStack] = useState('')

  const sessionRanges = resolveSessionRanges(session, ranges)

  useEffect(() => { setViewMode('heatmap') }, [openKey])
  useEffect(() => {
    const r = openKey !== null ? sessionRanges.find(ref => sessionRangeKey(ref) === openKey)?.range : null
    setSelectedStack(r?.stackGrids && r.stackGrids.length > 1 ? r.stackGrids[0].stackRange : '')
  }, [openKey])

  const acc = session.hands > 0 ? Math.round(session.correct / session.hands * 100) : null
  const sessionPerf = session.handPerf ?? null

  return (
    <div className="space-y-4 max-w-2xl">

      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-warm-400 hover:text-warm-100 text-sm font-semibold transition-colors mb-1"
          >
            {t.stats.back}
          </button>
          <h2 className="text-xl font-extrabold text-warm-100">{formatDate(session.timestamp)}</h2>
          <p className="text-warm-400 text-xs">{session.tableSize}-max · {formatDuration(session.durationSeconds)} · {sessionRanges.map(x => x.name).join(', ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-warm-700/30 rounded-2xl overflow-hidden">
        {[
          { label:t.stats.hands,    value: String(session.hands),    color:'text-warm-100' },
          { label:t.stats.correct, value: String(session.correct),  color:'text-result-good' },
          { label:t.stats.errors,   value: String(session.errors),   color:'text-result-bad' },
          { label:t.stats.accuracy, value: acc !== null ? `${acc}%` : '—',
            color: acc === null ? 'text-warm-500' : acc >= 80 ? 'text-brand-500' : acc >= 50 ? 'text-gold' : 'text-result-bad' },
        ].map(item => (
          <div key={item.label} className="bg-warm-900 p-4 text-center">
            <div className="eyebrow mb-1">{item.label}</div>
            <div className={`font-display tabular-nums leading-none ${item.color}`} style={{ fontSize:36, letterSpacing:'0.01em' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {sessionRanges.length === 0 ? (
        <p className="text-warm-500 text-sm text-center py-4">{t.stats.rangesNotFound}</p>
      ) : (
        <div className="space-y-2">
          {sessionRanges.map(ref => {
            const key = sessionRangeKey(ref)
            const mergedPerf = (ref.id !== null ? sessionPerf?.[String(ref.id)] : undefined) ?? sessionPerf?.[ref.name] ?? {}
            const vals     = Object.values(mergedPerf)
            const total    = vals.reduce((s, v) => s + v.t, 0)
            const correct  = vals.reduce((s, v) => s + v.c, 0)
            const accuracy = total > 0 ? Math.round(correct / total * 100) : null
            const isOpen   = openKey === key

            if (ref.range === null) {
              return (
                <div key={key} className="border border-warm-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    disabled={total === 0}
                    className="w-full flex items-center justify-between px-4 py-3 bg-warm-800/60 transition-colors text-left disabled:cursor-default"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-bold text-warm-300 text-sm truncate">{ref.name}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-warm-700/60 border border-warm-600 text-warm-400 flex-shrink-0">{t.stats.rangeDeleted}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {accuracy !== null ? (
                        <span className={`text-sm font-bold ${accuracy >= 80 ? 'text-emerald-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {accuracy}%
                        </span>
                      ) : (
                        <span className="text-warm-600 text-xs">{t.stats.noData}</span>
                      )}
                      {total > 0 && (
                        <span className={`text-warm-400 text-lg transition-transform duration-200 inline-block ${isOpen ? 'rotate-180' : ''}`}>›</span>
                      )}
                    </div>
                  </button>
                  {isOpen && total > 0 && (
                    <div className="border-t border-warm-700 bg-warm-900/40 p-4">
                      <HandMatrix readOnly grid={EMPTY_GRID} heatmap={mergedPerf} forceViewMode="heatmap" />
                    </div>
                  )}
                </div>
              )
            }

            const r = ref.range
            const stackRanges = r.stackGrids && r.stackGrids.length > 1 ? r.stackGrids.map(sg => sg.stackRange).filter(Boolean) : []
            const activeStack = isOpen && stackRanges.length > 0 ? selectedStack : ''
            const perf     = (activeStack
              ? (sessionPerf?.[`${r.id}|||${activeStack}`] ?? sessionPerf?.[`${r.name}|||${activeStack}`])
              : (sessionPerf?.[String(r.id)] ?? sessionPerf?.[r.name])) ?? {}
            const gridIdx  = activeStack ? r.stackGrids!.findIndex(sg => sg.stackRange === activeStack) : 0
            const grid     = r.stackGrids && gridIdx >= 0 ? r.stackGrids[gridIdx].grid : (r.stackGrids?.[0]?.grid ?? r.grid)

            return (
              <div key={key} className="border border-warm-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenKey(isOpen ? null : key)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-warm-800 hover:bg-warm-750 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-warm-100 text-sm">{r.name}</span>
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
                      <span className="text-warm-600 text-xs">{t.stats.noData}</span>
                    )}
                    <span className={`text-warm-400 text-lg transition-transform duration-200 inline-block ${isOpen ? 'rotate-180' : ''}`}>›</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-warm-700 bg-warm-900/40 p-4">
                    {sessionPerf === null ? (
                      <p className="text-warm-500 text-xs text-center py-4">{t.stats.perHandUnavailable}</p>
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
                              {mode === 'heatmap' ? t.matrix.errorMode : t.stats.viewRange}
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

      <SessionHandLog handLog={session.handLog} />
    </div>
  )
}

/* ── Card de sessão ────────────────────────────────────────────────────────── */
function SessionCard({ session, onView }: { session: TrainingSession; onView: () => void }) {
  const accuracy = session.hands > 0 ? Math.round((session.correct / session.hands) * 100) : 0
  const color = accuracy >= 80 ? 'text-brand-500' : accuracy >= 50 ? 'text-gold' : 'text-result-bad'

  return (
    <div className="card-surface p-4 flex gap-4 items-start">
      <div className={`font-stat font-black tabular-nums text-3xl w-16 text-center flex-shrink-0 leading-none ${color}`}>
        {accuracy}%
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs text-warm-400">{formatDate(session.timestamp)}</span>
          <span className="text-xs text-warm-600">·</span>
          <span className="text-xs text-warm-400">{session.tableSize}-max</span>
          <span className="text-xs text-warm-600">·</span>
          <span className="text-xs text-warm-400">{formatDuration(session.durationSeconds)}</span>
        </div>
        <div className="font-display uppercase text-warm-100 truncate mb-1.5 leading-none" style={{ fontSize:18, letterSpacing:'0.03em' }}>
          {session.rangeNames.join(' · ') || t.stats.noName}
        </div>
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="text-warm-300">{t.stats.handsLabel} <strong className="text-warm-100">{session.hands}</strong></span>
          <span className="text-emerald-400">{t.stats.correctLabel} <strong>{session.correct}</strong></span>
          <span className="text-red-400">{t.stats.errorsLabel} <strong>{session.errors}</strong></span>
          {session.consults > 0 && (
            <span className="text-warm-500">{t.stats.consultsLabel} <strong>{session.consults}</strong></span>
          )}
        </div>
      </div>
      <button
        onClick={() => {
          const csv = buildSessionCsv(session, useStore.getState().ranges)
          downloadText(sessionCsvFilename(session), csv, 'text/csv')
        }}
        title={t.stats.exportCsv}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-warm-600 bg-warm-900/60 text-warm-400 hover:text-warm-100 hover:border-warm-400 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      <button
        onClick={onView}
        title={t.stats.viewDetails}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-warm-600 bg-warm-900/60 text-warm-400 hover:text-warm-100 hover:border-warm-400 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </div>
  )
}

/* ── Desempenho global ─────────────────────────────────────────────────────── */
function GlobalHistoryPanel() {
  const ranges          = useStore(s => s.ranges)
  const handPerformance = useStore(s => s.handPerformance)

  const [openPositions, setOpenPositions] = useState<Set<string>>(new Set())
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

  const trainedRanges = ranges.filter(r => {
    const perf = handPerformance[r.id]
    return perf && Object.values(perf).some(v => v.t > 0)
  })

  const grouped: Record<string, Range[]> = {}
  for (const r of trainedRanges) {
    for (const pos of r.positions) {
      if (!grouped[pos]) grouped[pos] = []
      grouped[pos].push(r)
    }
  }
  const orderedKeys = [
    ...POSITION_ORDER.filter(p => grouped[p]),
    ...Object.keys(grouped).filter(p => !POSITION_ORDER.includes(p)).sort(),
  ]

  function togglePosition(pos: string) {
    setOpenPositions(prev => {
      const next = new Set(prev)
      next.has(pos) ? next.delete(pos) : next.add(pos)
      return next
    })
  }

  if (orderedKeys.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-warm-400 text-sm">{t.stats.noTrainingData}</p>
        <p className="text-warm-500 text-xs mt-1">{t.stats.completeToSeePerf}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {orderedKeys.map(pos => {
        const group     = grouped[pos]
        const isPosOpen = openPositions.has(pos)

        return (
          <div key={pos} className="border border-warm-700 rounded-xl overflow-hidden">
            <button
              onClick={() => togglePosition(pos)}
              className="w-full flex items-center justify-between px-4 py-3 bg-warm-800 hover:bg-warm-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-warm-100 text-sm w-10 text-left">{pos}</span>
                <span className="text-warm-400 text-xs">{t.ranges.rangeCount(group.length)}</span>
              </div>
              <span className={`text-warm-400 text-lg transition-transform duration-200 inline-block ${isPosOpen ? 'rotate-180' : ''}`}>›</span>
            </button>

            {isPosOpen && (
              <div className="border-t border-warm-700 bg-warm-900/40 p-3 space-y-2">
                {group.map(r => {
                  const mergedPerf = handPerformance[r.id] ?? {}
                  const vals     = Object.values(mergedPerf)
                  const total    = vals.reduce((s, v) => s + v.t, 0)
                  const correct  = vals.reduce((s, v) => s + v.c, 0)
                  const accuracy = total > 0 ? Math.round(correct / total * 100) : null
                  const isOpen   = openRangeId === r.id
                  const stackRanges = r.stackGrids && r.stackGrids.length > 1 ? r.stackGrids.map(sg => sg.stackRange).filter(Boolean) : []
                  const activeStack = isOpen && stackRanges.length > 0 ? selectedStack : ''
                  const heatmapKey = activeStack ? `${r.id}|||${activeStack}` : String(r.id)
                  const perf     = handPerformance[heatmapKey] ?? {}
                  const gridIdx  = activeStack ? r.stackGrids!.findIndex(sg => sg.stackRange === activeStack) : 0
                  const grid     = r.stackGrids && gridIdx >= 0 ? r.stackGrids[gridIdx].grid : (r.stackGrids?.[0]?.grid ?? r.grid)

                  return (
                    <div key={r.id} className="border border-warm-700 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setOpenRangeId(isOpen ? null : r.id)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-warm-800 hover:bg-warm-750 transition-colors text-left"
                      >
                        <span className="font-display uppercase text-warm-100 leading-none" style={{ fontSize:18, letterSpacing:'0.03em' }}>{r.name}</span>
                        <div className="flex items-center gap-3">
                          {accuracy !== null ? (
                            <span className={`font-stat font-black tabular-nums text-base leading-none ${accuracy >= 80 ? 'text-brand-500' : accuracy >= 50 ? 'text-gold' : 'text-result-bad'}`}>
                              {accuracy}%
                            </span>
                          ) : (
                            <span className="text-warm-600 text-xs">{t.stats.noData}</span>
                          )}
                          <span className={`text-warm-400 text-lg transition-transform duration-200 inline-block ${isOpen ? 'rotate-180' : ''}`}>›</span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-warm-700 bg-warm-900/40 p-4">
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
                                {mode === 'heatmap' ? t.matrix.errorMode : t.stats.viewRange}
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
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Histórico do modo Range Check ────────────────────────────────────────── */
function buildScoreColor(s: number): string {
  return s >= 80 ? 'text-brand-500' : s >= 50 ? 'text-gold' : 'text-result-bad'
}

function BuildRoundReplay({ round }: { round: BuildHistoryRound }) {
  const userGrid = decodeSparse(round.userGrid)
  const answerGrid = decodeSparse(round.answerGrid)
  const { perHand } = scoreBuild(answerGrid, userGrid)
  return (
    <div className="mt-2 mb-3 pl-2 border-l-2 border-warm-700/60 space-y-4">
      <RangeActionGrid title={t.exercise.yourRange} subtitle={t.exercise.yourRangeSub} grid={userGrid} maxWidth={600} />
      <RangeActionGrid title={t.exercise.answerKey} subtitle={t.exercise.answerKeySub} grid={answerGrid} maxWidth={600} />
      <DiffGrid perHand={perHand} />
    </div>
  )
}

function BuildHistoryPanel() {
  const buildHistory = useStore(s => s.buildHistory)
  const currentUser   = useStore(s => s.currentUser)
  const authToken     = useStore(s => s.authToken)

  const [openId, setOpenId] = useState<number | null>(null)
  const [openRound, setOpenRound] = useState<string | null>(null)

  const [cloudSessions, setCloudSessions]       = useState<BuildSession[] | null>(null)
  const [cloudRoundCounts, setCloudRoundCounts] = useState<Record<number, number>>({})
  const [cloudError, setCloudError]             = useState(false)
  const [cloudRetry, setCloudRetry]             = useState(0)
  const [hydrated, setHydrated]                 = useState<Record<number, BuildHistoryRound[]>>({})
  const [loadingRounds, setLoadingRounds]       = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!currentUser || !authToken) { setCloudSessions(null); return }
    let cancelled = false
    setCloudError(false)
    fetch('/api/me/stats?view=build-sessions', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const rows = (data.rows ?? []) as Record<string, unknown>[]
        const mapped = rows.map(mapCloudBuildSession)
        const counts: Record<number, number> = {}
        rows.forEach((row, i) => { counts[mapped[i].id] = Number(row.rounds ?? 0) })
        setCloudSessions(mapped)
        setCloudRoundCounts(counts)
      })
      .catch(() => { if (!cancelled) { setCloudError(true); setCloudSessions([]) } })
    return () => { cancelled = true }
  }, [currentUser, authToken, cloudRetry])

  const sessions = currentUser ? (cloudSessions ?? []) : [...buildHistory].reverse()
  const loading  = !!currentUser && cloudSessions === null && !cloudError
  const paged = usePagedList(sessions)

  async function handleOpenSession(s: BuildSession) {
    const isOpen = openId === s.id
    setOpenId(isOpen ? null : s.id)
    if (isOpen || !currentUser || !authToken || !s.sessionUuid || hydrated[s.id]) return
    setLoadingRounds(prev => new Set(prev).add(s.id))
    try {
      const rounds = await fetchBuildSessionRounds(s.sessionUuid, authToken)
      setHydrated(prev => ({ ...prev, [s.id]: rounds }))
    } catch { /* sem replay — a sessão continua mostrando nota/data normalmente */ }
    setLoadingRounds(prev => { const next = new Set(prev); next.delete(s.id); return next })
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label={t.myAccount.loadingCloud}>
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    )
  }

  if (cloudError && sessions.length === 0) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-red-400 text-sm">{t.myAccount.statsLoadError}</p>
        <button
          onClick={() => setCloudRetry(n => n + 1)}
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-warm-600 bg-warm-800 text-warm-200 hover:bg-warm-700 transition-colors"
        >
          {t.common.retry}
        </button>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-warm-400 text-sm">{t.exercise.historyEmpty}</p>
        <p className="text-warm-500 text-xs mt-1">{t.exercise.historyEmptyHint}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {paged.visible.map(s => {
        const isOpen  = openId === s.id
        const rounds  = currentUser ? (hydrated[s.id] ?? []) : s.rounds
        const roundsN = currentUser ? (cloudRoundCounts[s.id] ?? rounds.length) : s.rounds.length
        return (
          <div key={s.id} className="card-surface p-4">
            <button
              onClick={() => { void handleOpenSession(s) }}
              aria-expanded={isOpen}
              className="w-full flex gap-4 items-start text-left"
            >
              <div className={`font-stat font-black tabular-nums text-3xl w-16 text-center flex-shrink-0 leading-none ${buildScoreColor(s.avgScore)}`}>
                {s.avgScore.toFixed(1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs text-warm-400">{formatDate(s.timestamp)}</span>
                  <span className="text-xs text-warm-600">·</span>
                  <span className="text-xs text-warm-400">{t.exercise.roundsCount(roundsN)}</span>
                </div>
                <div className="font-display uppercase text-warm-100 truncate leading-none" style={{ fontSize:18, letterSpacing:'0.03em' }}>
                  {s.rangeNames.join(' · ') || t.stats.noName}
                </div>
              </div>
              <span className={`text-warm-400 text-lg transition-transform duration-200 inline-block flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>›</span>
            </button>
            {isOpen && (
              <div className="mt-3 pt-3 border-t border-warm-700/60 space-y-1.5">
                {loadingRounds.has(s.id) ? (
                  <p className="text-warm-500 text-xs py-2 text-center">{t.common.loading}</p>
                ) : (
                  rounds.map((r, i) => {
                    const roundKey = `${s.id}:${i}`
                    const hasReplay = !!r.userGrid
                    const isRoundOpen = openRound === roundKey
                    const row = (
                      <>
                        <span className="flex items-center gap-2 min-w-0">
                          {hasReplay && (
                            <span className={`text-warm-400 transition-transform duration-200 inline-block flex-shrink-0 ${isRoundOpen ? 'rotate-90' : ''}`}>›</span>
                          )}
                          <span className="text-warm-200 truncate">{r.label}</span>
                          {(r.attempt ?? 1) > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold bg-brand-500/10 border border-brand-500/40 text-brand-400 flex-shrink-0">
                              {t.exercise.attemptN(r.attempt!)}
                            </span>
                          )}
                        </span>
                        <span className={`font-bold tabular-nums flex-shrink-0 ${buildScoreColor(r.score)}`}>
                          {t.exercise.scoreOf(String(r.score))}
                        </span>
                      </>
                    )
                    return (
                      <div key={roundKey}>
                        {hasReplay ? (
                          <button
                            onClick={() => setOpenRound(isRoundOpen ? null : roundKey)}
                            className="w-full flex items-center justify-between gap-2 text-sm text-left hover:brightness-125 transition-all"
                          >
                            {row}
                          </button>
                        ) : (
                          <div className="flex items-center justify-between gap-2 text-sm">{row}</div>
                        )}
                        {isRoundOpen && hasReplay && <BuildRoundReplay round={r} />}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
      <ShowMoreButton remaining={paged.remaining} onClick={paged.showMore} />
    </div>
  )
}

/* ── Página principal ──────────────────────────────────────────────────────── */
export function StatsPage() {
  const trainingHistory = useStore(s => s.trainingHistory)
  const ranges          = useStore(s => s.ranges)
  const currentUser     = useStore(s => s.currentUser)
  const authToken       = useStore(s => s.authToken)

  const [activeTab, setActiveTab]         = useState<'sessions' | 'build' | 'global' | 'cloud' | 'analysis'>('sessions')
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null)

  // Pra quem está logado, a lista vem do servidor (permanente, entre
  // navegadores) em vez do localStorage — o replay de cada sessão é buscado
  // sob demanda em handleViewSession, só quando abre o detalhe.
  const [cloudSessions, setCloudSessions] = useState<TrainingSession[] | null>(null)
  const [cloudError, setCloudError]       = useState(false)
  const [cloudRetry, setCloudRetry]       = useState(0)

  useEffect(() => {
    if (!currentUser || !authToken) { setCloudSessions(null); return }
    let cancelled = false
    setCloudError(false)
    fetch('/api/me/stats?view=sessions', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(data => { if (!cancelled) setCloudSessions(((data.rows ?? []) as Record<string, unknown>[]).map(mapCloudSession)) })
      .catch(() => { if (!cancelled) { setCloudError(true); setCloudSessions([]) } })
    return () => { cancelled = true }
  }, [currentUser, authToken, cloudRetry])

  const sessions = currentUser ? (cloudSessions ?? []) : [...trainingHistory].reverse()
  const sessionsLoading = !!currentUser && cloudSessions === null && !cloudError
  const pagedSessions = usePagedList(sessions)
  const totalHands   = sessions.reduce((s, x) => s + x.hands, 0)
  const totalCorrect = sessions.reduce((s, x) => s + x.correct, 0)
  const globalAccuracy = totalHands > 0 ? Math.round((totalCorrect / totalHands) * 100) : null

  async function handleViewSession(s: TrainingSession) {
    setSelectedSession(s)
    if (!currentUser || !authToken || !s.sessionUuid) return
    try {
      const handLog = await fetchSessionHandLog(s.sessionUuid, authToken)
      const handPerf = computeHandPerf(handLog)
      const rangeIds = deriveRangeIds(s.rangeNames, handLog)
      setSelectedSession(prev => (prev && prev.id === s.id ? { ...prev, handLog, handPerf, rangeIds } : prev))
    } catch { /* mantém sem replay — SessionDetailView já trata esse caso */ }
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div data-tour="stats-header" className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display uppercase text-warm-100 text-[28px] leading-none tracking-wide">{t.stats.title}</h1>
          <p className="text-xs text-warm-400">{t.stats.sessionsCount(sessions.length)}</p>
        </div>
        <PageTutorialButton scope="stats" />
      </div>

      {/* Abas — no mobile rolam (shrink-0), do sm pra cima se distribuem pela
          largura toda (flex-1) sem precisar de barra de rolagem. */}
      <div className="flex border-b border-warm-700 overflow-x-auto sm:overflow-visible">
        {([
          ...(currentUser ? [
            { key: 'cloud' as const, label: t.stats.tabCloud },
            { key: 'analysis' as const, label: t.stats.tabAnalysis },
          ] : []),
          { key: 'sessions' as const, label: t.stats.tabSessions },
          { key: 'build' as const,    label: t.exercise.navLabel },
          { key: 'global' as const,   label: t.stats.tabGlobal },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 sm:flex-1 sm:text-center',
              activeTab === tab.key
                ? 'border-brand-500 text-warm-100'
                : 'border-transparent text-warm-400 hover:text-warm-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo por aba — largura livre só na Análise (precisa das matrizes
          grandes); as demais mantêm a largura de leitura mais estreita. */}
      <div className={activeTab === 'analysis' ? undefined : 'max-w-2xl'}>
        {activeTab === 'cloud' ? (
          <MyAccountStats />
        ) : activeTab === 'analysis' ? (
          <MyCoachPanel />
        ) : activeTab === 'build' ? (
          <div className="space-y-6">
            {currentUser && (
              <div>
                <div className="eyebrow mb-2">{t.myAccount.buildTitle}</div>
                <BuildAccountStats />
              </div>
            )}
            <div>
              {currentUser && <div className="eyebrow mb-2">{t.myAccount.buildReplayTitle}</div>}
              <BuildHistoryPanel />
            </div>
          </div>
        ) : activeTab === 'sessions' ? (
          selectedSession ? (
            <SessionDetailView
              session={selectedSession}
              ranges={ranges}
              onBack={() => setSelectedSession(null)}
            />
          ) : (
            <div className="space-y-6">
              {sessions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: t.stats.statSessions, value: sessions.length.toString(), color: 'text-brand-400' },
                    { label: t.stats.statTotalHands, value: totalHands.toLocaleString(), color: 'text-blue-400' },
                    {
                      label: t.stats.statGlobalAccuracy,
                      value: globalAccuracy !== null ? `${globalAccuracy}%` : '—',
                      color: globalAccuracy === null ? 'text-warm-500'
                           : globalAccuracy >= 70 ? 'text-emerald-400'
                           : globalAccuracy >= 50 ? 'text-yellow-400' : 'text-red-400',
                    },
                  ].map(item => (
                    <div key={item.label} className="card-surface p-5 text-center">
                      <div className="eyebrow mb-1.5">{item.label}</div>
                      <div className={`font-display tabular-nums leading-none ${item.color}`} style={{ fontSize:40, letterSpacing:'0.01em' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              )}
              <AccuracySparkline sessions={[...sessions].reverse()} />
              {sessionsLoading ? (
                <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label={t.myAccount.loadingCloud}>
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : cloudError && sessions.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-red-400 text-sm">{t.myAccount.statsLoadError}</p>
                  <button
                    onClick={() => setCloudRetry(n => n + 1)}
                    className="text-sm font-semibold px-4 py-2 rounded-lg border border-warm-600 bg-warm-800 text-warm-200 hover:bg-warm-700 transition-colors"
                  >
                    {t.common.retry}
                  </button>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-warm-400 text-sm">{t.stats.noSessions}</p>
                  <p className="text-warm-500 text-xs mt-1">{t.stats.completeToSeeHistory}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pagedSessions.visible.map(s => (
                    <SessionCard key={s.id} session={s} onView={() => { void handleViewSession(s) }} />
                  ))}
                  <ShowMoreButton remaining={pagedSessions.remaining} onClick={pagedSessions.showMore} />
                </div>
              )}
            </div>
          )
        ) : (
          <GlobalHistoryPanel />
        )}
      </div>
    </div>
  )
}
