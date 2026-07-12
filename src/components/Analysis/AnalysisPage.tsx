import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { RangeHeatGrid, type GridCell } from '../Admin/RangeHeatGrid'
import { RangeActionGrid, type ActionFreq } from '../Admin/RangeActionGrid'
import { BuildAccountStats } from '../Stats/BuildAccountStats'
import { rangeComboStats } from '../../utils/rangeCombos'
import { rankLeaks } from '../../utils/coachStats'
import { captureError } from '../../utils/sentry'
import { t } from '../../i18n'
import {
  groupRangesByPosition, RangeSelect, accColor,
  type Filters, PeriodFilter, useAnalytics, useRangeGrid, useBuildRangeGrid,
  Section, TH, THR, TD, TDR,
} from '../Admin/CoachPanel/shared'
import {
  ComboSummary, TopHandsPanel, HandDetailCard, ConsultRangeDetail,
  CONF_DOT,
  type LeakRow, type ByRangeRow, type ConsultRangeRow,
} from '../Admin/CoachPanel/TeamView'

const ME_ANALYTICS = '/api/me/analytics'

type ByRangeSortKey = 'hands' | 'accuracy' | 'graves' | 'consults'
type LeaksSortKey = 'hand' | 'rangeName' | 'total' | 'accuracyLower' | 'graves' | 'imprecisos' | 'impact'
type ConsultSortKey = 'rangeName' | 'totalConsults' | 'rate' | 'totalPlayed'

interface BuildByRangeRow {
  rangeId: number
  rangeName: string
  attempts: number
  avgScore: number
  correctHands?: number
  wrongHands?: number
}
type BuildByRangeSortKey = 'attempts' | 'correctHands' | 'wrongHands' | 'avgScore'

