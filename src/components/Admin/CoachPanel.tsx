import { Fragment, useEffect, useMemo, useRef, useState, useCallback, memo } from 'react'
import { countRender } from '../../test/renderCount'
import { Skeleton } from '../ui/Skeleton'
import { captureError } from '../../utils/sentry'
import { useStore } from '../../store/useStore'
import { RangeHeatGrid, type GridCell } from './RangeHeatGrid'
import { RangeActionGrid, type ActionFreq } from './RangeActionGrid'
import { rangeComboStats, TOTAL_COMBOS, type ComboStats } from '../../utils/rangeCombos'

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
      <div>Abertura: <span className="text-brand-300 font-semibold">{stats.openPct.toFixed(1)}%</span> <span className="text-warm-500">({Math.round(stats.openCombos)} de 1326 combos)</span></div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {items.length === 0 ? <span className="text-warm-600">Sem ações</span> : items.map(x => (
          <span key={x.label}><span className={`font-semibold ${ACTION_COLOR[x.label]}`}>{x.label}</span> {pct(x.v).toFixed(1)}%</span>
        ))}
      </div>
    </div>
  )
}
import { rankLeaks, rankKnowledgeGaps, severityProfile, type Confidence, type SeverityClass } from '../../utils/coachStats'
import { buildTrend, aggregateTeamBuckets, type PlayerTrend, type TrendDir, type WeekBucket } from '../../utils/coachTrend'
import { aggregateSegments, type HandRow } from '../../utils/handCategories'
import { buildRelativeLeaks, type PlayerRangeStat } from '../../utils/coachRelative'

const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'EP', 'LJ', 'UTG']

