import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { Skeleton } from '../ui/Skeleton'
import { BuildAccountStats } from './BuildAccountStats'
import { captureError } from '../../utils/sentry'
import { t, dateLocale } from '../../i18n'
import type { DeviceSession } from '../../types'

interface Overview {
  hands: number
  correct: number
  errors: number
  accuracy: number
  graves: number
  imprecisos: number
  consults: number
  sessions: number
  durationSeconds: number
}

interface RangeRow {
  rangeId: number
  rangeName: string
  hands: number
  correct: number
  graves: number
  consults: number
  lastTrained: number
  accuracy: number
}

interface HandRow {
  hand: string
  total: number
  correct: number
  accuracy: number
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

function formatDateTime(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString(dateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function DevicesSection() {
  const listDevices = useStore(s => s.listDevices)
  const revokeDevice = useStore(s => s.revokeDevice)
  const revokeOtherDevices = useStore(s => s.revokeOtherDevices)
  const [devices, setDevices] = useState<DeviceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const res = await listDevices()
    if (res.ok) { setDevices(res.devices ?? []); setError(false) }
    else setError(true)
    setLoading(false)
  }, [listDevices])

  useEffect(() => { void reload() }, [reload])

  const handleRevoke = async (id: number) => {
    setBusy(true)
    await revokeDevice(id)
    await reload()
    setBusy(false)
  }

  const handleRevokeOthers = async () => {
    setBusy(true)
    await revokeOtherDevices()
    await reload()
    setBusy(false)
  }

  const others = devices.filter(d => !d.current).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="eyebrow">{t.myAccount.activeSessions}</div>
        {others > 0 && (
          <button
            onClick={handleRevokeOthers}
            disabled={busy}
            className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {t.myAccount.endOthers(others)}
          </button>
        )}
      </div>
      {loading ? (
        <p className="text-warm-500 text-sm">{t.myAccount.loadingSessions}</p>
      ) : error ? (
        <p className="text-red-400 text-sm">
          {t.myAccount.sessionsLoadError}{' '}
          <button onClick={() => { setLoading(true); void reload() }} className="underline font-semibold hover:text-red-300">{t.common.retry}</button>
        </p>
      ) : devices.length === 0 ? (
        <p className="text-warm-500 text-sm">{t.myAccount.noActiveSessions}</p>
      ) : (
        <ul className="rounded-xl border border-warm-700 divide-y divide-warm-700/60">
          {devices.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm text-warm-100 font-semibold flex items-center gap-2">
                  {t.myAccount.session(d.id)}
                  {d.current && <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">{t.myAccount.thisSession}</span>}
                </div>
                <div className="text-xs text-warm-500">{t.myAccount.startedExpires(formatDateTime(d.createdAt), formatDate(d.expiresAt))}</div>
              </div>
              {!d.current && (
                <button
                  onClick={() => handleRevoke(d.id)}
                  disabled={busy}
                  className="shrink-0 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {t.myAccount.end}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function accColor(acc: number): string {
  return acc >= 80 ? 'text-emerald-400' : acc >= 50 ? 'text-yellow-400' : 'text-red-400'
}

export function MyAccountStats() {
  const authToken = useStore(s => s.authToken)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [rangeRows, setRangeRows] = useState<RangeRow[]>([])
  const [handRows, setHandRows] = useState<HandRow[]>([])
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
      fetch('/api/me/stats?view=overview', { headers }).then(r => r.json()),
      fetch('/api/me/stats?view=by-range', { headers }).then(r => r.json()),
      fetch('/api/me/stats?view=by-hand', { headers }).then(r => r.json()),
    ])
      .then(([o, r, h]) => {
        if (cancelled) return
        setOverview(o.overview ?? null)
        setRangeRows(r.rows ?? [])
        setHandRows(h.rows ?? [])
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        captureError(e, { area: 'me-stats' })
        setError(t.myAccount.statsLoadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [authToken, retry])

  if (loading) return (
    <div className="space-y-6 max-w-2xl" role="status" aria-busy="true" aria-label={t.myAccount.loadingCloud}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="card-surface p-4 flex flex-col items-center gap-2">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
  if (error) return (
    <div className="py-8 text-center space-y-3">
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

  const cards = [
    { label: t.myAccount.cardHands, value: overview.hands.toLocaleString(), color: 'text-warm-100' },
    { label: t.myAccount.cardAccuracy, value: `${overview.accuracy}%`, color: accColor(overview.accuracy) },
    { label: t.myAccount.cardBlunders, value: String(overview.graves), color: 'text-red-400' },
    { label: t.myAccount.cardImprecise, value: String(overview.imprecisos), color: 'text-yellow-400' },
    { label: t.myAccount.cardConsults, value: String(overview.consults), color: 'text-warm-300' },
    { label: t.myAccount.cardSessions, value: String(overview.sessions), color: 'text-brand-400' },
    { label: t.myAccount.cardTimeTrained, value: formatDuration(overview.durationSeconds), color: 'text-blue-400' },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="card-surface p-4 text-center">
            <div className="eyebrow mb-1">{c.label}</div>
            <div className={`font-display tabular-nums leading-none ${c.color}`} style={{ fontSize: 26, letterSpacing: '0.01em' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="eyebrow mb-2">{t.myAccount.byRange}</div>
        {rangeRows.length === 0 ? (
          <p className="text-warm-500 text-sm">{t.myAccount.noDataYet}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-warm-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
                  <th className="text-left font-semibold px-3 py-2">{t.myAccount.colRange}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colHands}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colAccuracy}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colBlunder}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colConsults}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colLast}</th>
                </tr>
              </thead>
              <tbody>
                {rangeRows.map(r => (
                  <tr key={r.rangeId} className="border-t border-warm-700/60">
                    <td className="px-3 py-2 text-warm-100 font-semibold">{r.rangeName}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-300">{r.hands}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${accColor(r.accuracy)}`}>{r.accuracy}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-400">{r.graves}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-400">{r.consults}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-500">{formatDate(r.lastTrained)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="eyebrow mb-2">{t.myAccount.worstHands}</div>
        {handRows.length === 0 ? (
          <p className="text-warm-500 text-sm">{t.myAccount.noHands3}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-warm-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
                  <th className="text-left font-semibold px-3 py-2">{t.myAccount.colHand}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colAttempts}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colCorrect}</th>
                  <th className="text-right font-semibold px-3 py-2">{t.myAccount.colAccuracy}</th>
                </tr>
              </thead>
              <tbody>
                {handRows.map(h => (
                  <tr key={h.hand} className="border-t border-warm-700/60">
                    <td className="px-3 py-2 text-warm-100 font-bold">{h.hand}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-300">{h.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-300">{h.correct}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${accColor(h.accuracy)}`}>{h.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="eyebrow mb-2">{t.myAccount.buildTitle}</div>
        <BuildAccountStats />
      </div>

      <DevicesSection />
    </div>
  )
}
