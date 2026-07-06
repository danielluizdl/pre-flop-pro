import { Fragment, useEffect, useMemo, useRef, useState, useCallback, memo } from 'react'
import { countRender } from '../../test/renderCount'
import { Skeleton } from '../ui/Skeleton'
import { captureError } from '../../utils/sentry'
import { fetchAnalyticsCached, invalidateAnalyticsCache } from '../../utils/analyticsCache'
import { useModalA11y } from '../../utils/useModalA11y'
import { useStore } from '../../store/useStore'
import { RangeHeatGrid, type GridCell } from './RangeHeatGrid'
import { RangeActionGrid, type ActionFreq } from './RangeActionGrid'
import { rangeComboStats, TOTAL_COMBOS, type ComboStats } from '../../utils/rangeCombos'
import { t } from '../../i18n'

const ADMIN_EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/

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
import { rankLeaks, severityProfile, type Confidence, type SeverityClass } from '../../utils/coachStats'
import { buildRelativeLeaks, type PlayerRangeStat } from '../../utils/coachRelative'

const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'EP', 'LJ', 'UTG']

interface RangeOpt { id: number; name: string; positions?: string[]; stackGrids?: { stackRange: string; name?: string }[] }
function groupRangesByPosition(ranges: RangeOpt[]) {
  const groups = new Map<string, RangeOpt[]>()
  for (const r of ranges) {
    const pos = r.positions?.[0] ?? t.coach.othersGroup
    if (!groups.has(pos)) groups.set(pos, [])
    groups.get(pos)!.push(r)
  }
  const rank = (p: string) => { const i = POSITION_ORDER.indexOf(p); return i === -1 ? 999 : i }
  return [...groups.keys()]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map(pos => ({ pos, items: groups.get(pos)!.sort((x, y) => x.name.localeCompare(y.name)) }))
}

