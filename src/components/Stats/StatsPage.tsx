import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import type { Range, TrainingSession } from '../../types'
import { HandMatrix } from '../RangeBuilder/HandMatrix'
import { MyAccountStats } from './MyAccountStats'

const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'EP', 'LJ', 'UTG']

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/* ── Detalhe de sessão ─────────────────────────────────────────────────────── */
function SessionDetailView({ session, ranges, onBack }: {
  session: TrainingSession
  ranges: Range[]
  onBack: () => void
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
    <div className="space-y-4 max-w-2xl">

      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-warm-400 hover:text-white text-sm font-semibold transition-colors mb-1"
          >
            ← Voltar
          </button>
          <h2 className="text-xl font-extrabold text-white">{formatDate(session.timestamp)}</h2>
          <p className="text-warm-400 text-xs">{session.tableSize}-max · {formatDuration(session.durationSeconds)} · {session.rangeNames.join(', ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-warm-700/30 rounded-2xl overflow-hidden">
        {[
          { label:'Mãos',    value: String(session.hands),    color:'text-warm-100' },
          { label:'Acertos', value: String(session.correct),  color:'text-result-good' },
          { label:'Erros',   value: String(session.errors),   color:'text-result-bad' },
          { label:'Precisão',value: acc !== null ? `${acc}%` : '—',
            color: acc === null ? 'text-warm-500' : acc >= 80 ? 'text-brand-500' : acc >= 50 ? 'text-gold' : 'text-result-bad' },
        ].map(item => (
          <div key={item.label} className="bg-warm-900 p-4 text-center">
            <div className="eyebrow mb-1">{item.label}</div>
            <div className={`font-display tabular-nums leading-none ${item.color}`} style={{ fontSize:36, letterSpacing:'0.01em' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {sessionRanges.length === 0 ? (
        <p className="text-warm-500 text-sm text-center py-4">Ranges desta sessão não encontrados.</p>
      ) : (
        <div className="space-y-2">
          {sessionRanges.map(r => {
            const mergedPerf = sessionPerf?.[String(r.id)] ?? sessionPerf?.[r.name] ?? {}
            const vals     = Object.values(mergedPerf)
            const total    = vals.reduce((s, v) => s + v.t, 0)
            const correct  = vals.reduce((s, v) => s + v.c, 0)
            const accuracy = total > 0 ? Math.round(correct / total * 100) : null
            const isOpen   = openRangeId === r.id
            const stackRanges = r.stackGrids && r.stackGrids.length > 1 ? r.stackGrids.map(sg => sg.stackRange).filter(Boolean) : []
            const activeStack = isOpen && stackRanges.length > 0 ? selectedStack : ''
            const perf     = (activeStack
              ? (sessionPerf?.[`${r.id}|||${activeStack}`] ?? sessionPerf?.[`${r.name}|||${activeStack}`])
              : (sessionPerf?.[String(r.id)] ?? sessionPerf?.[r.name])) ?? {}
            const gridIdx  = activeStack ? r.stackGrids!.findIndex(sg => sg.stackRange === activeStack) : 0
            const grid     = r.stackGrids && gridIdx >= 0 ? r.stackGrids[gridIdx].grid : (r.stackGrids?.[0]?.grid ?? r.grid)

            return (
              <div key={r.id} className="border border-warm-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenRangeId(isOpen ? null : r.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-warm-800 hover:bg-warm-750 transition-colors text-left"
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
                    <span className={`text-warm-400 text-lg transition-transform duration-200 inline-block ${isOpen ? 'rotate-180' : ''}`}>›</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-warm-700 bg-warm-900/40 p-4">
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

/* ── Sparkline de evolução da precisão ─────────────────────────────────────── */
function AccuracySparkline({ sessions }: { sessions: TrainingSession[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const pts = sessions
    .filter(s => s.hands > 0)
    .map(s => ({ acc: Math.round(s.correct / s.hands * 100), ts: s.timestamp }))
  if (pts.length < 2) return null

  const W = 600, H = 120, padX = 10, padY = 12
  const n = pts.length
  const xOf = (i: number) => padX + (i / (n - 1)) * (W - 2 * padX)
  const yOf = (acc: number) => padY + (1 - acc / 100) * (H - 2 * padY)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(p.acc).toFixed(1)}`).join(' ')
  const ref80 = yOf(80)

  return (
    <div className="card-surface p-4">
      <div className="eyebrow mb-2">Evolução da precisão</div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
          <line x1={padX} y1={ref80} x2={W - padX} y2={ref80} stroke="#5a5247" strokeWidth="1" strokeDasharray="5 5" />
          <text x={W - padX} y={ref80 - 4} textAnchor="end" fontSize="9" fill="#8a857a">80%</text>
          <path d={path} fill="none" stroke="#d97757" strokeWidth="2" />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={xOf(i)} cy={yOf(p.acc)} r={hover === i ? 5 : 3}
              fill={p.acc >= 80 ? '#34d399' : p.acc >= 50 ? '#facc15' : '#f87171'}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="absolute bg-warm-950 border border-warm-600 rounded-lg px-2 py-1 text-xs text-white pointer-events-none whitespace-nowrap z-10"
            style={{ left: `${(xOf(hover) / W) * 100}%`, top: `${(yOf(pts[hover].acc) / H) * 100}%`, transform: 'translate(-50%, -130%)' }}
          >
            <div className="font-bold tabular-nums">{pts[hover].acc}%</div>
            <div className="text-warm-400">{formatDate(pts[hover].ts)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Card de sessão ────────────────────────────────────────────────────────── */
function SessionCard({ session, onView }: { session: TrainingSession; onView: () => void }) {
  const accuracy = session.hands > 0 ? Math.round((session.correct / session.hands) * 100) : 0
  const color = accuracy >= 80 ? 'text-brand-500' : accuracy >= 50 ? 'text-gold' : 'text-result-bad'

  return (
    <div className="card-surface p-4 flex gap-4 items-start">
      <div className={`font-stat font-black tabular-nums text-3xl w-14 text-center flex-shrink-0 leading-none ${color}`}>
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
          {session.rangeNames.join(' · ') || 'Sem nome'}
        </div>
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="text-warm-300">Mãos: <strong className="text-white">{session.hands}</strong></span>
          <span className="text-emerald-400">Acertos: <strong>{session.correct}</strong></span>
          <span className="text-red-400">Erros: <strong>{session.errors}</strong></span>
          {session.consults > 0 && (
            <span className="text-warm-500">Consultas: <strong>{session.consults}</strong></span>
          )}
        </div>
      </div>
      <button
        onClick={onView}
        title="Ver detalhes"
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-warm-600 bg-warm-900/60 text-warm-400 hover:text-white hover:border-warm-400 transition-colors"
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
        <p className="text-warm-400 text-sm">Nenhum dado de treino ainda.</p>
        <p className="text-warm-500 text-xs mt-1">Complete um treino para ver o desempenho aqui.</p>
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
                <span className="font-extrabold text-white text-sm w-10 text-left">{pos}</span>
                <span className="text-warm-400 text-xs">{group.length} range{group.length !== 1 ? 's' : ''}</span>
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
                            <span className="text-warm-600 text-xs">sem dados</span>
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

/* ── Página principal ──────────────────────────────────────────────────────── */
export function StatsPage() {
  const trainingHistory = useStore(s => s.trainingHistory)
  const ranges          = useStore(s => s.ranges)
  const currentUser     = useStore(s => s.currentUser)

  const [activeTab, setActiveTab]         = useState<'sessions' | 'global' | 'cloud'>('sessions')
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null)

  const sessions = [...trainingHistory].reverse()
  const totalHands   = trainingHistory.reduce((s, x) => s + x.hands, 0)
  const totalCorrect = trainingHistory.reduce((s, x) => s + x.correct, 0)
  const globalAccuracy = totalHands > 0 ? Math.round((totalCorrect / totalHands) * 100) : null

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display uppercase text-warm-100 text-[28px] leading-none tracking-wide">Histórico de Treinos</h1>
        <p className="text-xs text-warm-400">{sessions.length} sessão(ões) registrada(s)</p>
      </div>

      {/* Abas */}
      <div className="flex border-b border-warm-700">
        {([
          ...(currentUser ? [{ key: 'cloud' as const, label: 'Meus dados na nuvem' }] : []),
          { key: 'sessions' as const, label: 'Histórico de Sessões' },
          { key: 'global' as const,   label: 'Desempenho Global'   },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-brand-500 text-white'
                : 'border-transparent text-warm-400 hover:text-warm-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo por aba */}
      {activeTab === 'cloud' ? (
        <MyAccountStats />
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
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Sessões', value: sessions.length.toString(), color: 'text-brand-400' },
                  { label: 'Mãos Totais', value: totalHands.toLocaleString(), color: 'text-blue-400' },
                  {
                    label: 'Precisão Global',
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
            <AccuracySparkline sessions={trainingHistory} />
            {sessions.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-warm-400 text-sm">Nenhuma sessão registrada ainda.</p>
                <p className="text-warm-500 text-xs mt-1">Complete um treino para ver o histórico aqui.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sessions.map(s => (
                  <SessionCard key={s.id} session={s} onView={() => setSelectedSession(s)} />
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        <GlobalHistoryPanel />
      )}
    </div>
  )
}
