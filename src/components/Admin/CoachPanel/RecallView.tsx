import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../../../store/useStore'
import { t } from '../../../i18n'
import { RangeHeatGrid } from '../RangeHeatGrid'
import { RangeActionGrid, type ActionFreq } from '../RangeActionGrid'
import { rangeComboStats } from '../../../utils/rangeCombos'
import {
  groupRangesByPosition, MultiPlayerSelect, RangeSelect, type CoachUser,
  formatDate, formatDateShort, accColor, computePlayedGrid,
  type Filters, PeriodFilter, useAnalytics, useBuildRangeGrid,
  Section, TH, THR, TD, TDR,
} from './shared'
import { ComboSummary, TopHandsPanel, HandDetailCard } from './TeamView'

interface RecallOverviewRow {
  userId: number; username: string; name: string
  attempts: number; avgScore: number; bestScore: number; ranges: number; lastActivity: number
}
interface RecallByRangeRow {
  rangeId: number; rangeName: string
  attempts: number; avgScore: number; bestScore: number; players: number; lastActivity: number
  correctHands?: number; wrongHands?: number
}
interface RecallEventRow {
  userId: number; playerName: string; rangeId: number; rangeName: string
  stackRange: string | null; score: number; attempt: number; createdAt: number
}

export function RecallView({ token }: { token: string | null }) {
  const ranges = useStore(s => s.ranges)
  const [users, setUsers] = useState<CoachUser[]>([])
  const [filters, setFilters] = useState<Filters>({ playerIds: [], rangeId: null, days: null, from: null, to: null })
  const [stackIdx, setStackIdx] = useState<number | null>(null)
  const [detailHand, setDetailHand] = useState<string | null>(null)

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

  const selectedRange = ranges.find(r => r.id === filters.rangeId)
  const selectedRangeName = selectedRange?.name ?? ''
  const selectedStackGrids = selectedRange?.stackGrids ?? []
  // stack_range salvo no evento é a label (ex. "250bb"), não o índice.
  const stackRangeParam = stackIdx !== null ? (selectedStackGrids[stackIdx]?.stackRange ?? '') : null

  const grid = useBuildRangeGrid(filters.rangeId, stackRangeParam, filters.days, filters.from, filters.to, filters.playerIds, token)

  const setRangeId = useCallback((rangeId: number | null) => {
    setFilters(f => ({ ...f, rangeId }))
    setStackIdx(null)
    setDetailHand(null)
  }, [])

  const realGrid = useMemo<Record<string, ActionFreq>>(() => {
    if (!selectedRange) return {}
    const sg = stackIdx !== null ? selectedRange.stackGrids?.[stackIdx]?.grid : undefined
    return (sg ?? selectedRange.grid ?? {}) as Record<string, ActionFreq>
  }, [selectedRange, stackIdx])

  const playedGrid = useMemo(() => computePlayedGrid(grid.cells), [grid.cells])
  const comboReal = useMemo(() => rangeComboStats(realGrid), [realGrid])
  const comboPlayed = useMemo(() => rangeComboStats(playedGrid), [playedGrid])
  const detailCell = detailHand ? grid.cells.find(c => c.hand === detailHand) : undefined

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
          onChange={setRangeId}
        />
        <PeriodFilter
          days={filters.days}
          from={filters.from}
          to={filters.to}
          onChange={d => setFilters(f => ({ ...f, ...d }))}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-warm-200 mb-2">
          {t.coach.matrixTitle} {selectedRangeName ? <span className="text-brand-400">· {selectedRangeName}</span> : ''}
        </h2>
        {filters.rangeId !== null && selectedStackGrids.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="text-xs text-warm-500 mr-1">{t.coach.effectiveStack}</span>
            <button
              onClick={() => { setStackIdx(null); setDetailHand(null) }}
              className={[
                'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
                stackIdx === null ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:text-warm-200',
              ].join(' ')}
            >
              {t.coach.matrixAll}
            </button>
            {selectedStackGrids.map((sg, i) => (
              <button
                key={i}
                onClick={() => { setStackIdx(i); setDetailHand(null) }}
                className={[
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  stackIdx === i ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:text-warm-200',
                ].join(' ')}
              >
                {sg.name || sg.stackRange}
              </button>
            ))}
          </div>
        )}
        {filters.rangeId === null ? (
          <p className="text-sm text-warm-500">{t.coach.selectRangeForMatrix}</p>
        ) : grid.loading ? (
          <p className="text-sm text-warm-500">{t.coach.loading}</p>
        ) : grid.error ? (
          <p className="text-sm text-red-400">{grid.error}</p>
        ) : grid.cells.length === 0 ? (
          <p className="text-sm text-warm-500">{t.coach.noRangeData}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 text-[0.7rem] text-warm-400">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: '#ef4444' }} />{t.coach.legendRaise}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: '#22c55e' }} />{t.coach.legendCall}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: '#6b2d0d' }} />{t.coach.legendAllin}</span>
              <span className="text-warm-600">{t.coach.legendFold}</span>
            </div>
            <div className="flex flex-col xl:flex-row items-start gap-6">
              <div className="flex flex-wrap items-start gap-6 flex-1 min-w-0">
                <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-4">
                  <RangeActionGrid title={t.coach.actionGridRealTitle} subtitle={t.coach.actionGridRealSub} grid={realGrid} />
                  <ComboSummary stats={comboReal} />
                </div>
                <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-4">
                  <RangeActionGrid title={t.coach.actionGridBuildPlayedTitle} subtitle={t.coach.actionGridBuildPlayedSub} grid={playedGrid} />
                  <ComboSummary stats={comboPlayed} />
                </div>
              </div>
              <div className="flex flex-wrap xl:flex-nowrap items-start gap-4 xl:shrink-0">
                <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-4">
                  <h3 className="text-xs font-semibold text-warm-200 mb-1">{t.coach.accuracyErrors}</h3>
                  <p className="text-[0.65rem] text-warm-500 mb-2 max-w-[280px]">{t.coach.buildAccuracyCaption}</p>
                  <RangeHeatGrid cells={grid.cells} showConsults={false} />
                </div>
                <TopHandsPanel cells={grid.cells} selected={detailHand} onSelect={h => setDetailHand(h === detailHand ? null : h)} showConsults={false} />
                <div className="w-[270px] shrink-0">
                  {detailCell && <HandDetailCard cell={detailCell} playedLabel={t.coach.howTeamPlayed} showConsults={false} />}
                </div>
              </div>
            </div>
          </div>
        )}
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
              <th className={THR}>{t.myAccount.colCorrectHands}</th>
              <th className={THR}>{t.myAccount.colWrongHands}</th>
              <th className={THR}>{t.coach.recallColAvg}</th>
              <th className={THR}>{t.coach.recallColBest}</th>
              <th className={THR}>{t.coach.colPlayers}</th>
              <th className={THR}>{t.coach.colLastActivity}</th>
            </tr>
          </thead>
          <tbody>
            {byRange.rows.map(r => (
              <tr
                key={r.rangeId}
                onClick={() => setRangeId(r.rangeId)}
                className={`border-t border-warm-700/60 cursor-pointer hover:bg-warm-800/50 ${filters.rangeId === r.rangeId ? 'bg-warm-800/70' : ''}`}
              >
                <td className={`${TD} text-warm-100 font-semibold whitespace-nowrap`}>{r.rangeName}</td>
                <td className={`${TDR} text-warm-300`}>{r.attempts}</td>
                <td className={`${TDR} text-emerald-300`}>{r.correctHands ?? 0}</td>
                <td className={`${TDR} text-red-400`}>{r.wrongHands ?? 0}</td>
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
