import { useEffect, useRef, useState } from 'react'
import { Skeleton } from '../../ui/Skeleton'
import { captureError } from '../../../utils/sentry'
import { fetchAnalyticsCached, invalidateAnalyticsCache } from '../../../utils/analyticsCache'
import { t } from '../../../i18n'
import type { GridCell } from '../RangeHeatGrid'

export const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'EP', 'LJ', 'UTG']

export interface RangeOpt { id: number; name: string; positions?: string[]; stackGrids?: { stackRange: string; name?: string }[] }
export function groupRangesByPosition(ranges: RangeOpt[]) {
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

export function MultiPlayerSelect({ users, selected, onChange }: {
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

export function RangeSelect({ groups, value, onChange }: {
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

export interface CoachUser {
  id: number
  username: string
  name: string
  email: string
  created_at: number
  total_hands: number
  correct_hands: number | null
}

export function formatDate(unix: number): string {
  if (!unix) return '—'
  const d = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDateShort(unix: number): string {
  if (!unix) return '—'
  const d = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

export function accColor(acc: number): string {
  return acc >= 80 ? 'text-emerald-400' : acc >= 50 ? 'text-yellow-400' : 'text-red-400'
}

export function confChipBg(acc: number): string {
  if (acc >= 80) return 'rgba(34,197,94,0.9)'
  if (acc >= 50) return 'rgba(202,138,4,0.9)'
  return 'rgba(220,38,38,0.92)'
}

export interface Filters {
  playerIds: number[]
  rangeId: number | null
  days: number | null
  from: number | null
  to: number | null
}

export function setDateParams(qs: URLSearchParams, f: { days: number | null; from?: number | null; to?: number | null }) {
  if (f.from != null && f.to != null) { qs.set('from', String(f.from)); qs.set('to', String(f.to)) }
  else if (f.days !== null) qs.set('days', String(f.days))
}

export function toDateInput(unix: number): string {
  const d = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function PeriodFilter({ days, from, to, onChange }: {
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

export function useAnalytics<T>(view: string, filters: Filters, token: string | null) {
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

export function useRangeGrid(rangeId: number | null, days: number | null, from: number | null, to: number | null, playerIds: number[], stackIdx: number | null, token: string | null) {
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

export interface UserOpt { id: number; username: string; name: string }

export interface PlayerRangeApiRow { userId: number; rangeId: number; rangeName: string; total: number; correct: number }

export function usePlayerRanges(filters: Filters, token: string | null) {
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

export function Section({ title, loading, error, empty, children, defaultOpen = true, onRetry }: {
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

export const TH = 'text-left font-semibold px-2.5 py-1.5'
export const THR = 'text-right font-semibold px-2.5 py-1.5'
export const TD = 'px-2.5 py-1.5'
export const TDR = 'px-2.5 py-1.5 text-right tabular-nums'
