import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import type { Range, TrainingSession } from '../../types'
import { HandMatrix } from '../RangeBuilder/HandMatrix'

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

  useEffect(() => { setViewMode('heatmap') }, [openRangeId])

  const sessionRanges = session.rangeNames
    .map(name => ranges.find(r => r.name === name))
    .filter((r): r is Range => r !== undefined)

  const acc = session.hands > 0 ? Math.round(session.correct / session.hands * 100) : null
  const sessionPerf = session.handPerf ?? null

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-semibold transition-colors mb-1"
          >
            ← Voltar
          </button>
          <h2 className="text-xl font-extrabold text-white">{formatDate(session.timestamp)}</h2>
          <p className="text-gray-400 text-xs">{session.tableSize}-max · {formatDuration(session.durationSeconds)} · {session.rangeNames.join(', ')}</p>
        </div>
      </div>

      {/* Stats box */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-2xl font-extrabold text-white">{session.hands}</div>
            <div className="text-xs text-gray-400">Mãos</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-emerald-400">{session.correct}</div>
            <div className="text-xs text-gray-400">Acertos</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-red-400">{session.errors}</div>
            <div className="text-xs text-gray-400">Erros</div>
          </div>
          <div>
            <div className={`text-2xl font-extrabold ${acc !== null ? (acc >= 80 ? 'text-emerald-400' : acc >= 50 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-600'}`}>
              {acc !== null ? `${acc}%` : '—'}
            </div>
            <div className="text-xs text-gray-400">Precisão</div>
          </div>
        </div>
      </div>

      {/* Ranges */}
      {sessionRanges.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">Ranges desta sessão não encontrados.</p>
      ) : (
        <div className="space-y-2">
          {sessionRanges.map(r => {
            const perf     = sessionPerf?.[r.name] ?? {}
            const vals     = Object.values(perf)
            const total    = vals.reduce((s, v) => s + v.t, 0)
            const correct  = vals.reduce((s, v) => s + v.c, 0)
            const accuracy = total > 0 ? Math.round(correct / total * 100) : null
            const isOpen   = openRangeId === r.id

            return (
              <div key={r.id} className="border border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenRangeId(isOpen ? null : r.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-sm">{r.name}</span>
                    {r.positions.length > 0 && (
                      <span className="text-gray-400 text-xs">{r.positions.join(', ')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {accuracy !== null ? (
                      <span className={`text-sm font-bold ${accuracy >= 80 ? 'text-emerald-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {accuracy}%
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">sem dados</span>
                    )}
                    <span className={`text-gray-400 text-lg transition-transform duration-200 inline-block ${isOpen ? 'rotate-180' : ''}`}>›</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-700 bg-gray-900/40 p-4">
                    {sessionPerf === null ? (
                      <p className="text-gray-500 text-xs text-center py-4">Dados por mão não disponíveis para sessões anteriores.</p>
                    ) : (
                      <>
                        <div className="flex justify-end gap-1.5 mb-3">
                          {(['heatmap', 'actions'] as const).map(mode => (
                            <button
                              key={mode}
                              onClick={() => setViewMode(mode)}
                              className={`px-2 py-0.5 text-xs border rounded-lg transition-colors ${viewMode === mode ? 'border-brand-500 bg-brand-900/30 text-brand-300' : 'border-gray-600 bg-gray-900/80 text-gray-300 hover:bg-gray-700'}`}
                            >
                              {mode === 'heatmap' ? 'Erro / Acerto' : 'Ver Range'}
                            </button>
                          ))}
                        </div>
                        <HandMatrix
                          readOnly
                          grid={r.stackGrids?.[0]?.grid ?? r.grid}
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

/* ── Card de sessão ────────────────────────────────────────────────────────── */
function SessionCard({ session, onView }: { session: TrainingSession; onView: () => void }) {
  const accuracy = session.hands > 0 ? Math.round((session.correct / session.hands) * 100) : 0
  const color = accuracy >= 70 ? 'text-emerald-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex gap-4 items-start">
      <div className={`text-3xl font-extrabold w-14 text-center flex-shrink-0 ${color}`}>
        {accuracy}%
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs text-gray-400">{formatDate(session.timestamp)}</span>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs text-gray-400">{session.tableSize}-max</span>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs text-gray-400">{formatDuration(session.durationSeconds)}</span>
        </div>
        <div className="text-sm font-semibold text-white truncate mb-2">
          {session.rangeNames.join(', ') || 'Sem nome'}
        </div>
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="text-gray-300">Mãos: <strong className="text-white">{session.hands}</strong></span>
          <span className="text-emerald-400">Acertos: <strong>{session.correct}</strong></span>
          <span className="text-red-400">Erros: <strong>{session.errors}</strong></span>
          {session.consults > 0 && (
            <span className="text-gray-500">Consultas: <strong>{session.consults}</strong></span>
          )}
        </div>
      </div>
      <button
        onClick={onView}
        title="Ver detalhes"
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-600 bg-gray-900/60 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </div>
  )
}

/* ── Página principal ──────────────────────────────────────────────────────── */
export function StatsPage() {
  const trainingHistory = useStore(s => s.trainingHistory)
  const ranges          = useStore(s => s.ranges)

  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null)

  const sessions = [...trainingHistory].reverse()

  const totalHands   = trainingHistory.reduce((s, x) => s + x.hands, 0)
  const totalCorrect = trainingHistory.reduce((s, x) => s + x.correct, 0)
  const globalAccuracy = totalHands > 0 ? Math.round((totalCorrect / totalHands) * 100) : null

  if (selectedSession) {
    return (
      <SessionDetailView
        session={selectedSession}
        ranges={ranges}
        onBack={() => setSelectedSession(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Histórico de Treinos</h1>
        <p className="text-xs text-gray-400">{sessions.length} sessão(ões) registrada(s)</p>
      </div>

      {sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Sessões', value: sessions.length.toString(), color: 'text-brand-400' },
            { label: 'Mãos Totais', value: totalHands.toLocaleString(), color: 'text-blue-400' },
            {
              label: 'Precisão Global',
              value: globalAccuracy !== null ? `${globalAccuracy}%` : '—',
              color: globalAccuracy === null ? 'text-gray-500'
                   : globalAccuracy >= 70 ? 'text-emerald-400'
                   : globalAccuracy >= 50 ? 'text-yellow-400' : 'text-red-400',
            },
          ].map(item => (
            <div key={item.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">Nenhuma sessão registrada ainda.</p>
          <p className="text-gray-500 text-xs mt-1">Complete um treino para ver o histórico aqui.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {sessions.map(s => (
            <SessionCard key={s.id} session={s} onView={() => setSelectedSession(s)} />
          ))}
        </div>
      )}
    </div>
  )
}