function useBuildByRangeRows(token: string | null) {
  const [rows, setRows] = useState<BuildByRangeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetch('/api/me/stats?view=build-by-range', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false) } })
      .catch(e => {
        if (cancelled) return
        captureError(e, { area: 'analysis-build-by-range' })
        setError(t.coach.loadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [token, tick])

  return { rows, loading, error, reload: () => setTick(n => n + 1) }
}
type AnalysisTab = 'drill' | 'buildcheck'

// Reconstrói o "range jogado" a partir das somas de played (cell.played) — usado
// tanto pelo Drill (contagens de vezes que cada ação foi escolhida) quanto pelo
// Range Check (soma de % por tentativa, que normalizada dá a média corretamente).
function computePlayedGrid(cells: GridCell[]): Record<string, ActionFreq> {
  const out: Record<string, ActionFreq> = {}
  for (const c of cells) {
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
}

const sortBtn = (active: boolean, dir: 'asc' | 'desc', label: string, onClick: () => void, alignRight = true) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1 hover:text-warm-100 transition-colors ${alignRight ? 'flex-row-reverse' : ''} ${active ? 'text-brand-300' : ''}`}
  >
    {label}
    <span className="text-[0.6rem] w-2">{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
  </button>
)

export function AnalysisPage() {
  const currentUser = useStore(s => s.currentUser)
  const authToken = useStore(s => s.authToken)
  const [tab, setTab] = useState<AnalysisTab>('drill')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display uppercase text-warm-100 text-[28px] leading-none tracking-wide">{t.analysis.title}</h1>
        <p className="text-xs text-warm-400 mt-1">{t.analysis.intro}</p>
      </div>
      {currentUser && authToken ? (
        <>
          <div className="flex border-b border-warm-700">
            {([
              { key: 'drill' as const, label: t.drill.title },
              { key: 'buildcheck' as const, label: t.exercise.navLabel },
            ]).map(tb => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={[
                  'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
                  tab === tb.key ? 'border-brand-500 text-warm-100' : 'border-transparent text-warm-400 hover:text-warm-200',
                ].join(' ')}
              >
                {tb.label}
              </button>
            ))}
          </div>
          {tab === 'drill' ? <DrillAnalysisContent /> : <RangeCheckAnalysisContent />}
        </>
      ) : (
        <div className="text-center py-20 max-w-md mx-auto">
          <BarChart3 size={32} className="mx-auto text-warm-600 mb-4" aria-hidden />
          <p className="text-warm-200 text-sm font-semibold">{t.analysis.loggedOutTitle}</p>
          <p className="text-warm-500 text-xs mt-1.5">{t.analysis.loggedOutHint}</p>
        </div>
      )}
    </div>
  )
}

function DrillAnalysisContent() {
  const ranges = useStore(s => s.ranges)
  const token = useStore(s => s.authToken)
  const [filters, setFilters] = useState<Filters>({ playerIds: [], rangeId: null, days: null, from: null, to: null })
  const [stackIdx, setStackIdx] = useState<number | null>(null)
  const [detailHand, setDetailHand] = useState<string | null>(null)
  const [brSortKey, setBrSortKey] = useState<ByRangeSortKey>('hands')
  const [brSortDir, setBrSortDir] = useState<'asc' | 'desc'>('desc')
  const [leaksSortKey, setLeaksSortKey] = useState<LeaksSortKey>('impact')
  const [leaksSortDir, setLeaksSortDir] = useState<'asc' | 'desc'>('desc')
  const [consultSortKey, setConsultSortKey] = useState<ConsultSortKey>('rate')
  const [consultSortDir, setConsultSortDir] = useState<'asc' | 'desc'>('desc')
  const [openConsultRange, setOpenConsultRange] = useState<number | null>(null)

  const rangeGroups = useMemo(() => groupRangesByPosition(ranges), [ranges])

  const byRange = useAnalytics<ByRangeRow>('by-range', filters, token, ME_ANALYTICS)
  const leaks = useAnalytics<LeakRow>('leaks', filters, token, ME_ANALYTICS)
  const consultRanges = useAnalytics<ConsultRangeRow>('consult-by-range', filters, token, ME_ANALYTICS)
  const grid = useRangeGrid(filters.rangeId, filters.days, filters.from, filters.to, [], stackIdx, token, ME_ANALYTICS)

  const setRangeId = useCallback((rangeId: number | null) => {
    setFilters(f => ({ ...f, rangeId }))
    setStackIdx(null)
    setDetailHand(null)
  }, [])

  const selectedRange = ranges.find(r => r.id === filters.rangeId)
  const selectedRangeName = selectedRange?.name ?? ''
  const selectedStackGrids = selectedRange?.stackGrids ?? []

  const realGrid = useMemo<Record<string, ActionFreq>>(() => {
    if (!selectedRange) return {}
    const sg = stackIdx !== null ? selectedRange.stackGrids?.[stackIdx]?.grid : undefined
    return (sg ?? selectedRange.grid ?? {}) as Record<string, ActionFreq>
  }, [selectedRange, stackIdx])

  const playedGrid = useMemo(() => computePlayedGrid(grid.cells), [grid.cells])

  const comboReal = useMemo(() => rangeComboStats(realGrid), [realGrid])
  const comboPlayed = useMemo(() => rangeComboStats(playedGrid), [playedGrid])
  const detailCell = detailHand ? grid.cells.find(c => c.hand === detailHand) : undefined

  const rankedLeaks = useMemo(() => rankLeaks(leaks.rows), [leaks.rows])

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

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-warm-700 bg-warm-900/30 p-4 flex flex-wrap gap-6">
        <div>
          <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide mb-1.5">{t.coach.period}:</p>
          <PeriodFilter
            days={filters.days}
            from={filters.from}
            to={filters.to}
            onChange={d => setFilters(f => ({ ...f, ...d }))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide mb-1.5">{t.coach.colRanges}:</p>
          <RangeSelect groups={rangeGroups} value={filters.rangeId} onChange={setRangeId} />
        </div>
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
                  <RangeActionGrid title={t.coach.actionGridPlayedTitleSelf} subtitle={t.coach.actionGridPlayedSubSelf} grid={playedGrid} />
                  <ComboSummary stats={comboPlayed} />
                </div>
              </div>
              <div className="flex flex-wrap xl:flex-nowrap items-start gap-4 xl:shrink-0">
                <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-4">
                  <h3 className="text-xs font-semibold text-warm-200 mb-2">{t.coach.accuracyErrors}</h3>
                  <RangeHeatGrid cells={grid.cells} />
                </div>
                <TopHandsPanel cells={grid.cells} selected={detailHand} onSelect={h => setDetailHand(h === detailHand ? null : h)} />
                <div className="w-[270px] shrink-0">
                  {detailCell && <HandDetailCard cell={detailCell} playedLabel={t.coach.howYouPlayed} />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Section title={t.coach.sectionByRange} defaultOpen loading={byRange.loading} error={byRange.error} empty={byRange.rows.length === 0} onRetry={byRange.reload}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              <th className={TH}>{t.coach.colRange}</th>
              {([
                { k: 'hands', label: t.coach.colHands },
                { k: 'accuracy', label: t.coach.colAccuracy },
                { k: 'graves', label: t.coach.colBlunder },
                { k: 'consults', label: t.coach.colConsults },
              ] as { k: ByRangeSortKey; label: string }[]).map(col => (
                <th key={col.k} className={THR}>
                  {sortBtn(brSortKey === col.k, brSortDir, col.label, () => handleBrSort(col.k))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedByRange.map(r => (
              <tr
                key={r.rangeId}
                onClick={() => setRangeId(r.rangeId)}
                className={`border-t border-warm-700/60 cursor-pointer hover:bg-warm-800/50 ${filters.rangeId === r.rangeId ? 'bg-warm-800/70' : ''}`}
              >
                <td className={`${TD} text-warm-100 font-semibold whitespace-nowrap`}>{r.rangeName}</td>
                <td className={`${TDR} text-warm-300`}>{r.hands}</td>
                <td className={`${TDR} font-bold ${accColor(r.accuracy)}`}>{r.accuracy}%</td>
                <td className={`${TDR} text-red-400`}>{r.graves}</td>
                <td className={`${TDR} text-warm-400`}>{r.consults}</td>
              </tr>
            ))}
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
                  {sortBtn(leaksSortKey === col.k, leaksSortDir, col.label, () => handleLeaksSort(col.k), col.align === 'r')}
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
              {([
                { k: 'rangeName', label: t.coach.colRange, align: 'l' },
                { k: 'totalConsults', label: t.coach.colConsultedHands, align: 'r' },
                { k: 'rate', label: t.coach.colConsultRate, align: 'r' },
                { k: 'totalPlayed', label: t.coach.colPlayedRange, align: 'r' },
              ] as { k: ConsultSortKey; label: string; align: 'l' | 'r' }[]).map(col => (
                <th key={col.k} className={col.align === 'l' ? TH : THR}>
                  {sortBtn(consultSortKey === col.k, consultSortDir, col.label, () => handleConsultSort(col.k), col.align === 'r')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedConsult.map(r => {
              const isOpen = openConsultRange === r.rangeId
              return (
                <Fragment key={r.rangeId}>
                  <tr
                    onClick={() => setOpenConsultRange(p => (p === r.rangeId ? null : r.rangeId))}
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
                        <ConsultRangeDetail rangeId={r.rangeId} playerIds={[]} days={filters.days} from={filters.from} to={filters.to} token={token} endpoint={ME_ANALYTICS} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </Section>
    </div>
  )
}

function RangeCheckAnalysisContent() {
  const ranges = useStore(s => s.ranges)
  const token = useStore(s => s.authToken)
  const [filters, setFilters] = useState<Filters>({ playerIds: [], rangeId: null, days: null, from: null, to: null })
  const [stackIdx, setStackIdx] = useState<number | null>(null)
  const [detailHand, setDetailHand] = useState<string | null>(null)
  const [bcSortKey, setBcSortKey] = useState<BuildByRangeSortKey>('attempts')
  const [bcSortDir, setBcSortDir] = useState<'asc' | 'desc'>('desc')

  const rangeGroups = useMemo(() => groupRangesByPosition(ranges), [ranges])
  const buildByRange = useBuildByRangeRows(token)

  const selectedRange = ranges.find(r => r.id === filters.rangeId)
  const selectedRangeName = selectedRange?.name ?? ''
  const selectedStackGrids = selectedRange?.stackGrids ?? []
  // stack_range salvo no evento é a label (ex. "250bb"), não o índice — traduz
  // o índice escolhido na aba de UI pra label na hora de consultar o back-end.
  const stackRangeParam = stackIdx !== null ? (selectedStackGrids[stackIdx]?.stackRange ?? '') : null

  const grid = useBuildRangeGrid(filters.rangeId, stackRangeParam, filters.days, filters.from, filters.to, [], token, ME_ANALYTICS)

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

  const sortedBuildByRange = useMemo(() => {
    const rows = [...buildByRange.rows]
    rows.sort((a, b) => {
      const av = a[bcSortKey] ?? 0, bv = b[bcSortKey] ?? 0
      return bcSortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [buildByRange.rows, bcSortKey, bcSortDir])

  function handleBcSort(key: BuildByRangeSortKey) {
    if (key === bcSortKey) setBcSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setBcSortKey(key); setBcSortDir('desc') }
  }

  return (
    <div className="flex flex-col gap-6">
      <BuildAccountStats hideByRangeTable />

      <div>
        <h2 className="text-sm font-semibold text-warm-200 mb-2">
          {t.coach.matrixTitle} {selectedRangeName ? <span className="text-brand-400">· {selectedRangeName}</span> : ''}
        </h2>
        <div className="rounded-xl border border-warm-700 bg-warm-900/30 p-4 flex flex-wrap gap-6 mb-3">
          <div>
            <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide mb-1.5">{t.coach.period}:</p>
            <PeriodFilter
              days={filters.days}
              from={filters.from}
              to={filters.to}
              onChange={d => setFilters(f => ({ ...f, ...d }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide mb-1.5">{t.coach.colRanges}:</p>
            <RangeSelect groups={rangeGroups} value={filters.rangeId} onChange={setRangeId} />
          </div>
        </div>
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
                  {detailCell && <HandDetailCard cell={detailCell} playedLabel={t.coach.howYouPlayed} showConsults={false} />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Section title={t.coach.sectionByRange} defaultOpen loading={buildByRange.loading} error={buildByRange.error} empty={buildByRange.rows.length === 0} onRetry={buildByRange.reload}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase select-none">
              <th className={TH}>{t.myAccount.colRange}</th>
              {([
                { k: 'attempts', label: t.myAccount.colAttempts },
                { k: 'correctHands', label: t.myAccount.colCorrectHands },
                { k: 'wrongHands', label: t.myAccount.colWrongHands },
                { k: 'avgScore', label: t.myAccount.colAvgScore },
              ] as { k: BuildByRangeSortKey; label: string }[]).map(col => (
                <th key={col.k} className={THR}>
                  {sortBtn(bcSortKey === col.k, bcSortDir, col.label, () => handleBcSort(col.k))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedBuildByRange.map(r => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  )
}