function MultiPlayerSelect({ users, selected, onChange }: {
  users: { id: number; username: string; name: string }[]
  selected: number[]
  onChange: (ids: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const nameOf = (id: number) => { const u = users.find(x => x.id === id); return u ? (u.name || u.username) : '' }
  const label = selected.length === 0 ? t.coach.allPlayers : selected.length === 1 ? nameOf(selected[0]) : t.coach.playersCount(selected.length)
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  const q = query.trim().toLowerCase()
  const shownUsers = q ? users.filter(u => (u.name || '').toLowerCase().includes(q) || u.username.toLowerCase().includes(q)) : users

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.coach.filterPlayers}
        className="bg-warm-900 border border-warm-600 rounded-lg px-2.5 py-1.5 text-sm text-warm-100 flex items-center gap-2 min-w-[190px] justify-between"
      >
        <span className="truncate">{label}</span>
        <span className="text-warm-400 text-xs select-none">▾</span>
      </button>
      {open && (
        <div
          className="absolute z-30 mt-1 w-64 max-h-72 overflow-y-auto bg-warm-900 border border-warm-600 rounded-lg shadow-xl p-1"
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false) } }}
        >
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`${t.coach.searchPlayer}…`}
            aria-label={t.coach.searchPlayer}
            className="w-full bg-warm-950 border border-warm-700 rounded px-2 py-1.5 text-sm text-warm-100 placeholder-warm-500 mb-1"
            autoFocus
          />
          <button
            onClick={() => onChange([])}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${selected.length === 0 ? 'text-brand-300 font-semibold' : 'text-warm-300 hover:bg-warm-800'}`}
          >
            {t.coach.allPlayers}
          </button>
          <div className="h-px bg-warm-700 my-1" />
          <div role="group" aria-label={t.coach.players}>
            {shownUsers.length === 0 && <p className="px-2 py-1.5 text-xs text-warm-500">{t.coach.noPlayer}</p>}
            {shownUsers.map(u => (
              <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-warm-200 hover:bg-warm-800 cursor-pointer">
                <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="accent-brand-500" />
                <span className="truncate">{u.name || u.username}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RangeSelect({ groups, value, onChange }: {
  groups: { pos: string; items: RangeOpt[] }[]
  value: number | null
  onChange: (id: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => { if (open) setActiveIndex(0) }, [open, query])

  useEffect(() => {
    if (!open) return
    const el = document.getElementById(`range-opt-${activeIndex}`)
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [open, activeIndex])

  const selected = groups.flatMap(g => g.items).find(r => r.id === value)
  const label = selected ? selected.name : t.coach.allRanges

  const q = query.trim().toLowerCase()
  const filtered = q
    ? groups.map(g => ({ pos: g.pos, items: g.items.filter(r => r.name.toLowerCase().includes(q)) })).filter(g => g.items.length > 0)
    : groups

  const flatIds: (number | null)[] = [null, ...filtered.flatMap(g => g.items.map(r => r.id))]
  const pick = (id: number | null) => { onChange(id); setOpen(false); setQuery('') }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flatIds.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex < flatIds.length) pick(flatIds[activeIndex]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setQuery('') }
  }

  let idx = 0
  const optId = (i: number) => `range-opt-${i}`

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.coach.filterRange}
        className="bg-warm-900 border border-warm-600 rounded-lg px-2.5 py-1.5 text-sm text-warm-100 flex items-center gap-2 min-w-[200px] justify-between"
      >
        <span className="truncate">{label}</span>
        <span className="text-warm-400 text-xs select-none">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 max-h-80 overflow-y-auto bg-warm-900 border border-warm-600 rounded-lg shadow-xl p-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t.coach.searchRange}
            aria-label="Buscar range"
            role="combobox"
            aria-expanded={open}
            aria-controls="range-listbox"
            aria-activedescendant={optId(activeIndex)}
            className="w-full bg-warm-950 border border-warm-700 rounded px-2 py-1.5 text-sm text-warm-100 placeholder-warm-500 mb-1"
            autoFocus
          />
          <div id="range-listbox" role="listbox" aria-label="Ranges">
            {(() => { const i = idx++; return (
              <button
                id={optId(i)}
                role="option"
                aria-selected={value === null}
                onClick={() => pick(null)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm ${i === activeIndex ? 'ring-1 ring-brand-500 ' : ''}${value === null ? 'text-brand-300 font-semibold' : 'text-warm-300 hover:bg-warm-800'}`}
              >
                {t.coach.allRanges}
              </button>
            ) })()}
            {flatIds.length === 1 && <p className="px-2 py-1.5 text-xs text-warm-500">{t.coach.noRange}</p>}
            {filtered.map(g => (
              <div key={g.pos} role="group" aria-label={g.pos}>
                <p aria-hidden="true" className="px-2 pt-1.5 pb-0.5 text-[0.65rem] uppercase font-semibold text-warm-500 tracking-wider">{g.pos}</p>
                {g.items.map(r => {
                  const n = r.stackGrids?.length ?? 0
                  const i = idx++
                  return (
                    <button
                      key={r.id}
                      id={optId(i)}
                      role="option"
                      aria-selected={value === r.id}
                      onClick={() => pick(r.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm truncate ${i === activeIndex ? 'ring-1 ring-brand-500 ' : ''}${value === r.id ? 'bg-warm-800 text-brand-300 font-semibold' : 'text-warm-200 hover:bg-warm-800'}`}
                    >
                      {r.name}{n > 1 ? <span className="text-warm-500"> · {n} stacks</span> : null}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface CoachUser {
  id: number
  username: string
  name: string
  email: string
  created_at: number
  total_hands: number
  correct_hands: number | null
}

function formatDate(unix: number): string {
  if (!unix) return '—'
  const d = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateShort(unix: number): string {
  if (!unix) return '—'
  const d = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

function accColor(acc: number): string {
  return acc >= 80 ? 'text-emerald-400' : acc >= 50 ? 'text-yellow-400' : 'text-red-400'
}

function confChipBg(acc: number): string {
  if (acc >= 80) return 'rgba(34,197,94,0.9)'
  if (acc >= 50) return 'rgba(202,138,4,0.9)'
  return 'rgba(220,38,38,0.92)'
}

type Top20SortKey = 'played' | 'pct' | 'consults'

function useTop20Sort(defaultKey: Top20SortKey = 'consults') {
  const [sortKey, setSortKey] = useState<Top20SortKey>(defaultKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  function handleSort(key: Top20SortKey) {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }
  return { sortKey, sortDir, handleSort }
}

const TOP20_SORT_OPTS: { k: Top20SortKey; label: string }[] = [
  { k: 'played', label: t.coach.top20SortPlayed },
  { k: 'pct', label: t.coach.top20SortPct },
  { k: 'consults', label: t.coach.top20SortConsults },
]

function Top20TableHead({ sortKey, sortDir, onSort }: { sortKey: Top20SortKey; sortDir: 'asc' | 'desc'; onSort: (key: Top20SortKey) => void }) {
  return (
    <thead>
      <tr className="text-warm-500 text-[0.6rem] uppercase select-none">
        <th className="w-4" />
        <th className="text-left pb-1 pr-2">{t.coach.colHand}</th>
        {TOP20_SORT_OPTS.map(o => (
          <th key={o.k} className="text-right pb-1 pl-2 whitespace-nowrap">
            <button
              onClick={() => onSort(o.k)}
              className={`inline-flex items-center gap-0.5 font-semibold transition-colors ${sortKey === o.k ? 'text-brand-300' : 'text-warm-500 hover:text-warm-300'}`}
            >
              {o.label}
              <span className="text-[0.55rem] w-1.5">{sortKey === o.k ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
            </button>
          </th>
        ))}
      </tr>
    </thead>
  )
}

export function TopHandsPanel({ cells, selected, onSelect }: { cells: GridCell[]; selected: string | null; onSelect: (hand: string) => void }) {
  const [tab, setTab] = useState<'errors' | 'consults'>('errors')
  const { sortKey: consultSortKey, sortDir: consultSortDir, handleSort: handleConsultSort } = useTop20Sort()
  const consultValue = (c: GridCell, key: Top20SortKey) =>
    key === 'played' ? c.total : key === 'pct' ? (c.total > 0 ? (c.consults / c.total) * 100 : 0) : c.consults
  const errors = [...cells].filter(c => c.total >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 20)
  const consults = [...cells]
    .filter(c => c.consults > 0)
    .sort((a, b) => (consultSortDir === 'asc' ? 1 : -1) * (consultValue(a, consultSortKey) - consultValue(b, consultSortKey)))
    .slice(0, 20)
  const tabCls = (on: boolean) => `flex-1 px-2 py-1 rounded-md text-[0.7rem] font-semibold border transition-colors ${on ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:text-warm-200'}`

  return (
    <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-3 w-[300px] shrink-0">
      <div className="flex gap-1 mb-1.5">
        <button onClick={() => setTab('errors')} className={tabCls(tab === 'errors')}>{t.coach.top20errors}</button>
        <button onClick={() => setTab('consults')} className={tabCls(tab === 'consults')}>{t.coach.top20consults}</button>
      </div>
      {tab === 'errors' ? (
        <>
          <p className="text-[0.62rem] text-warm-500 mb-1.5">{t.coach.clickHandDetail}</p>
          <div className="space-y-0.5 max-h-[460px] overflow-y-auto pr-1">
            {errors.length === 0 ? (
              <p className="text-xs text-warm-500 py-2">{t.coach.noData}</p>
            ) : errors.map((c, i) => (
              <button
                key={c.hand}
                onClick={() => onSelect(c.hand)}
                className={`group w-full flex items-center gap-1.5 text-xs rounded px-1 py-0.5 cursor-pointer transition-colors ${selected === c.hand ? 'bg-warm-800 ring-1 ring-brand-500/50' : 'hover:bg-warm-800/60'}`}
              >
                <span className="text-warm-600 w-3.5 text-right tabular-nums text-[0.65rem]">{i + 1}</span>
                <span className="px-1.5 py-0.5 rounded text-[0.7rem] font-bold text-white" style={{ background: confChipBg(c.accuracy), textShadow: '0 0 3px rgba(0,0,0,0.6)' }}>{c.hand}</span>
                <span className="flex-1 truncate text-left text-[0.66rem] text-warm-500">{c.correctAction ?? '—'}{c.topWrong ? ` → ${c.topWrong.action}` : ''}</span>
                <span className={`font-bold ${accColor(c.accuracy)}`}>{c.accuracy}%</span>
                <span className={`text-xs ${selected === c.hand ? 'text-brand-400' : 'text-warm-600 group-hover:text-warm-300'}`}>›</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="max-h-[460px] overflow-y-auto pr-1">
          {consults.length === 0 ? (
            <p className="text-xs text-warm-500 py-2">{t.coach.noData}</p>
          ) : (
            <table className="w-full text-sm">
              <Top20TableHead sortKey={consultSortKey} sortDir={consultSortDir} onSort={handleConsultSort} />
              <tbody>
                {consults.map((c, i) => (
                  <tr
                    key={c.hand}
                    onClick={() => onSelect(c.hand)}
                    className={`cursor-pointer transition-colors ${selected === c.hand ? 'bg-warm-800' : 'hover:bg-warm-800/60'}`}
                  >
                    <td className="text-warm-600 text-right tabular-nums text-[0.62rem] pr-1 py-0.5">{i + 1}</td>
                    <td className="py-0.5 pr-2">
                      <span className="px-1.5 py-0.5 rounded text-[0.7rem] font-bold text-white" style={{ background: confChipBg(c.accuracy), textShadow: '0 0 3px rgba(0,0,0,0.6)' }}>{c.hand}</span>
                    </td>
                    <td className="text-right text-warm-300 text-[0.68rem] pl-2 tabular-nums">{c.total}x</td>
                    <td className="text-right text-warm-300 text-[0.68rem] pl-2 tabular-nums">{Math.round(consultValue(c, 'pct') * 10) / 10}%</td>
                    <td className="text-right font-bold text-warm-200 text-[0.7rem] pl-2 tabular-nums">{c.consults}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
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

interface Filters {
  playerIds: number[]
  rangeId: number | null
  days: number | null
  from: number | null
  to: number | null
}

function setDateParams(qs: URLSearchParams, f: { days: number | null; from?: number | null; to?: number | null }) {
  if (f.from != null && f.to != null) { qs.set('from', String(f.from)); qs.set('to', String(f.to)) }
  else if (f.days !== null) qs.set('days', String(f.days))
}

function toDateInput(unix: number): string {
  const d = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function PeriodFilter({ days, from, to, onChange }: {
  days: number | null
  from: number | null
  to: number | null
  onChange: (v: { days: number | null; from: number | null; to: number | null }) => void
}) {
  const isCustom = from != null && to != null
  const [custom, setCustom] = useState(isCustom)
  const [start, setStart] = useState(isCustom ? toDateInput(from!) : '')
  const [end, setEnd] = useState(isCustom ? toDateInput(to!) : '')
  const selectCls = 'bg-warm-900 border border-warm-600 rounded-lg px-2.5 py-1.5 text-sm text-warm-100'
  const dateCls = 'bg-warm-900 border border-warm-600 rounded-lg px-2 py-1.5 text-sm text-warm-100'

  const apply = (s: string, e: string) => {
    if (!s || !e) return
    const f = Math.floor(new Date(`${s}T00:00:00`).getTime() / 1000)
    const t = Math.floor(new Date(`${e}T23:59:59`).getTime() / 1000)
    if (Number.isNaN(f) || Number.isNaN(t) || f > t) return
    onChange({ days: null, from: f, to: t })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={t.coach.period}
        className={selectCls}
        value={custom ? 'custom' : (days ?? '')}
        onChange={e => {
          const v = e.target.value
          if (v === 'custom') { setCustom(true); apply(start, end) }
          else { setCustom(false); onChange({ days: v ? Number(v) : null, from: null, to: null }) }
        }}
      >
        <option value="">{t.coach.periodAll}</option>
        <option value="7">{t.coach.period7}</option>
        <option value="30">{t.coach.period30}</option>
        <option value="90">{t.coach.period90}</option>
        <option value="custom">{t.coach.periodCustom}</option>
      </select>
      {custom && (
        <div className="flex items-center gap-1.5">
          <input type="date" aria-label={t.coach.dateStart} value={start} max={end || undefined}
            onChange={e => { setStart(e.target.value); apply(e.target.value, end) }} className={dateCls} />
          <span className="text-warm-500 text-xs">→</span>
          <input type="date" aria-label={t.coach.dateEnd} value={end} min={start || undefined}
            onChange={e => { setEnd(e.target.value); apply(start, e.target.value) }} className={dateCls} />
        </div>
      )}
    </div>
  )
}

function useAnalytics<T>(view: string, filters: Filters, token: string | null) {
  const [rows, setRows] = useState<T[]>([])
  const [team, setTeam] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const idsKey = filters.playerIds.join(',')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ view })
    if (idsKey) qs.set('playerIds', idsKey)
    if (filters.rangeId !== null) qs.set('rangeId', String(filters.rangeId))
    setDateParams(qs, filters)
    fetchAnalyticsCached(`/api/admin/analytics?${qs.toString()}`, token)
      .then(d => {
        if (cancelled) return
        setRows(d.rows ?? [])
        setTeam(d.team ?? null)
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        captureError(e, { area: 'coach-analytics', view })
        setError(t.coach.loadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [view, token, idsKey, filters.rangeId, filters.days, filters.from, filters.to, tick])

  return { rows, team, loading, error, reload: () => { invalidateAnalyticsCache(); setTick(t => t + 1) } }
}

function useRangeGrid(rangeId: number | null, days: number | null, from: number | null, to: number | null, playerIds: number[], stackIdx: number | null, token: string | null) {
  const [cells, setCells] = useState<GridCell[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const idsKey = playerIds.join(',')

  useEffect(() => {
    if (!token || rangeId === null) { setCells([]); return }
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ view: 'range-grid', rangeId: String(rangeId) })
    if (idsKey) qs.set('playerIds', idsKey)
    if (stackIdx !== null) qs.set('stackGridIdx', String(stackIdx))
    setDateParams(qs, { days, from, to })
    fetchAnalyticsCached(`/api/admin/analytics?${qs.toString()}`, token)
      .then(d => { if (!cancelled) { setCells(d.cells ?? []); setLoading(false) } })
      .catch(e => { if (!cancelled) { captureError(e, { area: 'coach-range-grid', view: 'range-grid' }); setError(t.coach.loadError); setLoading(false) } })
    return () => { cancelled = true }
  }, [token, rangeId, days, from, to, idsKey, stackIdx])

  return { cells, loading, error }
}

interface UserOpt { id: number; username: string; name: string }

interface PlayerRangeApiRow { userId: number; rangeId: number; rangeName: string; total: number; correct: number }

function usePlayerRanges(filters: Filters, token: string | null) {
  const [rows, setRows] = useState<PlayerRangeApiRow[]>([])
  const [users, setUsers] = useState<UserOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const idsKey = filters.playerIds.join(',')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ view: 'player-ranges' })
    if (idsKey) qs.set('playerIds', idsKey)
    if (filters.rangeId !== null) qs.set('rangeId', String(filters.rangeId))
    setDateParams(qs, filters)
    fetchAnalyticsCached(`/api/admin/analytics?${qs.toString()}`, token)
      .then(d => { if (!cancelled) { setRows(d.rows ?? []); setUsers(d.users ?? []); setLoading(false) } })
      .catch(e => { if (!cancelled) { captureError(e, { area: 'coach-analytics', view: 'player-ranges' }); setError(t.coach.loadError); setLoading(false) } })
    return () => { cancelled = true }
  }, [token, idsKey, filters.rangeId, filters.days, filters.from, filters.to, tick])

  return { rows, users, loading, error, reload: () => { invalidateAnalyticsCache(); setTick(t => t + 1) } }
}


function Section({ title, loading, error, empty, children, defaultOpen = true, onRetry }: {
  title: string
  loading: boolean
  error: string
  empty: boolean
  children: React.ReactNode
  defaultOpen?: boolean
  onRetry?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-warm-700 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-warm-800/40 hover:bg-warm-800 transition-colors"
      >
        <h3 className="text-sm font-semibold text-warm-200">{title}</h3>
        <span className="text-warm-400 text-xs select-none">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        loading ? (
          <div className="px-3 py-3 space-y-2" role="status" aria-busy="true" aria-label="Carregando">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-400 px-3 py-3">
            {error}
            {onRetry && (
              <button onClick={onRetry} className="ml-2 underline font-semibold hover:text-red-300">{t.coach.retry}</button>
            )}
          </p>
        ) : empty ? (
          <p className="text-sm text-warm-500 px-3 py-3">{t.coach.noData}</p>
        ) : (
          <div className="overflow-x-auto border-t border-warm-700">{children}</div>
        )
      )}
    </div>
  )
}

const TH = 'text-left font-semibold px-2.5 py-1.5'
const THR = 'text-right font-semibold px-2.5 py-1.5'
const TD = 'px-2.5 py-1.5'
const TDR = 'px-2.5 py-1.5 text-right tabular-nums'

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
  const [resetting, setResetting] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleResetPassword() {
    if (!token || resetting) return
    if (!confirm(t.coach.resetConfirm)) return
    setResetting(true)
    setResetError(null)
    setTempPassword(null)
    setCopied(false)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) { setResetError(data?.error ?? `Erro do servidor (${res.status})`); return }
      setTempPassword(data.tempPassword)
    } catch (e) {
      captureError(e, { area: 'admin-reset-password' })
      setResetError(t.coach.loadError)
    } finally {
      setResetting(false)
    }
  }

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

  const resetBlock = (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleResetPassword}
          disabled={resetting}
          className="px-2.5 py-1 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 hover:text-white disabled:opacity-40 transition-colors"
        >
          {resetting ? t.coach.resetting : t.coach.resetPassword}
        </button>
        {resetError && <span className="text-xs text-red-400">{resetError}</span>}
      </div>
      {tempPassword && (
        <div className="rounded-xl border border-brand-600/50 bg-warm-800/60 p-3">
          <p className="text-xs text-warm-400 mb-1.5">{t.coach.tempPassword}</p>
          <div className="flex items-center gap-2">
            <code className="text-lg font-bold tracking-widest text-brand-300 select-all">{tempPassword}</code>
            <button
              onClick={() => { navigator.clipboard?.writeText(tempPassword); setCopied(true) }}
              className="px-2.5 py-1 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 transition-colors"
            >
              {copied ? t.coach.copied : t.coach.copy}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="px-4 py-3 space-y-3 bg-warm-900/50 border-t border-warm-700/60">
        {resetBlock}
        <p className="text-xs text-warm-500">{t.coach.loadingSummary}</p>
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="px-4 py-3 space-y-3 bg-warm-900/50 border-t border-warm-700/60">
        {resetBlock}
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
      {resetBlock}
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
  const { sortKey, sortDir, handleSort } = useTop20Sort()

  if (loading) return <div className="px-4 py-3 text-xs text-warm-500">{t.coach.loading}</div>
  if (error) return <div className="px-4 py-3 text-xs text-red-400">{error}</div>

  const top20 = rows
    .filter(r => r.consults > 0)
    .sort((a, b) => (sortDir === 'asc' ? 1 : -1) * (a[sortKey] - b[sortKey]))
    .slice(0, 20)
  if (top20.length === 0) return <div className="px-4 py-3 text-xs text-warm-500">{t.coach.noData}</div>

  return (
    <div className="px-4 py-3 bg-warm-900/50 border-t border-warm-700/60">
      <p className="text-[0.62rem] text-warm-500 mb-1.5 uppercase font-semibold tracking-wider">{t.coach.top20consults}</p>
      <div className="w-fit max-w-[360px] max-h-[460px] overflow-y-auto">
        <table className="text-sm">
          <Top20TableHead sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <tbody>
            {top20.map((r, i) => (
              <tr key={r.hand} className="border-t border-warm-800/60">
                <td className="text-warm-600 text-right tabular-nums text-[0.62rem] pr-1 py-0.5">{i + 1}</td>
                <td className="py-0.5 pr-2">
                  <span className="px-1.5 py-0.5 rounded text-[0.7rem] font-bold text-white" style={{ background: CONSULT_CHIP_BG, textShadow: '0 0 3px rgba(0,0,0,0.6)' }}>{r.hand}</span>
                </td>
                <td className="text-right text-warm-300 text-[0.68rem] pl-2 tabular-nums">{r.played}x</td>
                <td className="text-right text-warm-300 text-[0.68rem] pl-2 tabular-nums">{r.pct}%</td>
                <td className="text-right font-bold text-warm-200 text-[0.7rem] pl-2 tabular-nums">{r.consults}x</td>
              </tr>
            ))}
          </tbody>
        </table>
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

function TeamView({ token }: { token: string | null }) {
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
        <table className="w-full text-sm">
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

function RecallView({ token }: { token: string | null }) {
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

function PublishTeamRanges() {
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

function ConfirmDangerModal({ title, description, confirmLabel, danger = true, busy, error, onConfirm, onCancel }: {
  title: string
  description: React.ReactNode
  confirmLabel: string
  danger?: boolean
  busy: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialogRef = useModalA11y<HTMLDivElement>(true, onCancel)
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-danger-title"
        onClick={e => e.stopPropagation()}
        className={`bg-warm-900 border rounded-2xl p-5 max-w-sm w-full space-y-3 ${danger ? 'border-red-900/60' : 'border-warm-700'}`}
      >
        <h3 id="confirm-danger-title" className="text-base font-bold text-warm-100 flex items-center gap-2">
          {danger && <span className="text-red-400" aria-hidden="true">⚠</span>} {title}
        </h3>
        <div className="text-sm text-warm-300 space-y-1.5">{description}</div>
        {danger && <p className="text-xs font-semibold text-red-400">{t.coach.cannotUndo}</p>}
        {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3.5 py-2 rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 disabled:opacity-40 text-sm font-semibold transition-colors"
          >
            {t.coach.cancelAction}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 text-white ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-600 hover:bg-brand-500'}`}
          >
            {busy ? t.coach.confirming : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface InviteCode {
  id: number
  code: string
  created_at: number
  used_at: number | null
  used_by_id: number | null
  used_by_username: string | null
  used_by_name: string | null
}

type PendingAction =
  | { type: 'reset'; userId: number; label: string }
  | { type: 'delete'; userId: number; label: string }
  | { type: 'edit'; userId: number; label: string; before: { name: string; email: string }; after: { name: string; email: string } }

export function AdminView({ token }: { token: string | null }) {
  const [users, setUsers] = useState<CoachUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ username: '', name: '', email: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createResult, setCreateResult] = useState<{ username: string; tempPassword: string } | null>(null)

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; email: string } | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<{ userId: number; tempPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [codes, setCodes] = useState<InviteCode[]>([])
  const [codesLoading, setCodesLoading] = useState(true)
  const [codesError, setCodesError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)

  const loadUsers = useCallback(() => {
    if (!token) return
    setLoading(true)
    setLoadError('')
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setUsers(d.users ?? []))
      .catch(() => setLoadError(t.coach.loadError))
      .finally(() => setLoading(false))
  }, [token])

  const loadCodes = useCallback(() => {
    if (!token) return
    setCodesLoading(true)
    setCodesError('')
    fetch('/api/admin/invite-codes', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setCodes(d.codes ?? []))
      .catch(() => setCodesError(t.coach.loadError))
      .finally(() => setCodesLoading(false))
  }, [token])

  useEffect(() => { loadUsers() }, [loadUsers])
  useEffect(() => { loadCodes() }, [loadCodes])

  async function handleGenerateCode() {
    if (!token || generating) return
    setGenerating(true)
    setGenerateError(null)
    setNewCode(null)
    try {
      const res = await fetch('/api/admin/create-invite-code', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) { setGenerateError(data?.error ?? `${t.coach.loadError} (${res.status})`); return }
      setNewCode(data.code)
      loadCodes()
    } catch (e) {
      captureError(e, { area: 'admin-create-invite-code' })
      setGenerateError(t.coach.loadError)
    } finally {
      setGenerating(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!token || creating) return
    setCreating(true)
    setCreateError(null)
    setCreateResult(null)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) { setCreateError(data?.error ?? `${t.coach.loadError} (${res.status})`); return }
      setCreateResult({ username: createForm.username, tempPassword: data.tempPassword })
      setCreateForm({ username: '', name: '', email: '' })
      loadUsers()
    } catch (e) {
      captureError(e, { area: 'admin-create-user' })
      setCreateError(t.coach.loadError)
    } finally {
      setCreating(false)
    }
  }

  function toggleExpand(u: CoachUser) {
    const opening = expandedId !== u.id
    setExpandedId(opening ? u.id : null)
    setEditForm(null)
    setActionError(null)
    if (opening) { setResetResult(null); setCopied(false) }
  }

  function startEdit(u: CoachUser) {
    setEditForm({ name: u.name, email: u.email })
    setActionError(null)
  }

  function requestSaveEdit(u: CoachUser) {
    if (!editForm) return
    if (!editForm.name.trim() || !ADMIN_EMAIL_RE.test(editForm.email)) return
    setPendingAction({
      type: 'edit', userId: u.id, label: u.name || u.username,
      before: { name: u.name, email: u.email },
      after: { name: editForm.name.trim(), email: editForm.email.trim() },
    })
  }

  async function confirmPendingAction() {
    if (!pendingAction || !token) return
    setActionBusy(true)
    setActionError(null)
    try {
      if (pendingAction.type === 'reset') {
        const res = await fetch('/api/admin/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: pendingAction.userId }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) { setActionError(data?.error ?? `${t.coach.loadError} (${res.status})`); return }
        setResetResult({ userId: pendingAction.userId, tempPassword: data.tempPassword })
        setCopied(false)
      } else if (pendingAction.type === 'delete') {
        const res = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: pendingAction.userId }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) { setActionError(data?.error ?? `${t.coach.loadError} (${res.status})`); return }
        setUsers(u => u.filter(x => x.id !== pendingAction.userId))
        setExpandedId(null)
      } else {
        const res = await fetch('/api/admin/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: pendingAction.userId, ...pendingAction.after }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) { setActionError(data?.error ?? `${t.coach.loadError} (${res.status})`); return }
        setUsers(u => u.map(x => x.id === pendingAction.userId ? { ...x, ...pendingAction.after } : x))
        setEditForm(null)
      }
      setPendingAction(null)
    } catch (e) {
      captureError(e, { area: `admin-${pendingAction.type}` })
      setActionError(t.coach.loadError)
    } finally {
      setActionBusy(false)
    }
  }

  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t.coach.searchPlaceholder}
          className="px-3 py-2 rounded-lg bg-warm-800 border border-warm-700 text-warm-100 text-sm placeholder:text-warm-500 focus:outline-none focus:border-brand-500"
        />
        <button
          onClick={() => { setShowCreate(o => !o); setCreateError(null); setCreateResult(null) }}
          className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
        >
          {showCreate ? t.coach.cancelCreate : t.coach.createAccount}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-warm-700 bg-warm-800/40 p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-new-username" className="text-[0.7rem] font-semibold text-warm-500 uppercase tracking-wide">{t.coach.newUsername}</label>
            <input
              id="admin-new-username"
              required
              value={createForm.username}
              onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
              className="px-2.5 py-1.5 rounded-lg bg-warm-800 border border-warm-600 text-warm-100 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-new-name" className="text-[0.7rem] font-semibold text-warm-500 uppercase tracking-wide">{t.coach.newName}</label>
            <input
              id="admin-new-name"
              required
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              className="px-2.5 py-1.5 rounded-lg bg-warm-800 border border-warm-600 text-warm-100 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-new-email" className="text-[0.7rem] font-semibold text-warm-500 uppercase tracking-wide">{t.coach.newEmail}</label>
            <input
              id="admin-new-email"
              type="email"
              value={createForm.email}
              onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
              className="px-2.5 py-1.5 rounded-lg bg-warm-800 border border-warm-600 text-warm-100 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            {creating ? t.coach.creating : t.coach.confirmCreate}
          </button>
          {createError && <span className="text-xs text-red-400 w-full">{createError}</span>}
          {createResult && (
            <div className="w-full rounded-xl border border-brand-600/50 bg-warm-800/60 p-3">
              <p className="text-xs text-warm-400 mb-1.5">{t.coach.accountCreated(createResult.username)}</p>
              <div className="flex items-center gap-2">
                <code className="text-lg font-bold tracking-widest text-brand-300 select-all">{createResult.tempPassword}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(createResult.tempPassword)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 transition-colors"
                >
                  {t.coach.copy}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      <Section title={t.coach.accountsTitle} loading={loading} error={loadError} empty={filtered.length === 0} onRetry={loadUsers}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              <th className={TH}>{t.coach.colPlayer}</th>
              <th className={TH}>{t.coach.newEmail}</th>
              <th className={THR}>{t.coach.colHands}</th>
              <th className={THR}>{t.coach.colAccuracy}</th>
              <th className={THR}>{t.coach.createdAt}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const acc = u.total_hands > 0 && u.correct_hands !== null ? Math.round((u.correct_hands / u.total_hands) * 100) : null
              const isOpen = expandedId === u.id
              const isEditing = isOpen && !!editForm
              return (
                <Fragment key={u.id}>
                  <tr
                    onClick={() => toggleExpand(u)}
                    className={`border-t border-warm-700/60 cursor-pointer transition-colors ${isOpen ? 'bg-warm-800/70' : 'hover:bg-warm-800/50'}`}
                  >
                    <td className={`${TD} text-warm-100 font-semibold`}>
                      <span className={`inline-block w-3 text-warm-600 text-[0.6rem] ${isOpen ? 'text-brand-400' : ''}`}>{isOpen ? '▾' : '▸'}</span>
                      {u.name || u.username}
                    </td>
                    <td className={`${TD} text-warm-400`}>{u.email || '—'}</td>
                    <td className={`${TDR} text-warm-300`}>{u.total_hands}</td>
                    <td className={`${TDR} ${acc !== null ? accColor(acc) : 'text-warm-500'}`}>{acc !== null ? `${acc}%` : '—'}</td>
                    <td className={`${TDR} text-warm-500`}>{formatDateShort(u.created_at)}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <div className="px-4 py-3 space-y-3 bg-warm-900/50 border-t border-warm-700/60" onClick={e => e.stopPropagation()}>
                          {!isEditing ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => startEdit(u)}
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 hover:text-warm-100 transition-colors"
                              >
                                {t.coach.editData}
                              </button>
                              <button
                                onClick={() => setPendingAction({ type: 'reset', userId: u.id, label: u.name || u.username })}
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 hover:text-warm-100 transition-colors"
                              >
                                {t.coach.resetPassword}
                              </button>
                              <button
                                onClick={() => setPendingAction({ type: 'delete', userId: u.id, label: u.name || u.username })}
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-red-900/60 text-red-400 hover:bg-red-950/40 transition-colors"
                              >
                                {t.coach.deleteAccount}
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-end gap-3">
                              <div className="flex flex-col gap-1">
                                <label htmlFor={`admin-edit-name-${u.id}`} className="text-[0.7rem] font-semibold text-warm-500 uppercase tracking-wide">{t.coach.newName}</label>
                                <input
                                  id={`admin-edit-name-${u.id}`}
                                  value={editForm.name}
                                  onChange={e => setEditForm(f => f && ({ ...f, name: e.target.value }))}
                                  className="px-2.5 py-1.5 rounded-lg bg-warm-800 border border-warm-600 text-warm-100 text-sm focus:outline-none focus:border-brand-500"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label htmlFor={`admin-edit-email-${u.id}`} className="text-[0.7rem] font-semibold text-warm-500 uppercase tracking-wide">{t.coach.newEmail}</label>
                                <input
                                  id={`admin-edit-email-${u.id}`}
                                  type="email"
                                  value={editForm.email}
                                  onChange={e => setEditForm(f => f && ({ ...f, email: e.target.value }))}
                                  className="px-2.5 py-1.5 rounded-lg bg-warm-800 border border-warm-600 text-warm-100 text-sm focus:outline-none focus:border-brand-500"
                                />
                              </div>
                              <button
                                onClick={() => requestSaveEdit(u)}
                                disabled={!editForm.name.trim() || !ADMIN_EMAIL_RE.test(editForm.email)}
                                className="px-3 py-1.5 text-xs rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-semibold transition-colors"
                              >
                                {t.coach.saveChanges}
                              </button>
                              <button
                                onClick={() => setEditForm(null)}
                                className="px-3 py-1.5 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 transition-colors"
                              >
                                {t.coach.cancelEdit}
                              </button>
                            </div>
                          )}
                          {actionError && <p className="text-xs text-red-400">{actionError}</p>}
                          {resetResult?.userId === u.id && (
                            <div className="rounded-xl border border-brand-600/50 bg-warm-800/60 p-3 inline-flex items-center gap-2">
                              <span className="text-xs text-warm-400">{t.coach.tempPassword}</span>
                              <code className="text-lg font-bold tracking-widest text-brand-300 select-all">{resetResult.tempPassword}</code>
                              <button
                                onClick={() => { navigator.clipboard?.writeText(resetResult.tempPassword); setCopied(true) }}
                                className="px-2.5 py-1 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-700 transition-colors"
                              >
                                {copied ? t.coach.copied : t.coach.copy}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </Section>

      <Section title={t.coach.inviteCodesTitle} loading={codesLoading} error={codesError} empty={false} onRetry={loadCodes} defaultOpen={false}>
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerateCode}
              disabled={generating}
              className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {generating ? t.coach.generating : t.coach.generateCode}
            </button>
            {generateError && <span className="text-xs text-red-400">{generateError}</span>}
            {newCode && (
              <div className="rounded-xl border border-brand-600/50 bg-warm-800/60 px-3 py-1.5 inline-flex items-center gap-2">
                <code className="text-base font-bold tracking-widest text-brand-300 select-all">{newCode}</code>
                <button
                  onClick={() => navigator.clipboard?.writeText(newCode)}
                  className="px-2 py-0.5 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-700 transition-colors"
                >
                  {t.coach.copy}
                </button>
              </div>
            )}
          </div>
          {codes.length === 0 ? <p className="text-sm text-warm-500">{t.coach.noData}</p> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
                  <th className={TH}>{t.coach.colCode}</th>
                  <th className={TH}>{t.coach.colStatus}</th>
                  <th className={THR}>{t.coach.createdAt}</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.id} className="border-t border-warm-700/60">
                    <td className={`${TD} font-mono text-warm-100 font-semibold tracking-wide`}>{c.code}</td>
                    <td className={`${TD}`}>
                      {c.used_by_id ? (
                        <span className="text-warm-300">{t.coach.codeUsedBy(c.used_by_name || c.used_by_username || '')}</span>
                      ) : (
                        <span className="text-warm-500">{t.coach.codeUnused}</span>
                      )}
                    </td>
                    <td className={`${TDR} text-warm-500`}>{formatDateShort(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      {pendingAction && (
        <ConfirmDangerModal
          title={
            pendingAction.type === 'reset' ? t.coach.confirmResetTitle
              : pendingAction.type === 'delete' ? t.coach.confirmDeleteTitle
              : t.coach.confirmEditTitle
          }
          danger={pendingAction.type !== 'edit'}
          confirmLabel={
            pendingAction.type === 'reset' ? t.coach.resetPassword
              : pendingAction.type === 'delete' ? t.coach.deleteAccount
              : t.coach.saveChanges
          }
          busy={actionBusy}
          error={actionError}
          onCancel={() => { setPendingAction(null); setActionError(null) }}
          onConfirm={confirmPendingAction}
          description={
            pendingAction.type === 'reset' ? <p>{t.coach.confirmResetDesc(pendingAction.label)}</p>
              : pendingAction.type === 'delete' ? <p>{t.coach.confirmDeleteDesc(pendingAction.label)}</p>
              : (
                <div className="space-y-1">
                  {pendingAction.before.name !== pendingAction.after.name && (
                    <p>{t.coach.newName}: <span className="text-warm-500 line-through">{pendingAction.before.name}</span> → <span className="text-warm-100 font-semibold">{pendingAction.after.name}</span></p>
                  )}
                  {pendingAction.before.email !== pendingAction.after.email && (
                    <p>{t.coach.newEmail}: <span className="text-warm-500 line-through">{pendingAction.before.email}</span> → <span className="text-warm-100 font-semibold">{pendingAction.after.email}</span></p>
                  )}
                </div>
              )
          }
        />
      )}
    </div>
  )
}

export default function CoachPanel() {
  const authToken = useStore(s => s.authToken)
  const [area, setArea] = useState<'drill' | 'recall' | 'admin'>('drill')

  return (
    <div className="space-y-4">
      <PublishTeamRanges />
      <div className="flex gap-1 border-b border-warm-700">
        {([
          { key: 'drill', label: t.coach.tabDrill },
          { key: 'recall', label: t.coach.tabRecall },
          { key: 'admin', label: t.coach.tabAdmin },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setArea(tab.key)}
            className={[
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              area === tab.key ? 'border-brand-500 text-warm-100' : 'border-transparent text-warm-400 hover:text-warm-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {area === 'drill' ? <TeamView token={authToken} /> : area === 'recall' ? <RecallView token={authToken} /> : <AdminView token={authToken} />}
    </div>
  )
}