interface RangeOpt { id: number; name: string; positions?: string[]; stackGrids?: { stackRange: string; name?: string }[] }
function groupRangesByPosition(ranges: RangeOpt[]) {
  const groups = new Map<string, RangeOpt[]>()
  for (const r of ranges) {
    const pos = r.positions?.[0] ?? 'Outros'
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
  const label = selected.length === 0 ? 'Todos os jogadores' : selected.length === 1 ? nameOf(selected[0]) : `${selected.length} jogadores`
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  const q = query.trim().toLowerCase()
  const shownUsers = q ? users.filter(u => (u.name || '').toLowerCase().includes(q) || u.username.toLowerCase().includes(q)) : users

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filtrar jogadores"
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
            placeholder="Buscar jogador…"
            aria-label="Buscar jogador"
            className="w-full bg-warm-950 border border-warm-700 rounded px-2 py-1.5 text-sm text-warm-100 placeholder-warm-500 mb-1"
            autoFocus
          />
          <button
            onClick={() => onChange([])}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${selected.length === 0 ? 'text-brand-300 font-semibold' : 'text-warm-300 hover:bg-warm-800'}`}
          >
            Todos os jogadores
          </button>
          <div className="h-px bg-warm-700 my-1" />
          <div role="group" aria-label="Jogadores">
            {shownUsers.length === 0 && <p className="px-2 py-1.5 text-xs text-warm-500">Nenhum jogador.</p>}
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
  const label = selected ? selected.name : 'Todos os ranges'

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
        aria-label="Filtrar por range"
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
            placeholder="Buscar range…"
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
                Todos os ranges
              </button>
            ) })()}
            {flatIds.length === 1 && <p className="px-2 py-1.5 text-xs text-warm-500">Nenhum range.</p>}
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

type CoachTab = 'hands' | 'consults' | 'sessions'

interface CoachDetailRow {
  hand?: string
  range_name?: string
  range_names?: string
  action_taken?: string
  correct_action?: string
  is_correct?: number | boolean
  severity?: string
  created_at?: number
  count?: number
  ended_at?: number
  hands?: number
  correct?: number
  errors?: number
  consults?: number
  duration_seconds?: number
}

const TAB_LABELS: Record<CoachTab, string> = { hands: 'Mãos', consults: 'Consultas', sessions: 'Sessões' }

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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

function parseRangeNames(raw: string): string {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.join(', ') : String(raw)
  } catch {
    return String(raw)
  }
}

function accColor(acc: number): string {
  return acc >= 80 ? 'text-emerald-400' : acc >= 50 ? 'text-yellow-400' : 'text-red-400'
}

function confChipBg(acc: number): string {
  if (acc >= 80) return 'rgba(34,197,94,0.9)'
  if (acc >= 50) return 'rgba(202,138,4,0.9)'
  return 'rgba(220,38,38,0.92)'
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
        <button onClick={() => setTab('errors')} className={tabCls(tab === 'errors')}>Top 20 erros</button>
        <button onClick={() => setTab('consults')} className={tabCls(tab === 'consults')}>Top 20 consultas</button>
      </div>
      <p className="text-[0.62rem] text-warm-500 mb-1.5">Clique numa mão para ver o detalhe →</p>
      <div className="space-y-0.5 max-h-[460px] overflow-y-auto pr-1">
        {list.length === 0 ? (
          <p className="text-xs text-warm-500 py-2">Sem dados.</p>
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
        <Stat label="Tentativas" v={cell.total} />
        <Stat label="Acertos" v={cell.correct} cls="text-emerald-300" />
        <Stat label="Blunder" v={cell.graves} cls="text-red-400" />
        <Stat label="Consultas" v={cell.consults} cls="text-purple-300" />
      </div>
      <div className="text-xs space-y-0.5">
        <div className="text-emerald-300">✓ Correto: {cell.correctAction ?? '—'}</div>
        <div className="text-red-300">✗ Erram mais: {cell.topWrong ? `${cell.topWrong.action} (${cell.topWrong.n}x)` : '—'}</div>
      </div>
      {pp && (
        <div>
          <p className="text-[0.7rem] text-warm-400 mb-1">Como o time jogou esta mão</p>
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
  const dateCls = 'bg-warm-900 border border-warm-600 rounded-lg px-2 py-1.5 text-sm text-warm-100 [color-scheme:dark]'

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
        aria-label="Período"
        className={selectCls}
        value={custom ? 'custom' : (days ?? '')}
        onChange={e => {
          const v = e.target.value
          if (v === 'custom') { setCustom(true); apply(start, end) }
          else { setCustom(false); onChange({ days: v ? Number(v) : null, from: null, to: null }) }
        }}
      >
        <option value="">Tudo</option>
        <option value="7">7 dias</option>
        <option value="30">30 dias</option>
        <option value="90">90 dias</option>
        <option value="custom">Custom</option>
      </select>
      {custom && (
        <div className="flex items-center gap-1.5">
          <input type="date" aria-label="Data inicial" value={start} max={end || undefined}
            onChange={e => { setStart(e.target.value); apply(e.target.value, end) }} className={dateCls} />
          <span className="text-warm-500 text-xs">→</span>
          <input type="date" aria-label="Data final" value={end} min={start || undefined}
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
    fetch(`/api/admin/analytics?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => {
        if (cancelled) return
        setRows(d.rows ?? [])
        setTeam(d.team ?? null)
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        captureError(e, { area: 'coach-analytics', view })
        setError('Erro ao carregar')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [view, token, idsKey, filters.rangeId, filters.days, filters.from, filters.to, tick])

  return { rows, team, loading, error, reload: () => setTick(t => t + 1) }
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
    fetch(`/api/admin/analytics?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => { if (!cancelled) { setCells(d.cells ?? []); setLoading(false) } })
      .catch(e => { if (!cancelled) { captureError(e, { area: 'coach-range-grid', view: 'range-grid' }); setError('Erro ao carregar'); setLoading(false) } })
    return () => { cancelled = true }
  }, [token, rangeId, days, from, to, idsKey, stackIdx])

  return { cells, loading, error }
}

interface TrendRow { userId: number; week: number; hands: number; correct: number }
interface TrendUser { id: number; username: string; name: string }

function useTrend(filters: Filters, token: string | null) {
  const [rows, setRows] = useState<TrendRow[]>([])
  const [users, setUsers] = useState<TrendUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const idsKey = filters.playerIds.join(',')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ view: 'trend' })
    if (idsKey) qs.set('playerIds', idsKey)
    if (filters.rangeId !== null) qs.set('rangeId', String(filters.rangeId))
    setDateParams(qs, filters)
    fetch(`/api/admin/analytics?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => {
        if (cancelled) return
        setRows(d.rows ?? [])
        setUsers(d.users ?? [])
        setLoading(false)
      })
      .catch(e => { if (!cancelled) { captureError(e, { area: 'coach-analytics', view: 'trend' }); setError('Erro ao carregar'); setLoading(false) } })
    return () => { cancelled = true }
  }, [token, idsKey, filters.rangeId, filters.days, filters.from, filters.to, tick])

  return { rows, users, loading, error, reload: () => setTick(t => t + 1) }
}

interface ActionRow { action: string; total: number; correct: number; graves: number; imprecisos: number; accuracy: number }

