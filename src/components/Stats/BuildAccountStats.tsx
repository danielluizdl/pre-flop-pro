import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { Skeleton } from '../ui/Skeleton'
import { captureError } from '../../utils/sentry'
import { t, dateLocale } from '../../i18n'

interface BuildOverview {
  rounds: number
  avgScore: number
  bestScore: number
  ranges: number
  sessions: number
  durationSeconds: number
  lastActivity: number
}

interface BuildRangeRow {
  rangeId: number
  rangeName: string
  attempts: number
  avgScore: number
  bestScore: number
  lastActivity: number
}

interface BuildSessionRow {
  sessionUuid: string
  rounds: number
  avgScore: number
  startedAt: number
  durationSeconds: number | null
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

function formatDate(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString(dateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function scoreColor(s: number): string {
  return s >= 80 ? 'text-emerald-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400'
}

export function BuildAccountStats({ hideByRangeTable = false }: { hideByRangeTable?: boolean } = {}) {
  const authToken = useStore(s => s.authToken)
  const [overview, setOverview] = useState<BuildOverview | null>(null)
  const [rangeRows, setRangeRows] = useState<BuildRangeRow[]>([])
  const [sessionRows, setSessionRows] = useState<BuildSessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!authToken) return
    let cancelled = false
    setLoading(true)
    setError('')
    const headers = { Authorization: `Bearer ${authToken}` }
    Promise.all([
      fetch('/api/me/stats?view=build-overview', { headers }).then(r => r.json()),
      fetch('/api/me/stats?view=build-by-range', { headers }).then(r => r.json()),
      fetch('/api/me/stats?view=build-sessions', { headers }).then(r => r.json()),
    ])
      .then(([o, r, s]) => {
        if (cancelled) return
        setOverview(o.overview ?? null)
        setRangeRows(r.rows ?? [])
        setSessionRows(s.rows ?? [])
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        captureError(e, { area: 'me-build-stats' })
        setError(t.myAccount.statsLoadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [authToken, retry])

  if (!authToken) return null

  if (loading) return (
    <div className="space-y-4 max-w-2xl" role="status" aria-busy="true" aria-label={t.myAccount.loadingCloud}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card-surface p-4 flex flex-col items-center gap-2">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  )
  if (error) return (
    <div className="py-6 text-center space-y-3">
      <p className="text-red-400 text-sm">{error}</p>
      <button
        onClick={() => setRetry(n => n + 1)}
        className="text-sm font-semibold px-4 py-2 rounded-lg border border-warm-600 bg-warm-800 text-warm-200 hover:bg-warm-700 transition-colors"
      >
        {t.common.retry}
      </button>
    </div>
  )
  if (!overview) return null
  if (overview.rounds === 0) return (
    <p className="text-warm-500 text-sm">{t.myAccount.buildNoData}</p>
  )

  const cards = [
    { label: t.myAccount.buildCardRounds, value: overview.rounds.toLocaleString(), color: 'text-warm-100' },
    { label: t.myAccount.buildCardAvg, value: `${overview.avgScore}`, color: scoreColor(overview.avgScore) },
    { label: t.myAccount.buildCardBest, value: `${overview.bestScore}`, color: 'text-brand-400' },
    { label: t.myAccount.cardSessions, value: String(overview.sessions), color: 'text-warm-300' },
    { label: t.myAccount.cardTimeTrained, value: formatDuration(overview.durationSeconds), color: 'text-blue-400' },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className="card-surface p-4 text-center">
            <div className="eyebrow mb-1">{c.label}</div>
            <div className={`font-display tabular-nums leading-none ${c.color}`} style={{ fontSize: 26, letterSpacing: '0.01em' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {!hideByRangeTable && (
        <div>
          <div className="eyebrow mb-2">{t.myAccount.buildByRange}</div>
          {rangeRows.length === 0 ? (
            <p className="text-warm-500 text-sm">{t.myAccount.noDataYet}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-warm-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
                    <th className="text-left font-semibold px-3 py-2">{t.myAccount.colRange}</th>
                    <th className="text-right font-semibold px-3 py-2">{t.myAccount.colAttempts}</th>
                    <th className="text-right font-semibold px-3 py-2">{t.myAccount.colAvgScore}</th>
                    <th className="text-right font-semibold px-3 py-2">{t.myAccount.colBestScore}</th>
                    <th className="text-right font-semibold px-3 py-2">{t.myAccount.colLast}</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeRows.map(r => (
                    <tr key={r.rangeId} className="border-t border-warm-700/60">
                      <td className="px-3 py-2 text-warm-100 font-semibold">{r.rangeName}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-warm-300">{r.attempts}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-bold ${scoreColor(r.avgScore)}`}>{r.avgScore}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-brand-400">{r.bestScore}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-warm-500">{formatDate(r.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="eyebrow mb-2">{t.myAccount.buildRecentSessions}</div>
        {sessionRows.length === 0 ? (
          <p className="text-warm-500 text-sm">{t.myAccount.noDataYet}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-warm-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
                  <th className="text-left font-semibold px-3 py-2">{t.myAccount.colDate}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colRounds}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colAvgScore}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colDuration}</th>
                </tr>
              </thead>
              <tbody>
                {sessionRows.map(s => (
                  <tr key={s.sessionUuid} className="border-t border-warm-700/60">
                    <td className="px-3 py-2 text-warm-100 font-semibold">{formatDate(s.startedAt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-300">{s.rounds}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${scoreColor(s.avgScore)}`}>{s.avgScore}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-500">{s.durationSeconds != null ? formatDuration(s.durationSeconds) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
