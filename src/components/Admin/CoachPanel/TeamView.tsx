import { Fragment, useCallback, useEffect, useMemo, useState, memo } from 'react'
import { countRender } from '../../../test/renderCount'
import { captureError } from '../../../utils/sentry'
import { fetchAnalyticsCached } from '../../../utils/analyticsCache'
import { useStore } from '../../../store/useStore'
import { RangeHeatGrid, type GridCell } from '../RangeHeatGrid'
import { RangeActionGrid, type ActionFreq } from '../RangeActionGrid'
import { rangeComboStats, TOTAL_COMBOS, type ComboStats } from '../../../utils/rangeCombos'
import { t } from '../../../i18n'
import { rankLeaks, severityProfile, type Confidence, type SeverityClass } from '../../../utils/coachStats'
import { buildRelativeLeaks, type PlayerRangeStat } from '../../../utils/coachRelative'
import {
  groupRangesByPosition, MultiPlayerSelect, RangeSelect, type CoachUser,
  formatDateShort, formatHours, accColor, confChipBg,
  type Filters, setDateParams, PeriodFilter, useAnalytics, useRangeGrid, usePlayerRanges,
  Section, TH, THR, TD, TDR,
} from './shared'

const ACTION_COLOR: Record<string, string> = { Raise: 'text-red-400', Call: 'text-emerald-400', 'All-in': 'text-purple-300', Extra: 'text-brand-300' }

function ComboSummary({ stats }: { stats: ComboStats }) {
  const pct = (c: number) => (c / TOTAL_COMBOS) * 100
  const items = [
    { label: 'Raise', v: stats.byAction.raise },
    { label: 'Call', v: stats.byAction.call },
    { label: 'All-in', v: stats.byAction.allin },
    { label: 'Extra', v: stats.byAction.extra },
  ].filter(x => x.v > 0.05)
  return (
    <div className="mt-3 pt-2 border-t border-warm-700/50 text-[0.7rem] text-warm-400 space-y-1">
      <div>{t.coach.opening}<span className="text-brand-300 font-semibold">{stats.openPct.toFixed(1)}%</span> <span className="text-warm-500">({Math.round(stats.openCombos)} de 1326 combos)</span></div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {items.length === 0 ? <span className="text-warm-600">{t.coach.noActions}</span> : items.map(x => (
          <span key={x.label}><span className={`font-semibold ${ACTION_COLOR[x.label]}`}>{x.label}</span> {pct(x.v).toFixed(1)}%</span>
        ))}
      </div>
    </div>
  )
}