function useSegments(filters: Filters, token: string | null) {
  const [byHand, setByHand] = useState<HandRow[]>([])
  const [byAction, setByAction] = useState<ActionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const idsKey = filters.playerIds.join(',')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ view: 'segments' })
    if (idsKey) qs.set('playerIds', idsKey)
    if (filters.rangeId !== null) qs.set('rangeId', String(filters.rangeId))
    setDateParams(qs, filters)
    fetch(`/api/admin/analytics?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => {
        if (cancelled) return
        setByHand(d.byHand ?? [])
        setByAction(d.byAction ?? [])
        setLoading(false)
      })
      .catch(e => { if (!cancelled) { captureError(e, { area: 'coach-analytics', view: 'segments' }); setError('Erro ao carregar'); setLoading(false) } })
    return () => { cancelled = true }
  }, [token, idsKey, filters.rangeId, filters.days, filters.from, filters.to, tick])

  return { byHand, byAction, loading, error, reload: () => setTick(t => t + 1) }
}

interface PlayerRangeApiRow { userId: number; rangeId: number; rangeName: string; total: number; correct: number }

function usePlayerRanges(filters: Filters, token: string | null) {
  const [rows, setRows] = useState<PlayerRangeApiRow[]>([])
  const [users, setUsers] = useState<TrendUser[]>([])
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
    fetch(`/api/admin/analytics?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => { if (!cancelled) { setRows(d.rows ?? []); setUsers(d.users ?? []); setLoading(false) } })
      .catch(e => { if (!cancelled) { captureError(e, { area: 'coach-analytics', view: 'player-ranges' }); setError('Erro ao carregar'); setLoading(false) } })
    return () => { cancelled = true }
  }, [token, idsKey, filters.rangeId, filters.days, filters.from, filters.to, tick])

  return { rows, users, loading, error, reload: () => setTick(t => t + 1) }
}

const TREND_META: Record<TrendDir, { label: string; arrow: string; cls: string }> = {
  improving: { label: 'melhorando', arrow: '▲', cls: 'text-emerald-400' },
  regressing: { label: 'regredindo', arrow: '▼', cls: 'text-red-400' },
  stable: { label: 'estável', arrow: '▬', cls: 'text-warm-400' },
  insufficient: { label: 'sem base', arrow: '–', cls: 'text-warm-600' },
}

