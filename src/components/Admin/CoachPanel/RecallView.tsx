import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../../store/useStore'
import { t } from '../../../i18n'
import {
  groupRangesByPosition, MultiPlayerSelect, RangeSelect, type CoachUser,
  formatDate, formatDateShort, accColor,
  type Filters, PeriodFilter, useAnalytics,
  Section, TH, THR, TD, TDR,
} from './shared'

interface RecallOverviewRow {
  userId: number; username: string; name: string
  attempts: number; avgScore: number; bestScore: number; ranges: number; lastActivity: number
}
interface RecallByRangeRow {
  rangeId: number; rangeName: string
  attempts: number; avgScore: number; bestScore: number; players: number; lastActivity: number
}
interface RecallEventRow {
  userId: number; playerName: string; rangeId: number; rangeName: string
  stackRange: string | null; score: number; attempt: number; createdAt: number
}

export function RecallView({ token }: { token: string | null }) {
  const ranges = useStore(s => s.ranges)
  const [users, setUsers] = useState<CoachUser[]>([])
  const [filters, setFilters] = useState<Filters>({ playerIds: [], rangeId: null, days: null, from: null, to: null })

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setUsers(d.users ?? []))
      .catch(() => {})
  }, [token])

  const sortedUsers = [...users].sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username))
  const rangeGroups = useMemo(() => groupRangesByPosition(ranges), [ranges])

  const overview = useAnalytics<RecallOverviewRow>('build-overview', filters, token)
  const byRange = useAnalytics<RecallByRangeRow>('build-by-range', filters, token)
  const events = useAnalytics<RecallEventRow>('build-events', filters, token)

  const overviewRows = useMemo(
    () => overview.rows.filter(r => r.attempts > 0).sort((a, b) => b.attempts - a.attempts),
    [overview.rows],
  )
  const team = overview.team

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <MultiPlayerSelect
          users={sortedUsers}
          selected={filters.playerIds}
          onChange={ids => setFilters(f => ({ ...f, playerIds: ids }))}
        />
        <RangeSelect
          groups={rangeGroups}
          value={filters.rangeId}
          onChange={id => setFilters(f => ({ ...f, rangeId: id }))}
        />
        <PeriodFilter
          days={filters.days}
          from={filters.from}
          to={filters.to}
          onChange={d => setFilters(f => ({ ...f, ...d }))}
        />
      </div>

      <Section title={t.coach.recallByPlayer} loading={overview.loading} error={overview.error} empty={overviewRows.length === 0} onRetry={overview.reload}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              <th className={TH}>{t.coach.colPlayer}</th>
              <th className={THR}>{t.coach.recallColAttempts}</th>
              <th className={THR}>{t.coach.recallColAvg}</th>
              <th className={THR}>{t.coach.recallColBest}</th>
              <th className={THR}>{t.coach.colRanges}</th>
              <th className={THR}>{t.coach.colLastActivity}</th>
            </tr>
          </thead>
          <tbody>
            {team && (team.attempts ?? 0) > 0 && (
              <tr className="border-t border-warm-700/60 bg-warm-800/40">
                <td className={`${TD} text-brand-300 font-bold`}>{t.coach.colTeam}</td>
                <td className={`${TDR} text-warm-200 font-semibold`}>{team.attempts}</td>
                <td className={`${TDR} font-bold ${accColor(team.avgScore)}`}>{team.avgScore}</td>
                <td className={`${TDR} text-warm-300`}>{team.bestScore}</td>
                <td className={`${TDR} text-warm-400`}>{team.ranges}</td>
                <td className={`${TDR} text-warm-500`}>{formatDateShort(team.lastActivity)}</td>
              </tr>
            )}
            {overviewRows.map(r => (
              <tr key={r.userId} className="border-t border-warm-700/60">
                <td className={`${TD} text-warm-100 font-semibold`}>{r.name || r.username}</td>
                <td className={`${TDR} text-warm-300`}>{r.attempts}</td>
                <td className={`${TDR} font-bold ${accColor(r.avgScore)}`}>{r.avgScore}</td>
                <td className={`${TDR} text-warm-300`}>{r.bestScore}</td>
                <td className={`${TDR} text-warm-400`}>{r.ranges}</td>
                <td className={`${TDR} text-warm-500`}>{formatDateShort(r.lastActivity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t.coach.sectionByRange} loading={byRange.loading} error={byRange.error} empty={byRange.rows.length === 0} onRetry={byRange.reload}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              <th className={TH}>{t.coach.colRange}</th>
              <th className={THR}>{t.coach.recallColAttempts}</th>
              <th className={THR}>{t.coach.recallColAvg}</th>
              <th className={THR}>{t.coach.recallColBest}</th>
              <th className={THR}>{t.coach.colPlayers}</th>
              <th className={THR}>{t.coach.colLastActivity}</th>
            </tr>
          </thead>
          <tbody>
            {byRange.rows.map(r => (
              <tr key={r.rangeId} className="border-t border-warm-700/60">
                <td className={`${TD} text-warm-100 font-semibold whitespace-nowrap`}>{r.rangeName}</td>
                <td className={`${TDR} text-warm-300`}>{r.attempts}</td>
                <td className={`${TDR} font-bold ${accColor(r.avgScore)}`}>{r.avgScore}</td>
                <td className={`${TDR} text-warm-300`}>{r.bestScore}</td>
                <td className={`${TDR} text-warm-400`}>{r.players}</td>
                <td className={`${TDR} text-warm-500`}>{formatDateShort(r.lastActivity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t.coach.recallSectionAttempts} loading={events.loading} error={events.error} empty={events.rows.length === 0} onRetry={events.reload}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              <th className={TH}>{t.coach.colPlayer}</th>
              <th className={TH}>{t.coach.colRange}</th>
              <th className={TH}>{t.coach.recallColStack}</th>
              <th className={THR}>{t.coach.recallColAttempt}</th>
              <th className={THR}>{t.coach.recallColScore}</th>
              <th className={THR}>{t.coach.colDate}</th>
            </tr>
          </thead>
          <tbody>
            {events.rows.map((r, i) => (
              <tr key={i} className="border-t border-warm-700/60">
                <td className={`${TD} text-warm-100 font-semibold`}>{r.playerName}</td>
                <td className={`${TD} text-warm-300 whitespace-nowrap`}>{r.rangeName}</td>
                <td className={`${TD} text-warm-400`}>{r.stackRange ?? '—'}</td>
                <td className={`${TDR} text-warm-400`}>{r.attempt}</td>
                <td className={`${TDR} font-bold ${accColor(r.score)}`}>{r.score}</td>
                <td className={`${TDR} text-warm-500`}>{formatDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  )
}

export function PublishTeamRanges() {
  const publishTeamRanges = useStore(s => s.publishTeamRanges)
  const rangeCount = useStore(s => s.ranges.length)
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function handlePublish() {
    if (publishing) return
    if (!confirm(t.coach.publishConfirm(rangeCount))) return
    setPublishing(true)
    setMsg(null)
    const res = await publishTeamRanges()
    setPublishing(false)
    setMsg(res.ok
      ? { ok: true, text: t.coach.published(res.count, res.version) }
      : { ok: false, text: res.error ?? t.coach.publishFailed })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handlePublish}
        disabled={publishing}
        className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
      >
        {publishing ? t.coach.publishing : t.coach.publishTeamButton}
      </button>
      {msg && <span className={msg.ok ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>{msg.text}</span>}
    </div>
  )
}