export function TopHandsPanel({ cells, selected, onSelect }: { cells: GridCell[]; selected: string | null; onSelect: (hand: string) => void }) {
  const [tab, setTab] = useState<'errors' | 'consults'>('errors')
  const errors = [...cells].filter(c => c.total >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 20)
  const consults = [...cells].filter(c => c.consults > 0).sort((a, b) => b.consults - a.consults).slice(0, 20)
  const list = tab === 'errors' ? errors : consults
  const tabCls = (on: boolean) => `flex-1 px-2 py-1 rounded-md text-[0.7rem] font-semibold border transition-colors ${on ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:text-warm-200'}`

  return (
    <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-3 w-[260px] shrink-0">
      <div className="flex gap-1 mb-1.5">
        <button onClick={() => setTab('errors')} className={tabCls(tab === 'errors')}>{t.coach.top20errors}</button>
        <button onClick={() => setTab('consults')} className={tabCls(tab === 'consults')}>{t.coach.top20consults}</button>
      </div>
      <p className="text-[0.62rem] text-warm-500 mb-1.5">{t.coach.clickHandDetail}</p>
      <div className="space-y-0.5 max-h-[460px] overflow-y-auto pr-1">
        {list.length === 0 ? (
          <p className="text-xs text-warm-500 py-2">{t.coach.noData}</p>
        ) : list.map((c, i) => (
          <button
            key={c.hand}
            onClick={() => onSelect(c.hand)}
            className={`group w-full flex items-center gap-1.5 text-xs rounded px-1 py-0.5 cursor-pointer transition-colors ${selected === c.hand ? 'bg-warm-800 ring-1 ring-brand-500/50' : 'hover:bg-warm-800/60'}`}
          >
            <span className="text-warm-600 w-3.5 text-right tabular-nums text-[0.65rem]">{i + 1}</span>
            <span className="px-1.5 py-0.5 rounded text-[0.7rem] font-bold text-white" style={{ background: confChipBg(c.accuracy), textShadow: '0 0 3px rgba(0,0,0,0.6)' }}>{c.hand}</span>
            <span className="flex-1 truncate text-left text-[0.66rem] text-warm-500">{c.correctAction ?? '—'}{c.topWrong ? ` → ${c.topWrong.action}` : ''}</span>
            {tab === 'errors'
              ? <span className={`font-bold ${accColor(c.accuracy)}`}>{c.accuracy}%</span>
              : <span className="font-bold text-warm-200">{c.consults}x</span>}
            <span className={`text-xs ${selected === c.hand ? 'text-brand-400' : 'text-warm-600 group-hover:text-warm-300'}`}>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function playedPct(p?: { fold: number; call: number; raise: number; allin: number; extra: number }) {
  if (!p) return null
  const tot = p.fold + p.call + p.raise + p.allin + p.extra
  if (tot <= 0) return null
  return { fold: (p.fold / tot) * 100, call: (p.call / tot) * 100, raise: (p.raise / tot) * 100, allin: (p.allin / tot) * 100, extra: (p.extra / tot) * 100 }
}

export function HandDetailCard({ cell }: { cell: GridCell }) {
  const pp = playedPct(cell.played)
  const Stat = ({ label, v, cls }: { label: string; v: number; cls?: string }) => (
    <div className="bg-warm-900/60 rounded-lg px-2.5 py-1.5">
      <div className="text-[0.65rem] text-warm-500 uppercase">{label}</div>
      <div className={`text-sm font-bold ${cls ?? 'text-warm-100'}`}>{v}</div>
    </div>
  )
  const seg = (w: number, bg: string, label: string) => w > 0 ? <div style={{ width: `${w}%`, background: bg }} title={`${label} ${Math.round(w)}%`} /> : null
  return (
    <div className="w-[270px] shrink-0 rounded-xl border border-brand-500/40 bg-warm-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="px-2.5 py-1 rounded text-base font-bold text-white" style={{ background: confChipBg(cell.accuracy), textShadow: '0 0 3px rgba(0,0,0,0.6)' }}>{cell.hand}</span>
        <span className={`text-lg font-bold ${accColor(cell.accuracy)}`}>{cell.accuracy}%</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t.coach.detailAttempts} v={cell.total} />
        <Stat label={t.coach.detailCorrect} v={cell.correct} cls="text-emerald-300" />
        <Stat label={t.coach.detailBlunder} v={cell.graves} cls="text-red-400" />
        <Stat label={t.coach.detailConsults} v={cell.consults} cls="text-purple-300" />
      </div>
      <div className="text-xs space-y-0.5">
        <div className="text-emerald-300">{t.coach.detailCorrectPrefix}{cell.correctAction ?? '—'}</div>
        <div className="text-red-300">{t.coach.detailErrMost}{cell.topWrong ? `${cell.topWrong.action} (${cell.topWrong.n}x)` : '—'}</div>
      </div>
      {pp && (
        <div>
          <p className="text-[0.7rem] text-warm-400 mb-1">{t.coach.howTeamPlayed}</p>
          <div className="flex h-4 rounded overflow-hidden border border-warm-700">
            {seg(pp.raise, '#ef4444', 'Raise')}
            {seg(pp.call, '#22c55e', 'Call')}
            {seg(pp.allin, '#6b2d0d', 'All-in')}
            {seg(pp.extra, '#d97757', 'Extra')}
            {seg(pp.fold, '#2a2620', 'Fold')}
          </div>
          <div className="text-[0.65rem] text-warm-500 mt-1 flex flex-wrap gap-x-2">
            {pp.raise > 0 && <span>Raise {Math.round(pp.raise)}%</span>}
            {pp.call > 0 && <span>Call {Math.round(pp.call)}%</span>}
            {pp.allin > 0 && <span>All-in {Math.round(pp.allin)}%</span>}
            {pp.fold > 0 && <span>Fold {Math.round(pp.fold)}%</span>}
          </div>
        </div>
      )}
    </div>
  )
}

interface OverviewRow {
  userId: number; username: string; name: string; hands: number; accuracy: number
  graves: number; imprecisos: number; consults: number; sessions: number
  durationSeconds: number; lastActivity: number
}
interface LeakRow { rangeId: number; rangeName: string; hand: string; total: number; correct: number; graves: number; imprecisos: number; accuracy: number }
type LeaksSortKey = 'hand' | 'rangeName' | 'total' | 'accuracyLower' | 'graves' | 'imprecisos' | 'impact'
type RelativeSortKey = 'name' | 'rangeName' | 'total' | 'playerAcc' | 'teamMean' | 'deviation' | 'z'

const CONF_DOT: Record<Confidence, { cls: string; title: string }> = {
  low: { cls: 'bg-red-400', title: 'Amostra pequena (<15) — pouca confiança' },
  medium: { cls: 'bg-yellow-400', title: 'Amostra média (15–49)' },
  high: { cls: 'bg-emerald-400', title: 'Amostra robusta (≥50)' },
}
interface ByRangeRow { rangeId: number; rangeName: string; hands: number; accuracy: number; graves: number; imprecisos: number; consults: number; players: number }

interface ConsultRangeRow { rangeId: number; rangeName: string; totalConsults: number; totalPlayed: number; rate: number }
interface ConsultHandRow { hand: string; consults: number; played: number; pct: number }
type ConsultSortKey = 'rangeName' | 'totalConsults' | 'rate' | 'totalPlayed'

const SEVERITY_CLS: Record<SeverityClass, string> = {
  conceitual: 'text-red-300',
  misto: 'text-yellow-300',
  'estrategia-mista': 'text-sky-300',
  na: 'text-warm-600',
}
function severityLabel(c: SeverityClass): string {
  return c === 'conceitual' ? t.coach.legendConceptual
    : c === 'misto' ? t.coach.legendMixed
    : c === 'estrategia-mista' ? t.coach.legendMixedStrategy
    : '—'
}
function severityHelp(c: SeverityClass): string {
  return c === 'conceitual' ? t.coach.severityHelpConceptual
    : c === 'estrategia-mista' ? t.coach.severityHelpMixedStrategy
    : c === 'misto' ? t.coach.severityHelpMixed
    : ''
}

export function PlayerQuickSummary({ userId, days, from, to, token }: { userId: number; days: number | null; from: number | null; to: number | null; token: string | null }) {
  const [rows, setRows] = useState<ByRangeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    const qs = new URLSearchParams({ view: 'by-range', playerIds: String(userId) })
    setDateParams(qs, { days, from, to })
    fetchAnalyticsCached(`/api/admin/analytics?${qs.toString()}`, token)
      .then(d => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId, days, from, to, token])

  if (loading) {
    return (
      <div className="px-4 py-3 space-y-3 bg-warm-900/50 border-t border-warm-700/60">
        <p className="text-xs text-warm-500">{t.coach.loadingSummary}</p>
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="px-4 py-3 space-y-3 bg-warm-900/50 border-t border-warm-700/60">
        <p className="text-xs text-warm-500">{t.coach.noRangeDataPlayer}</p>
      </div>
    )
  }

  const treinados = [...rows].sort((a, b) => b.hands - a.hands).slice(0, 5)
  const piores = [...rows].filter(r => r.hands >= 5).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5)
  const consultados = [...rows].filter(r => r.consults > 0).sort((a, b) => b.consults - a.consults).slice(0, 5)

  const Col = ({ title, items, render }: { title: string; items: ByRangeRow[]; render: (r: ByRangeRow) => React.ReactNode }) => (
    <div>
      <p className="text-[0.65rem] uppercase font-semibold text-warm-500 mb-1.5 tracking-wider">{title}</p>
      {items.length === 0 ? <p className="text-xs text-warm-600">—</p> : (
        <ul className="space-y-1">
          {items.map(r => (
            <li key={r.rangeId} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-warm-300 truncate">{r.rangeName}</span>
              <span className="flex-shrink-0 font-semibold tabular-nums">{render(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div className="px-4 py-3 space-y-3 bg-warm-900/50 border-t border-warm-700/60">
      <div className="grid gap-5 md:grid-cols-3">
        <Col title={t.coach.mostTrained} items={treinados} render={r => <span className="text-warm-200">{r.hands} {t.common.hands}</span>} />
        <Col title={t.coach.whereErrsMost} items={piores} render={r => <span className={accColor(r.accuracy)}>{r.accuracy}%</span>} />
        <Col title={t.coach.mostConsulted} items={consultados} render={r => <span className="text-purple-300">{r.consults}x</span>} />
      </div>
    </div>
  )
}

function useConsultHands(rangeId: number | null, playerIds: number[], days: number | null, from: number | null, to: number | null, token: string | null) {
  const [rows, setRows] = useState<ConsultHandRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const idsKey = playerIds.join(',')

  useEffect(() => {
    if (!token || rangeId === null) return
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ view: 'consult-by-range-hand', rangeId: String(rangeId) })
    if (idsKey) qs.set('playerIds', idsKey)
    setDateParams(qs, { days, from, to })
    fetchAnalyticsCached(`/api/admin/analytics?${qs.toString()}`, token)
      .then(d => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false) } })
      .catch(e => { if (!cancelled) { captureError(e, { area: 'coach-analytics', view: 'consult-by-range-hand' }); setError(t.coach.loadError); setLoading(false) } })
    return () => { cancelled = true }
  }, [token, rangeId, idsKey, days, from, to])

  return { rows, loading, error }
}

const CONSULT_CHIP_BG = 'rgba(139,92,246,0.9)'

export function ConsultRangeDetail({ rangeId, playerIds, days, from, to, token }: {
  rangeId: number; playerIds: number[]; days: number | null; from: number | null; to: number | null; token: string | null
}) {
  const { rows, loading, error } = useConsultHands(rangeId, playerIds, days, from, to, token)

  if (loading) return <div className="px-4 py-3 text-xs text-warm-500">{t.coach.loading}</div>
  if (error) return <div className="px-4 py-3 text-xs text-red-400">{error}</div>
  if (rows.length === 0) return <div className="px-4 py-3 text-xs text-warm-500">{t.coach.noData}</div>

  const top20 = [...rows].sort((a, b) => b.consults - a.consults).slice(0, 20)

  return (
    <div className="px-4 py-3 bg-warm-900/50 border-t border-warm-700/60">
      <p className="text-[0.62rem] text-warm-500 mb-1.5 uppercase font-semibold tracking-wider">{t.coach.top20consults}</p>
      <div className="space-y-0.5 max-h-[460px] overflow-y-auto pr-1">
        {top20.map((r, i) => (
          <div key={r.hand} className="flex items-center gap-1.5 text-xs rounded px-1 py-0.5">
            <span className="text-warm-600 w-3.5 text-right tabular-nums text-[0.65rem]">{i + 1}</span>
            <span className="px-1.5 py-0.5 rounded text-[0.7rem] font-bold text-white" style={{ background: CONSULT_CHIP_BG, textShadow: '0 0 3px rgba(0,0,0,0.6)' }}>{r.hand}</span>
            <span className="flex-1 truncate text-left text-[0.66rem] text-warm-500">{t.coach.consultHandSummary(r.played, r.pct)}</span>
            <span className="font-bold text-warm-200">{r.consults}x</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const CONSULT_RANGE_COLS: { k: ConsultSortKey; label: string; align: 'l' | 'r' }[] = [
  { k: 'rangeName', label: t.coach.colRange, align: 'l' },
  { k: 'totalConsults', label: t.coach.colConsultedHands, align: 'r' },
  { k: 'rate', label: t.coach.colConsultRate, align: 'r' },
  { k: 'totalPlayed', label: t.coach.colPlayedRange, align: 'r' },
]

const ConsultRangeTableRow = memo(function ConsultRangeTableRow({ row: r, isOpen, onToggle, playerIds, days, from, to, token }: {
  row: ConsultRangeRow
  isOpen: boolean
  onToggle: (rangeId: number) => void
  playerIds: number[]
  days: number | null
  from: number | null
  to: number | null
  token: string | null
}) {
  return (
    <Fragment>
      <tr
        onClick={() => onToggle(r.rangeId)}
        className={`border-t border-warm-700/60 cursor-pointer transition-colors ${isOpen ? 'bg-warm-800/70' : 'hover:bg-warm-800/50'}`}
      >
        <td className={`${TD} text-warm-100 font-semibold`}>
          <span className={`inline-block w-3 text-warm-600 text-[0.6rem] ${isOpen ? 'text-brand-400' : ''}`}>{isOpen ? '▾' : '▸'}</span>
          {r.rangeName}
        </td>
        <td className={`${TDR} text-purple-300`}>{r.totalConsults}</td>
        <td className={`${TDR} font-bold text-warm-200`}>{r.rate}%</td>
        <td className={`${TDR} text-warm-300`}>{r.totalPlayed}</td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={4} className="p-0">
            <ConsultRangeDetail rangeId={r.rangeId} playerIds={playerIds} days={days} from={from} to={to} token={token} />
          </td>
        </tr>
      )}
    </Fragment>
  )
})

type SortKey = 'name' | 'hands' | 'accuracy' | 'graves' | 'consults' | 'durationSeconds' | 'lastActivity'
type ByRangeSortKey = 'hands' | 'accuracy' | 'graves' | 'consults' | 'players'

// Linhas memoizadas: abrir o resumo de um jogador / reordenar não re-renderiza
// todas as linhas, só as afetadas (props estáveis + handlers via useCallback).
const OverviewTableRow = memo(function OverviewTableRow({ row: r, isOpen, zebra, onToggle, days, from, to, token }: {
  row: OverviewRow
  isOpen: boolean
  zebra: boolean
  onToggle: (userId: number) => void
  days: number | null
  from: number | null
  to: number | null
  token: string | null
}) {
  countRender('overviewRow')
  return (
    <Fragment>
      <tr
        onClick={() => onToggle(r.userId)}
        className={`border-t border-warm-700/60 cursor-pointer transition-colors ${isOpen ? 'bg-warm-800/70' : zebra ? 'bg-warm-900/20 hover:bg-warm-800/50' : 'hover:bg-warm-800/50'}`}
      >
        <td className={`${TD} text-warm-100 font-semibold`}>
          <span className={`inline-block w-3 text-warm-600 text-[0.6rem] ${isOpen ? 'text-brand-400' : ''}`}>{isOpen ? '▾' : '▸'}</span>
          {r.name || r.username}
        </td>
        <td className={`${TDR} text-warm-300`}>{r.hands}</td>
        <td className={`${TDR} font-bold ${accColor(r.accuracy)}`}>{r.accuracy}%</td>
        <td className={`${TDR} text-red-400`}>{r.graves}</td>
        <td className={`${TDR} text-warm-400`}>{r.consults}</td>
        <td className={`${TDR} text-warm-400`}>{formatHours(r.durationSeconds)}</td>
        <td className={`${TDR} text-warm-500`}>{formatDateShort(r.lastActivity)}</td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={7} className="p-0">
            <PlayerQuickSummary userId={r.userId} days={days} from={from} to={to} token={token} />
          </td>
        </tr>
      )}
    </Fragment>
  )
})

const ByRangeTableRow = memo(function ByRangeTableRow({ row: r, selected, onSelect }: {
  row: ByRangeRow
  selected: boolean
  onSelect: (rangeId: number) => void
}) {
  countRender('byRangeRow')
  const sev = severityProfile(r.graves, r.imprecisos)
  return (
    <tr
      onClick={() => onSelect(r.rangeId)}
      className={`border-t border-warm-700/60 cursor-pointer hover:bg-warm-800/50 ${selected ? 'bg-warm-800/70' : ''}`}
    >
      <td className={`${TD} text-warm-100 font-semibold whitespace-nowrap`}>{r.rangeName}</td>
      <td className={`${TDR} text-warm-300`}>{r.hands}</td>
      <td className={`${TDR} font-bold ${accColor(r.accuracy)}`}>{r.accuracy}%</td>
      <td className={`${TDR} text-red-400`}>{r.graves}</td>
      <td className={`${TD} whitespace-nowrap`} title={severityHelp(sev.classification) || undefined}>
        <span className={`font-semibold ${SEVERITY_CLS[sev.classification]}`}>{severityLabel(sev.classification)}</span>
        {sev.classification !== 'na' && (
          <span className="block text-[0.65rem] text-warm-500">{t.coach.blundersImprecise(r.graves, r.imprecisos)}</span>
        )}
      </td>
      <td className={`${TDR} text-warm-400`}>{r.consults}</td>
      <td className={`${TDR} text-warm-400`}>{r.players}</td>
    </tr>
  )
})

export function TeamView({ token }: { token: string | null }) {
  const ranges = useStore(s => s.ranges)
  const [users, setUsers] = useState<CoachUser[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('hands')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [brSortKey, setBrSortKey] = useState<ByRangeSortKey>('hands')
  const [brSortDir, setBrSortDir] = useState<'asc' | 'desc'>('desc')
  const [openPlayer, setOpenPlayer] = useState<number | null>(null)
  const [consultSortKey, setConsultSortKey] = useState<ConsultSortKey>('rate')
  const [consultSortDir, setConsultSortDir] = useState<'asc' | 'desc'>('desc')
  const [openConsultRange, setOpenConsultRange] = useState<number | null>(null)
  const [leaksSortKey, setLeaksSortKey] = useState<LeaksSortKey>('impact')
  const [leaksSortDir, setLeaksSortDir] = useState<'asc' | 'desc'>('desc')
  const [relSortKey, setRelSortKey] = useState<RelativeSortKey>('z')
  const [relSortDir, setRelSortDir] = useState<'asc' | 'desc'>('asc')
  const [filters, setFilters] = useState<Filters>({ playerIds: [], rangeId: null, days: null, from: null, to: null })
  const [stackIdx, setStackIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setUsers(d.users ?? []))
      .catch(() => {})
  }, [token])

  const [detailHand, setDetailHand] = useState<string | null>(null)
  useEffect(() => { setStackIdx(null); setDetailHand(null) }, [filters.rangeId])
  useEffect(() => { setDetailHand(null) }, [stackIdx])

  const sortedUsers = [...users].sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username))
  const rangeGroups = useMemo(() => groupRangesByPosition(ranges), [ranges])

  const overview = useAnalytics<OverviewRow>('team-overview', filters, token)
  const leaks = useAnalytics<LeakRow>('leaks', filters, token)
  const byRange = useAnalytics<ByRangeRow>('by-range', filters, token)
  const consultRanges = useAnalytics<ConsultRangeRow>('consult-by-range', filters, token)
  const playerRanges = usePlayerRanges(filters, token)
  const grid = useRangeGrid(filters.rangeId, filters.days, filters.from, filters.to, filters.playerIds, stackIdx, token)

  const relativeLeaks = useMemo(() => {
    const nameOf = (id: number) => { const u = playerRanges.users.find(x => x.id === id); return u ? (u.name || u.username) : `#${id}` }
    const stats: PlayerRangeStat[] = playerRanges.rows.map(r => ({
      userId: r.userId, name: nameOf(r.userId), rangeId: r.rangeId, rangeName: r.rangeName, total: r.total, correct: r.correct,
    }))
    return buildRelativeLeaks(stats).slice(0, 40)
  }, [playerRanges.rows, playerRanges.users])

  const rankedLeaks = useMemo(() => rankLeaks(leaks.rows), [leaks.rows])

  const selectedRange = ranges.find(r => r.id === filters.rangeId)
  const selectedRangeName = selectedRange?.name ?? ''
  const selectedStackGrids = selectedRange?.stackGrids ?? []

  const realGrid = useMemo<Record<string, ActionFreq>>(() => {
    if (!selectedRange) return {}
    const sg = stackIdx !== null ? selectedRange.stackGrids?.[stackIdx]?.grid : undefined
    return (sg ?? selectedRange.grid ?? {}) as Record<string, ActionFreq>
  }, [selectedRange, stackIdx])

  const playedGrid = useMemo<Record<string, ActionFreq>>(() => {
    const out: Record<string, ActionFreq> = {}
    for (const c of grid.cells) {
      const p = c.played
      if (!p) continue
      const tot = p.fold + p.call + p.raise + p.allin + p.extra
      if (tot <= 0) continue
      out[c.hand] = {
        fold: (p.fold / tot) * 100,
        call: (p.call / tot) * 100,
        raise: (p.raise / tot) * 100,
        allin: (p.allin / tot) * 100,
        extra: (p.extra / tot) * 100,
      }
    }
    return out
  }, [grid.cells])

  const comboReal = useMemo(() => rangeComboStats(realGrid), [realGrid])
  const comboPlayed = useMemo(() => rangeComboStats(playedGrid), [playedGrid])
  const detailCell = detailHand ? grid.cells.find(c => c.hand === detailHand) : undefined

  const sortedOverview = useMemo(() => {
    const rows = [...overview.rows]
    rows.sort((a, b) => {
      if (sortKey === 'name') {
        const an = (a.name || a.username).toLowerCase(), bn = (b.name || b.username).toLowerCase()
        return sortDir === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an)
      }
      const av = a[sortKey] as number, bv = b[sortKey] as number
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [overview.rows, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc') }
  }

  const togglePlayer = useCallback((userId: number) => {
    setOpenPlayer(p => (p === userId ? null : userId))
  }, [])
  const selectRange = useCallback((rangeId: number) => {
    setFilters(f => ({ ...f, rangeId }))
  }, [])

  const sortedByRange = useMemo(() => {
    const rows = [...byRange.rows]
    rows.sort((a, b) => {
      const av = a[brSortKey] as number, bv = b[brSortKey] as number
      return brSortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [byRange.rows, brSortKey, brSortDir])

  function handleBrSort(key: ByRangeSortKey) {
    if (key === brSortKey) setBrSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setBrSortKey(key); setBrSortDir('desc') }
  }

  const toggleConsultRange = useCallback((rangeId: number) => {
    setOpenConsultRange(p => (p === rangeId ? null : rangeId))
  }, [])

  const sortedConsult = useMemo(() => {
    const rows = [...consultRanges.rows]
    rows.sort((a, b) => {
      if (consultSortKey === 'rangeName') {
        return consultSortDir === 'asc' ? a.rangeName.localeCompare(b.rangeName) : b.rangeName.localeCompare(a.rangeName)
      }
      const av = a[consultSortKey] as number, bv = b[consultSortKey] as number
      return consultSortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [consultRanges.rows, consultSortKey, consultSortDir])

  function handleConsultSort(key: ConsultSortKey) {
    if (key === consultSortKey) setConsultSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setConsultSortKey(key); setConsultSortDir(key === 'rangeName' ? 'asc' : 'desc') }
  }

  const sortedLeaks = useMemo(() => {
    const rows = [...rankedLeaks]
    rows.sort((a, b) => {
      if (leaksSortKey === 'hand' || leaksSortKey === 'rangeName') {
        const av = a[leaksSortKey], bv = b[leaksSortKey]
        return leaksSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      const av = a[leaksSortKey] as number, bv = b[leaksSortKey] as number
      return leaksSortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [rankedLeaks, leaksSortKey, leaksSortDir])

  function handleLeaksSort(key: LeaksSortKey) {
    if (key === leaksSortKey) setLeaksSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setLeaksSortKey(key); setLeaksSortDir(key === 'hand' || key === 'rangeName' ? 'asc' : 'desc') }
  }

  const sortedRelative = useMemo(() => {
    const rows = [...relativeLeaks]
    rows.sort((a, b) => {
      if (relSortKey === 'name' || relSortKey === 'rangeName') {
        const av = a[relSortKey], bv = b[relSortKey]
        return relSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      const av = a[relSortKey] as number, bv = b[relSortKey] as number
      return relSortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [relativeLeaks, relSortKey, relSortDir])

  function handleRelSort(key: RelativeSortKey) {
    if (key === relSortKey) setRelSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setRelSortKey(key); setRelSortDir(key === 'name' || key === 'rangeName' ? 'asc' : 'desc') }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-warm-700 bg-warm-900/30 p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide mb-1.5">{t.coach.period}:</p>
          <PeriodFilter
            days={filters.days}
            from={filters.from}
            to={filters.to}
            onChange={d => setFilters(f => ({ ...f, ...d }))}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide mb-1.5">{t.coach.players}:</p>
            <MultiPlayerSelect
              users={sortedUsers}
              selected={filters.playerIds}
              onChange={ids => setFilters(f => ({ ...f, playerIds: ids }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide mb-1.5">{t.coach.colRanges}:</p>
            <RangeSelect
              groups={rangeGroups}
              value={filters.rangeId}
              onChange={id => setFilters(f => ({ ...f, rangeId: id }))}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-warm-200 mb-2">
          {t.coach.matrixTitle} {selectedRangeName ? <span className="text-brand-400">· {selectedRangeName}</span> : ''}
          {filters.playerIds.length > 0 && <span className="text-warm-500 text-xs font-normal">{t.coach.playersSuffix(filters.playerIds.length)}</span>}
        </h3>
        {filters.rangeId !== null && selectedStackGrids.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="text-xs text-warm-500 mr-1">{t.coach.effectiveStack}</span>
            <button
              onClick={() => setStackIdx(null)}
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
                onClick={() => setStackIdx(i)}
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
                  <RangeActionGrid title={t.coach.actionGridPlayedTitle} subtitle={t.coach.actionGridPlayedSub} grid={playedGrid} />
                  <ComboSummary stats={comboPlayed} />
                </div>
              </div>
              <div className="flex flex-wrap xl:flex-nowrap items-start gap-4 xl:shrink-0">
                <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-4">
                  <h4 className="text-xs font-semibold text-warm-200 mb-2">{t.coach.accuracyErrors}</h4>
                  <RangeHeatGrid cells={grid.cells} />
                </div>
                <TopHandsPanel cells={grid.cells} selected={detailHand} onSelect={h => setDetailHand(h === detailHand ? null : h)} />
                <div className="w-[270px] shrink-0">
                  {detailCell && <HandDetailCard cell={detailCell} />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Section title={t.coach.sectionByRange} defaultOpen={false} loading={byRange.loading} error={byRange.error} empty={byRange.rows.length === 0} onRetry={byRange.reload}>
        <div className="px-3 py-1.5 text-[11px] text-warm-500 bg-warm-800/30 border-b border-warm-700/60 leading-relaxed">
          {t.coach.byRangeLegendIntro}
          <span className="text-red-300 font-semibold">{t.coach.legendConceptual}</span>{t.coach.legendConceptualDesc}
          <span className="text-sky-300 font-semibold">{t.coach.legendMixedStrategy}</span>{t.coach.legendMixedStrategyDesc}
          <span className="text-yellow-300 font-semibold">{t.coach.legendMixed}</span>{t.coach.legendMixedDesc}
        </div>
        <table className="text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              <th className={TH}>{t.coach.colRange}</th>
              {([
                { k: 'hands', label: t.coach.colHands },
                { k: 'accuracy', label: t.coach.colAccuracy },
                { k: 'graves', label: t.coach.colBlunder },
              ] as { k: ByRangeSortKey; label: string }[]).map(col => (
                <th key={col.k} className={THR}>
                  <button
                    onClick={() => handleBrSort(col.k)}
                    className={`inline-flex flex-row-reverse items-center gap-1 cursor-pointer hover:text-warm-100 transition-colors ${brSortKey === col.k ? 'text-brand-300' : ''}`}
                  >
                    {col.label}
                    <span className="text-[0.6rem] w-2">{brSortKey === col.k ? (brSortDir === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
              <th className={TH}>{t.coach.colErrorType}</th>
              {([
                { k: 'consults', label: t.coach.colConsults },
                { k: 'players', label: t.coach.colPlayers },
              ] as { k: ByRangeSortKey; label: string }[]).map(col => (
                <th key={col.k} className={THR}>
                  <button
                    onClick={() => handleBrSort(col.k)}
                    className={`inline-flex flex-row-reverse items-center gap-1 cursor-pointer hover:text-warm-100 transition-colors ${brSortKey === col.k ? 'text-brand-300' : ''}`}
                  >
                    {col.label}
                    <span className="text-[0.6rem] w-2">{brSortKey === col.k ? (brSortDir === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedByRange.map((r, i) => (
              <ByRangeTableRow key={i} row={r} selected={filters.rangeId === r.rangeId} onSelect={selectRange} />
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t.coach.sectionTeamSummary} defaultOpen={false} loading={overview.loading} error={overview.error} empty={overview.rows.length === 0} onRetry={overview.reload}>
        <div className="px-3 py-1.5 text-[11px] text-warm-500 bg-warm-800/30 border-b border-warm-700/60">
          {t.coach.overviewLegend}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              {([
                { k: 'name', label: t.coach.colPlayer, align: 'l' },
                { k: 'hands', label: t.coach.colHands, align: 'r' },
                { k: 'accuracy', label: t.coach.colAccuracy, align: 'r' },
                { k: 'graves', label: t.coach.colBlunder, align: 'r' },
                { k: 'consults', label: t.coach.colConsults, align: 'r' },
                { k: 'durationSeconds', label: t.coach.colTime, align: 'r' },
                { k: 'lastActivity', label: t.coach.colLastActivity, align: 'r' },
              ] as { k: SortKey; label: string; align: 'l' | 'r' }[]).map(col => (
                <th key={col.k} className={col.align === 'l' ? TH : THR}>
                  <button
                    onClick={() => handleSort(col.k)}
                    className={`inline-flex items-center gap-1 hover:text-warm-100 transition-colors ${col.align === 'r' ? 'flex-row-reverse' : ''} ${sortKey === col.k ? 'text-brand-300' : ''}`}
                  >
                    {col.label}
                    <span className="text-[0.6rem] w-2">{sortKey === col.k ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedOverview.map((r, i) => (
              <OverviewTableRow
                key={r.userId}
                row={r}
                isOpen={openPlayer === r.userId}
                zebra={!!(i % 2)}
                onToggle={togglePlayer}
                days={filters.days}
                from={filters.from}
                to={filters.to}
                token={token}
              />
            ))}
            {overview.team && (
              <tr className="border-t-2 border-warm-600 bg-warm-800/40 font-bold">
                <td className={`${TD} text-warm-100`}><span className="inline-block w-3" />TIME</td>
                <td className={`${TDR} text-warm-200`}>{overview.team.hands}</td>
                <td className={`${TDR} ${accColor(overview.team.accuracy)}`}>{overview.team.accuracy}%</td>
                <td className={`${TDR} text-red-400`}>{overview.team.graves}</td>
                <td className={`${TDR} text-warm-300`}>{overview.team.consults}</td>
                <td className={`${TDR} text-warm-300`}>{formatHours(overview.team.durationSeconds)}</td>
                <td className={`${TDR} text-warm-500`}>{formatDateShort(overview.team.lastActivity)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title={t.coach.sectionLeaks} defaultOpen={false} loading={leaks.loading} error={leaks.error} empty={rankedLeaks.length === 0} onRetry={leaks.reload}>
        <div className="px-3 py-1.5 text-[11px] text-warm-500 bg-warm-800/30 border-b border-warm-700/60">
          {t.coach.leaksLegendBefore}<span className="text-warm-300">{t.coach.colImpactLower}</span>{t.coach.leaksLegendAfter}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              {([
                { k: 'hand', label: t.coach.colHand, align: 'l' },
                { k: 'rangeName', label: t.coach.colRange, align: 'l' },
                { k: 'total', label: t.coach.colAttempts, align: 'r' },
                { k: 'accuracyLower', label: t.coach.colAccuracyMin, align: 'r' },
                { k: 'graves', label: t.coach.colBlunder, align: 'r' },
                { k: 'imprecisos', label: t.coach.colImprecise, align: 'r' },
                { k: 'impact', label: t.coach.colImpact, align: 'r' },
              ] as { k: LeaksSortKey; label: string; align: 'l' | 'r' }[]).map(col => (
                <th key={col.k} className={col.align === 'l' ? TH : THR}>
                  <button
                    onClick={() => handleLeaksSort(col.k)}
                    className={`inline-flex items-center gap-1 hover:text-warm-100 transition-colors ${col.align === 'r' ? 'flex-row-reverse' : ''} ${leaksSortKey === col.k ? 'text-brand-300' : ''}`}
                  >
                    {col.label}
                    <span className="text-[0.6rem] w-2">{leaksSortKey === col.k ? (leaksSortDir === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedLeaks.map((r, i) => {
              const dot = CONF_DOT[r.confidence]
              return (
                <tr key={i} className={`border-t border-warm-700/60 ${r.confidence === 'low' ? 'opacity-60' : ''} ${r.accuracy < 50 && r.confidence !== 'low' ? 'bg-red-950/30' : ''}`}>
                  <td className={`${TD} text-warm-100 font-bold`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot.cls}`} title={dot.title} />
                      {r.hand}
                    </span>
                  </td>
                  <td className={`${TD} text-warm-300`}>{r.rangeName}</td>
                  <td className={`${TDR} text-warm-300`}>{r.total}</td>
                  <td className={`${TDR} font-bold ${accColor(r.accuracy)}`}>
                    {r.accuracy}% <span className="text-warm-500 font-normal text-xs">({r.accuracyLower}%)</span>
                  </td>
                  <td className={`${TDR} text-red-400`}>{r.graves}</td>
                  <td className={`${TDR} text-yellow-400`}>{r.imprecisos}</td>
                  <td className={`${TDR} font-bold text-orange-300`}>{Math.round(r.impact * 10) / 10}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>

      <Section title={t.coach.sectionConsultDrill} defaultOpen={false} loading={consultRanges.loading} error={consultRanges.error} empty={sortedConsult.length === 0} onRetry={consultRanges.reload}>
        <div className="px-3 py-1.5 text-[11px] text-warm-500 bg-warm-800/30 border-b border-warm-700/60 leading-relaxed">
          {t.coach.consultDrillLegend}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              {CONSULT_RANGE_COLS.map(col => (
                <th key={col.k} className={col.align === 'l' ? TH : THR}>
                  <button
                    onClick={() => handleConsultSort(col.k)}
                    className={`inline-flex items-center gap-1 hover:text-warm-100 transition-colors ${col.align === 'r' ? 'flex-row-reverse' : ''} ${consultSortKey === col.k ? 'text-brand-300' : ''}`}
                  >
                    {col.label}
                    <span className="text-[0.6rem] w-2">{consultSortKey === col.k ? (consultSortDir === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedConsult.map(r => (
              <ConsultRangeTableRow
                key={r.rangeId}
                row={r}
                isOpen={openConsultRange === r.rangeId}
                onToggle={toggleConsultRange}
                playerIds={filters.playerIds}
                days={filters.days}
                from={filters.from}
                to={filters.to}
                token={token}
              />
            ))}
          </tbody>
        </table>
      </Section>


      <Section title={t.coach.sectionRelative} defaultOpen={false} loading={playerRanges.loading} error={playerRanges.error} empty={relativeLeaks.length === 0} onRetry={playerRanges.reload}>
        <div className="px-3 py-1.5 text-[11px] text-warm-500 bg-warm-800/30 border-b border-warm-700/60">
          {t.coach.relativeLegendBefore}<span className="text-warm-300">{t.coach.belowPeers}</span>{t.coach.relativeLegendAfter}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              {([
                { k: 'name', label: t.coach.colPlayer, align: 'l' },
                { k: 'rangeName', label: t.coach.colRange, align: 'l' },
                { k: 'total', label: t.coach.colHands, align: 'r' },
                { k: 'playerAcc', label: t.coach.colAccuracy, align: 'r' },
                { k: 'teamMean', label: t.coach.colTeamAvg, align: 'r' },
                { k: 'deviation', label: 'Δ', align: 'r' },
                { k: 'z', label: 'z', align: 'r' },
              ] as { k: RelativeSortKey; label: string; align: 'l' | 'r' }[]).map(col => (
                <th key={col.k} className={col.align === 'l' ? TH : THR}>
                  <button
                    onClick={() => handleRelSort(col.k)}
                    className={`inline-flex items-center gap-1 hover:text-warm-100 transition-colors ${col.align === 'r' ? 'flex-row-reverse' : ''} ${relSortKey === col.k ? 'text-brand-300' : ''}`}
                  >
                    {col.label}
                    <span className="text-[0.6rem] w-2">{relSortKey === col.k ? (relSortDir === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRelative.map((r, i) => (
              <tr key={i} className={`border-t border-warm-700/60 ${r.z <= -2 ? 'bg-red-950/30' : ''}`}>
                <td className={`${TD} text-warm-100 font-semibold`}>{r.name}</td>
                <td className={`${TD} text-warm-300`}>{r.rangeName}</td>
                <td className={`${TDR} text-warm-300`}>{r.total}</td>
                <td className={`${TDR} font-bold ${accColor(r.playerAcc)}`}>{r.playerAcc}%</td>
                <td className={`${TDR} text-warm-400`}>{r.teamMean}%</td>
                <td className={`${TDR} font-semibold text-red-400`}>{r.deviation}</td>
                <td className={`${TDR} font-bold ${r.z <= -2 ? 'text-red-400' : r.z <= -1 ? 'text-yellow-400' : 'text-warm-400'}`}>{r.z}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

    </div>
  )
}