function TrendBadge({ t }: { t: PlayerTrend }) {
  const m = TREND_META[t.classification]
  const sign = t.slope > 0 ? '+' : ''
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${m.cls}`}>
      <span>{m.arrow}</span>
      <span>{m.label}</span>
      {t.classification !== 'insufficient' && (
        <span className="text-warm-500 font-normal">{sign}{t.slope}pp/sem</span>
      )}
    </span>
  )
}

function Sparkline({ weeks, width = 120, height = 30 }: { weeks: { week: number; accuracy: number }[]; width?: number; height?: number }) {
  if (weeks.length === 0) return <span className="text-warm-600 text-xs">—</span>
  const xs = weeks.map(w => w.week)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const spanX = maxX - minX || 1
  const pad = 3
  const px = (week: number) => pad + ((week - minX) / spanX) * (width - 2 * pad)
  const py = (acc: number) => pad + (1 - acc / 100) * (height - 2 * pad)
  const y80 = py(80)
  if (weeks.length === 1) {
    return (
      <svg width={width} height={height} className="overflow-visible">
        <line x1={0} x2={width} y1={y80} y2={y80} stroke="rgba(255,255,255,0.12)" strokeDasharray="2 2" />
        <circle cx={px(weeks[0].week)} cy={py(weeks[0].accuracy)} r={2.5} fill="#60a5fa" />
      </svg>
    )
  }
  const d = weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${px(w.week).toFixed(1)},${py(w.accuracy).toFixed(1)}`).join(' ')
  const last = weeks[weeks.length - 1]
  return (
    <svg width={width} height={height} className="overflow-visible">
      <line x1={0} x2={width} y1={y80} y2={y80} stroke="rgba(255,255,255,0.12)" strokeDasharray="2 2" />
      <path d={d} fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(last.week)} cy={py(last.accuracy)} r={2.3} fill="#60a5fa" />
    </svg>
  )
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
              <button onClick={onRetry} className="ml-2 underline font-semibold hover:text-red-300">Tentar novamente</button>
            )}
          </p>
        ) : empty ? (
          <p className="text-sm text-warm-500 px-3 py-3">Sem dados.</p>
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

const CONF_DOT: Record<Confidence, { cls: string; title: string }> = {
  low: { cls: 'bg-red-400', title: 'Amostra pequena (<15) — pouca confiança' },
  medium: { cls: 'bg-yellow-400', title: 'Amostra média (15–49)' },
  high: { cls: 'bg-emerald-400', title: 'Amostra robusta (≥50)' },
}
interface GapRow { rangeId: number; rangeName: string; hand: string; consults: number; total: number; correct: number; graves: number; imprecisos: number }
interface ByRangeRow { rangeId: number; rangeName: string; hands: number; accuracy: number; graves: number; imprecisos: number; consults: number; players: number }

const SEVERITY_META: Record<SeverityClass, { label: string; cls: string }> = {
  conceitual: { label: 'Conceitual', cls: 'text-red-300' },
  misto: { label: 'Misto', cls: 'text-yellow-300' },
  'estrategia-mista': { label: 'Estratégia mista', cls: 'text-sky-300' },
  na: { label: '—', cls: 'text-warm-600' },
}

const SEVERITY_HELP: Record<SeverityClass, string> = {
  conceitual: 'Conceitual: erra a ação certa (escolhe jogada com 0% de freq) — não sabe o range.',
  'estrategia-mista': 'Estratégia mista: escolhe ação válida, mas não a principal — só erra a frequência.',
  misto: 'Misto: mistura de erros conceituais e de estratégia mista.',
  na: '',
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
    fetch(`/api/admin/analytics?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId, days, from, to, token])

  if (loading) return <div className="px-4 py-3 text-xs text-warm-500">Carregando resumo…</div>
  if (rows.length === 0) return <div className="px-4 py-3 text-xs text-warm-500">Sem dados de range para este jogador.</div>

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
    <div className="grid gap-5 md:grid-cols-3 px-4 py-3 bg-warm-900/50 border-t border-warm-700/60">
      <Col title="Mais treinados" items={treinados} render={r => <span className="text-warm-200">{r.hands} mãos</span>} />
      <Col title="Onde mais erra" items={piores} render={r => <span className={accColor(r.accuracy)}>{r.accuracy}%</span>} />
      <Col title="Mais consultados" items={consultados} render={r => <span className="text-purple-300">{r.consults}x</span>} />
    </div>
  )
}

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
  const sm = SEVERITY_META[sev.classification]
  return (
    <tr
      onClick={() => onSelect(r.rangeId)}
      className={`border-t border-warm-700/60 cursor-pointer hover:bg-warm-800/50 ${selected ? 'bg-warm-800/70' : ''}`}
    >
      <td className={`${TD} text-warm-100 font-semibold whitespace-nowrap`}>{r.rangeName}</td>
      <td className={`${TDR} text-warm-300`}>{r.hands}</td>
      <td className={`${TDR} font-bold ${accColor(r.accuracy)}`}>{r.accuracy}%</td>
      <td className={`${TDR} text-red-400`}>{r.graves}</td>
      <td className={`${TD} whitespace-nowrap`} title={SEVERITY_HELP[sev.classification] || undefined}>
        <span className={`font-semibold ${sm.cls}`}>{sm.label}</span>
        {sev.classification !== 'na' && (
          <span className="block text-[0.65rem] text-warm-500">{r.graves} blunders · {r.imprecisos} imprecisos</span>
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
  const trend = useTrend(filters, token)
  const segments = useSegments(filters, token)
  const gaps = useAnalytics<GapRow>('knowledge-gaps', filters, token)
  const playerRanges = usePlayerRanges(filters, token)
  const grid = useRangeGrid(filters.rangeId, filters.days, filters.from, filters.to, filters.playerIds, stackIdx, token)

  const relativeLeaks = useMemo(() => {
    const nameOf = (id: number) => { const u = playerRanges.users.find(x => x.id === id); return u ? (u.name || u.username) : `#${id}` }
    const stats: PlayerRangeStat[] = playerRanges.rows.map(r => ({
      userId: r.userId, name: nameOf(r.userId), rangeId: r.rangeId, rangeName: r.rangeName, total: r.total, correct: r.correct,
    }))
    return buildRelativeLeaks(stats).slice(0, 40)
  }, [playerRanges.rows, playerRanges.users])

  const categorySegs = useMemo(() => aggregateSegments(segments.byHand), [segments.byHand])
  const rankedGaps = useMemo(() => rankKnowledgeGaps(gaps.rows).slice(0, 40), [gaps.rows])

  const playerTrends = useMemo(() => {
    const byUser = new Map<number, WeekBucket[]>()
    for (const r of trend.rows) {
      if (!byUser.has(r.userId)) byUser.set(r.userId, [])
      byUser.get(r.userId)!.push({ week: r.week, hands: r.hands, correct: r.correct })
    }
    const nameOf = (id: number) => { const u = trend.users.find(x => x.id === id); return u ? (u.name || u.username) : `#${id}` }
    const order: Record<TrendDir, number> = { regressing: 0, stable: 1, improving: 2, insufficient: 3 }
    return [...byUser.entries()]
      .map(([userId, buckets]) => ({ userId, name: nameOf(userId), trend: buildTrend(buckets) }))
      .sort((a, b) =>
        order[a.trend.classification] - order[b.trend.classification] ||
        a.trend.slope - b.trend.slope ||
        a.name.localeCompare(b.name))
  }, [trend.rows, trend.users])

  const teamTrend = useMemo(
    () => buildTrend(aggregateTeamBuckets(trend.rows.map(r => ({ week: r.week, hands: r.hands, correct: r.correct })))),
    [trend.rows],
  )

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3" style={{ order: -2 }}>
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

      <Section title="Por range" defaultOpen={false} loading={byRange.loading} error={byRange.error} empty={byRange.rows.length === 0} onRetry={byRange.reload}>
        <div className="px-3 py-1.5 text-[11px] text-warm-500 bg-warm-800/30 border-b border-warm-700/60 leading-relaxed">
          Clique no cabeçalho para ordenar · clique numa linha para ver a matriz do range. Tipo de erro:{' '}
          <span className="text-red-300 font-semibold">Conceitual</span> = erra a ação certa (joga 0% de freq), não sabe o range ·{' '}
          <span className="text-sky-300 font-semibold">Estratégia mista</span> = ação válida, mas não a principal, só erra a frequência ·{' '}
          <span className="text-yellow-300 font-semibold">Misto</span> = mistura dos dois.
        </div>
        <table className="text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              <th className={TH}>Range</th>
              {([
                { k: 'hands', label: 'Mãos' },
                { k: 'accuracy', label: 'Precisão' },
                { k: 'graves', label: 'Blunder' },
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
              <th className={TH}>Tipo de erro</th>
              {([
                { k: 'consults', label: 'Consultas' },
                { k: 'players', label: 'Jogadores' },
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

      <Section title="Resumo do time" defaultOpen={false} loading={overview.loading} error={overview.error} empty={overview.rows.length === 0} onRetry={overview.reload}>
        <div className="px-3 py-1.5 text-[11px] text-warm-500 bg-warm-800/30 border-b border-warm-700/60">
          Clique no cabeçalho para ordenar · clique num jogador para o resumo rápido.
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              {([
                { k: 'name', label: 'Jogador', align: 'l' },
                { k: 'hands', label: 'Mãos', align: 'r' },
                { k: 'accuracy', label: 'Precisão', align: 'r' },
                { k: 'graves', label: 'Blunder', align: 'r' },
                { k: 'consults', label: 'Consultas', align: 'r' },
                { k: 'durationSeconds', label: 'Tempo', align: 'r' },
                { k: 'lastActivity', label: 'Última ativ.', align: 'r' },
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
                <td className={`${TD} text-white`}><span className="inline-block w-3" />TIME</td>
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


      <Section title="Evolução (tendência semanal)" defaultOpen={false} loading={trend.loading} error={trend.error} empty={playerTrends.length === 0} onRetry={trend.reload}>
        <div className="p-3 flex flex-col gap-3">
          <div className="flex items-center gap-4 rounded-lg bg-warm-800/40 border border-warm-700/60 px-3 py-2">
            <span className="text-xs font-semibold text-warm-300 uppercase w-20">Time</span>
            <Sparkline weeks={teamTrend.weeks} width={160} height={34} />
            <div className="flex flex-col">
              <TrendBadge t={teamTrend} />
              {teamTrend.firstAccuracy !== null && (
                <span className="text-[11px] text-warm-500">
                  {teamTrend.weeks.length} sem · {teamTrend.firstAccuracy}% → {teamTrend.lastAccuracy}%
                </span>
              )}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
                <th className={TH}>Jogador</th>
                <th className={TH}>Evolução</th>
                <th className={THR}>Início → Fim</th>
                <th className={TH}>Tendência</th>
              </tr>
            </thead>
            <tbody>
              {playerTrends.map(p => (
                <tr key={p.userId} className={`border-t border-warm-700/60 ${p.trend.classification === 'regressing' ? 'bg-red-950/30' : ''}`}>
                  <td className={`${TD} text-warm-100 font-semibold`}>{p.name}</td>
                  <td className={TD}><Sparkline weeks={p.trend.weeks} /></td>
                  <td className={`${TDR} text-warm-300`}>
                    {p.trend.firstAccuracy !== null ? `${p.trend.firstAccuracy}% → ${p.trend.lastAccuracy}%` : '—'}
                  </td>
                  <td className={TD}><TrendBadge t={p.trend} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Maiores leaks" defaultOpen={false} loading={leaks.loading} error={leaks.error} empty={rankedLeaks.length === 0} onRetry={leaks.reload}>
        <div className="px-3 py-1.5 text-[11px] text-warm-500 bg-warm-800/30 border-b border-warm-700/60">
          Ordenado por <span className="text-warm-300">impacto</span> (erros ponderados por gravidade). Precisão mostra o piso de confiança (mín = limite inferior de Wilson 95%); o ponto indica o tamanho da amostra.
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
              <th className={TH}>Mão</th>
              <th className={TH}>Range</th>
              <th className={THR}>Tent.</th>
              <th className={THR}>Precisão (mín)</th>
              <th className={THR}>Blunder</th>
              <th className={THR}>Impacto</th>
            </tr>
          </thead>
          <tbody>
            {rankedLeaks.map((r, i) => {
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
                  <td className={`${TDR} font-bold text-orange-300`}>{Math.round(r.impact * 10) / 10}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Segmentos (categoria e ação correta)" defaultOpen={false} loading={segments.loading} error={segments.error} empty={categorySegs.length === 0 && segments.byAction.length === 0} onRetry={segments.reload}>
        <div className="p-3 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs text-warm-400 mb-2 uppercase font-semibold">Por categoria de mão</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-800 text-warm-400 text-[11px] uppercase">
                  <th className={TH}>Categoria</th>
                  <th className={THR}>Mãos</th>
                  <th className={THR}>Precisão</th>
                  <th className={THR}>Blunder</th>
                  <th className={THR}>Impacto</th>
                </tr>
              </thead>
              <tbody>
                {categorySegs.map(s => (
                  <tr key={s.segment} className="border-t border-warm-700/60">
                    <td className={`${TD} text-warm-100 font-semibold`}>{s.segment}</td>
                    <td className={`${TDR} text-warm-300`}>{s.total}</td>
                    <td className={`${TDR} font-bold ${accColor(s.accuracy)}`}>{s.accuracy}%</td>
                    <td className={`${TDR} text-red-400`}>{s.graves}</td>
                    <td className={`${TDR} font-bold text-orange-300`}>{Math.round(s.impact * 10) / 10}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="text-xs text-warm-400 mb-2 uppercase font-semibold">Por ação correta</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-800 text-warm-400 text-[11px] uppercase">
                  <th className={TH}>Ação correta</th>
                  <th className={THR}>Mãos</th>
                  <th className={THR}>Precisão</th>
                  <th className={THR}>Blunder</th>
                </tr>
              </thead>
              <tbody>
                {segments.byAction.map(a => (
                  <tr key={a.action} className="border-t border-warm-700/60">
                    <td className={`${TD} text-warm-100 font-semibold`}>{a.action}</td>
                    <td className={`${TDR} text-warm-300`}>{a.total}</td>
                    <td className={`${TDR} font-bold ${accColor(a.accuracy)}`}>{a.accuracy}%</td>
                    <td className={`${TDR} text-red-400`}>{a.graves}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section title="Lacunas de conhecimento (consulta × erro)" defaultOpen={false} loading={gaps.loading} error={gaps.error} empty={rankedGaps.length === 0} onRetry={gaps.reload}>
        <div className="px-3 py-1.5 text-[11px] text-warm-500 bg-warm-800/30 border-b border-warm-700/60">
          Mãos que o time mais <span className="text-warm-300">consulta E ainda erra</span> — lacuna real de conhecimento. Score = consultas × taxa de erro ponderada.
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
              <th className={TH}>Mão</th>
              <th className={TH}>Range</th>
              <th className={THR}>Consultas</th>
              <th className={THR}>Precisão (mín)</th>
              <th className={THR}>Blunder</th>
              <th className={THR}>Score</th>
            </tr>
          </thead>
          <tbody>
            {rankedGaps.map((r, i) => {
              const dot = CONF_DOT[r.confidence]
              return (
                <tr key={i} className="border-t border-warm-700/60">
                  <td className={`${TD} text-warm-100 font-bold`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot.cls}`} title={dot.title} />
                      {r.hand}
                    </span>
                  </td>
                  <td className={`${TD} text-warm-300`}>{r.rangeName}</td>
                  <td className={`${TDR} text-violet-300`}>{r.consults}</td>
                  <td className={`${TDR} font-bold ${r.total > 0 ? accColor(r.accuracy) : 'text-warm-500'}`}>
                    {r.total > 0 ? <>{r.accuracy}% <span className="text-warm-500 font-normal text-xs">({r.accuracyLower}%)</span></> : '—'}
                  </td>
                  <td className={`${TDR} text-red-400`}>{r.graves}</td>
                  <td className={`${TDR} font-bold text-orange-300`}>{r.score}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>


      <Section title="Leaks relativos (jogador vs time)" defaultOpen={false} loading={playerRanges.loading} error={playerRanges.error} empty={relativeLeaks.length === 0} onRetry={playerRanges.reload}>
        <div className="px-3 py-1.5 text-[11px] text-warm-500 bg-warm-800/30 border-b border-warm-700/60">
          Onde cada jogador está <span className="text-warm-300">abaixo dos colegas</span> no mesmo range (z-score). Considera jogadores com ≥15 mãos e ranges com ≥3 jogadores. Selecione vários jogadores para comparar.
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
              <th className={TH}>Jogador</th>
              <th className={TH}>Range</th>
              <th className={THR}>Mãos</th>
              <th className={THR}>Precisão</th>
              <th className={THR}>Média time</th>
              <th className={THR}>Δ</th>
              <th className={THR}>z</th>
            </tr>
          </thead>
          <tbody>
            {relativeLeaks.map((r, i) => (
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

      <div style={{ order: -1 }}>
        <h3 className="text-sm font-semibold text-warm-200 mb-2">
          Matriz do range {selectedRangeName ? <span className="text-brand-400">· {selectedRangeName}</span> : ''}
          {filters.playerIds.length > 0 && <span className="text-warm-500 text-xs font-normal"> · {filters.playerIds.length} jogador(es)</span>}
        </h3>
        {filters.rangeId !== null && selectedStackGrids.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="text-xs text-warm-500 mr-1">Stack efetivo:</span>
            <button
              onClick={() => setStackIdx(null)}
              className={[
                'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
                stackIdx === null ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:text-warm-200',
              ].join(' ')}
            >
              Todos
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
          <p className="text-sm text-warm-500">Selecione um range no filtro acima (ou clique numa linha da tabela "Por range") para ver a matriz 13×13.</p>
        ) : grid.loading ? (
          <p className="text-sm text-warm-500">Carregando…</p>
        ) : grid.error ? (
          <p className="text-sm text-red-400">{grid.error}</p>
        ) : grid.cells.length === 0 ? (
          <p className="text-sm text-warm-500">Sem dados para este range no período/jogador selecionado.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 text-[0.7rem] text-warm-400">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: '#ef4444' }} />Raise</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: '#22c55e' }} />Call</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: '#6b2d0d' }} />All-in</span>
              <span className="text-warm-600">·  fundo escuro = Fold</span>
            </div>
            <div className="flex items-start gap-6">
              <div className="flex flex-wrap items-start gap-6 flex-1 min-w-0">
                <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-4">
                  <RangeActionGrid title="Range real (gabarito)" subtitle="o que o range manda jogar" grid={realGrid} />
                  <ComboSummary stats={comboReal} />
                </div>
                <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-4">
                  <RangeActionGrid title="Range jogado (time)" subtitle="frequências do que jogaram de fato" grid={playedGrid} />
                  <ComboSummary stats={comboPlayed} />
                </div>
              </div>
              <div className="flex items-start gap-4 shrink-0">
                <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-4">
                  <h4 className="text-xs font-semibold text-warm-200 mb-2">Precisão / erros</h4>
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
    </div>
  )
}

function PlayersView({ token }: { token: string | null }) {
  const [users, setUsers] = useState<CoachUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<CoachTab>('hands')
  const [detail, setDetail] = useState<CoachDetailRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetResult, setResetResult] = useState<{ userId: number; tempPassword: string } | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Erro ao carregar usuários'))))
      .then(data => setUsers(data.users ?? []))
      .catch(() => setError('Erro ao carregar usuários'))
  }, [token])

  useEffect(() => { setResetResult(null); setResetError(null); setCopied(false) }, [selectedUserId])

  async function handleResetPassword(userId: number) {
    if (!token || resetting) return
    if (!confirm('Resetar a senha deste jogador? A senha atual deixará de funcionar e ele precisará usar a senha temporária.')) return
    setResetting(true)
    setResetError(null)
    setResetResult(null)
    setCopied(false)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) { setResetError(data?.error ?? `Erro do servidor (${res.status})`); return }
      setResetResult({ userId, tempPassword: data.tempPassword })
    } catch (e) {
      captureError(e, { area: 'admin-reset-password' })
      setResetError('Erro de conexão')
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    if (!token || selectedUserId === null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/user/${selectedUserId}?tab=${activeTab}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Erro ao carregar dados'))))
      .then(data => { if (!cancelled) setDetail(data.data ?? []) })
      .catch(() => { if (!cancelled) setError('Erro ao carregar dados') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, selectedUserId, activeTab])

  const selectedUser = users.find(u => u.id === selectedUserId)
  const accuracyOf = (u: CoachUser) =>
    u.total_hands > 0 ? `${Math.round(((u.correct_hands ?? 0) / u.total_hands) * 100)}%` : '-'

  return (
    <div className="flex h-[calc(100vh-160px)] bg-warm-950 text-warm-100 rounded-2xl border border-warm-700/50 overflow-hidden">
      <div className="w-64 border-r border-warm-700/50 overflow-y-auto">
        <h2 className="px-4 py-3 text-sm font-semibold text-warm-300 border-b border-warm-700/50">Jogadores</h2>
        {users.length === 0 ? (
          <p className="px-4 py-4 text-sm text-warm-500">Nenhum jogador cadastrado ainda.</p>
        ) : (
          users.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className={`w-full text-left px-4 py-3 border-b border-warm-800 transition-colors ${selectedUserId === u.id ? 'bg-warm-800' : 'hover:bg-warm-900'}`}
            >
              <span className="block text-sm font-medium text-warm-100">{u.name || u.username}</span>
              <span className="block text-xs text-warm-500">{u.username}</span>
              <span className="block text-xs text-warm-400">{u.total_hands} mãos · {accuracyOf(u)}</span>
            </button>
          ))
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {!selectedUser ? (
          <p className="text-sm text-warm-500">Selecione um jogador.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold text-white">{selectedUser.name || selectedUser.username}</h2>
                <p className="text-sm text-warm-400 mb-3">{selectedUser.username}{selectedUser.email ? ` · ${selectedUser.email}` : ''}</p>
              </div>
              <button
                onClick={() => handleResetPassword(selectedUser.id)}
                disabled={resetting}
                className="px-3 py-1.5 text-sm rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 hover:text-white disabled:opacity-40 transition-colors"
              >
                {resetting ? 'Resetando…' : 'Resetar senha'}
              </button>
            </div>

            {resetError && <p className="text-sm text-red-400 mb-3">{resetError}</p>}
            {resetResult && resetResult.userId === selectedUser.id && (
              <div className="mb-4 rounded-xl border border-brand-600/50 bg-warm-800/60 p-3">
                <p className="text-xs text-warm-400 mb-1.5">Senha temporária — repasse ao jogador. Ele definirá uma nova senha no próximo acesso.</p>
                <div className="flex items-center gap-2">
                  <code className="text-lg font-bold tracking-widest text-brand-300 select-all">{resetResult.tempPassword}</code>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(resetResult.tempPassword); setCopied(true) }}
                    className="px-2.5 py-1 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 transition-colors"
                  >
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-1 mb-4">
              {(['hands', 'consults', 'sessions'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${activeTab === tab ? 'border-brand-500 text-brand-300 bg-warm-800' : 'border-warm-600 text-warm-300 hover:bg-warm-800'}`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            {loading ? (
              <p className="text-sm text-warm-500">Carregando...</p>
            ) : detail.length === 0 ? (
              <p className="text-sm text-warm-500">Sem dados.</p>
            ) : activeTab === 'hands' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-warm-400 border-b border-warm-700">
                    <th className="py-2 pr-3">Mão</th>
                    <th className="py-2 pr-3">Range</th>
                    <th className="py-2 pr-3">Ação</th>
                    <th className="py-2 pr-3">Correto</th>
                    <th className="py-2 pr-3">Acertou</th>
                    <th className="py-2 pr-3">Severidade</th>
                    <th className="py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((row, i) => (
                    <tr key={i} className="border-b border-warm-800">
                      <td className="py-2 pr-3 font-medium">{row.hand}</td>
                      <td className="py-2 pr-3 text-warm-300">{row.range_name}</td>
                      <td className="py-2 pr-3">{row.action_taken}</td>
                      <td className="py-2 pr-3">{row.correct_action}</td>
                      <td className={`py-2 pr-3 ${row.is_correct ? 'text-green-400' : 'text-red-400'}`}>{row.is_correct ? 'Sim' : 'Não'}</td>
                      <td className="py-2 pr-3 text-warm-400">{row.severity ?? ''}</td>
                      <td className="py-2 text-warm-400">{formatDate(row.created_at ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeTab === 'consults' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-warm-400 border-b border-warm-700">
                    <th className="py-2 pr-3">Range</th>
                    <th className="py-2 pr-3">Mão</th>
                    <th className="py-2">Consultas</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((row, i) => (
                    <tr key={i} className="border-b border-warm-800">
                      <td className="py-2 pr-3 text-warm-300">{row.range_name}</td>
                      <td className="py-2 pr-3">{row.hand ?? '-'}</td>
                      <td className="py-2">{row.count}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-warm-400 border-b border-warm-700">
                    <th className="py-2 pr-3">Ranges</th>
                    <th className="py-2 pr-3">Mãos</th>
                    <th className="py-2 pr-3">Acerto</th>
                    <th className="py-2 pr-3">Erros</th>
                    <th className="py-2 pr-3">Consultas</th>
                    <th className="py-2 pr-3">Duração</th>
                    <th className="py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((row, i) => (
                    <tr key={i} className="border-b border-warm-800">
                      <td className="py-2 pr-3 text-warm-300">{parseRangeNames(row.range_names ?? '')}</td>
                      <td className="py-2 pr-3">{row.hands}</td>
                      <td className="py-2 pr-3">{(row.hands ?? 0) > 0 ? `${Math.round(((row.correct ?? 0) / (row.hands ?? 1)) * 100)}%` : '-'}</td>
                      <td className="py-2 pr-3">{row.errors}</td>
                      <td className="py-2 pr-3">{row.consults}</td>
                      <td className="py-2 pr-3">{formatDuration(row.duration_seconds ?? 0)}</td>
                      <td className="py-2 text-warm-400">{formatDate(row.ended_at ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
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
    if (!confirm(`Publicar ${rangeCount} range(s) para o time no D1? Os jogadores recebem essa versão no próximo login.`)) return
    setPublishing(true)
    setMsg(null)
    const res = await publishTeamRanges()
    setPublishing(false)
    setMsg(res.ok
      ? { ok: true, text: `Publicado: ${res.count} range(s) · versão ${res.version}` }
      : { ok: false, text: res.error ?? 'Falha ao publicar' })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handlePublish}
        disabled={publishing}
        className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
      >
        {publishing ? 'Publicando…' : 'Publicar ranges para o time (D1)'}
      </button>
      {msg && <span className={msg.ok ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>{msg.text}</span>}
    </div>
  )
}

export default function CoachPanel() {
  const authToken = useStore(s => s.authToken)
  const [area, setArea] = useState<'team' | 'players'>('team')

  return (
    <div className="space-y-4">
      <PublishTeamRanges />
      <div className="flex gap-1 border-b border-warm-700">
        {([
          { key: 'team', label: 'Visão do time' },
          { key: 'players', label: 'Por jogador' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setArea(t.key)}
            className={[
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              area === t.key ? 'border-brand-500 text-white' : 'border-transparent text-warm-400 hover:text-warm-200',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {area === 'team' ? <TeamView token={authToken} /> : <PlayersView token={authToken} />}
    </div>
  )
}
