import { useStore } from '../../store/useStore'
import { countNonFoldHands } from '../../utils/hands'
import { RangeMark } from '../ui/RangeMark'
import { MyAccountStats } from '../Stats/MyAccountStats'
import { AccuracySparkline } from '../Stats/AccuracySparkline'
import { t } from '../../i18n'

const CATEGORY_POSITIONS: Record<string, string[]> = {
  EARLY:    ['UTG','MP','HJ'],
  LATE:     ['CO','BTN'],
  BLINDS:   ['SB','BB'],
  STRADDLE: ['STR'],
}

export function Dashboard() {
  const ranges          = useStore(s => s.ranges)
  const setPage             = useStore(s => s.setPage)
  const setActiveCategory   = useStore(s => s.setActiveCategory)
  const trainingHistory = useStore(s => s.trainingHistory)
  const handPerformance = useStore(s => s.handPerformance)
  const currentUser     = useStore(s => s.currentUser)

  const totalHands   = trainingHistory.reduce((s, x) => s + x.hands, 0)
  const totalCorrect = trainingHistory.reduce((s, x) => s + x.correct, 0)
  const globalAccuracy = totalHands > 0 ? Math.round((totalCorrect / totalHands) * 100) : null

  const recentRanges = [...ranges].slice(-6).reverse().map(r => {
    const perf = handPerformance[r.id]
    const entries = perf ? Object.values(perf) : []
    const t = entries.reduce((a, v) => a + v.t, 0)
    const c = entries.reduce((a, v) => a + v.c, 0)
    const accuracy = t > 0 ? Math.round((c / t) * 100) : null
    return { ...r, nonFold: countNonFoldHands(r.grid), accuracy }
  })

  const categories = [
    { key:'early',    cat:'POSIÇÃO', name:'EARLY',    sub:'UTG · MP · HJ', accent:'#d97757', count: ranges.filter(r => r.positions.some(p => CATEGORY_POSITIONS.EARLY.includes(p))).length },
    { key:'late',     cat:'POSIÇÃO', name:'LATE',     sub:'CO · BTN',      accent:'#e5916e', count: ranges.filter(r => r.positions.some(p => CATEGORY_POSITIONS.LATE.includes(p))).length },
    { key:'blinds',   cat:'POSIÇÃO', name:'BLINDS',   sub:'SB · BB',       accent:'#f5b855', count: ranges.filter(r => r.positions.some(p => CATEGORY_POSITIONS.BLINDS.includes(p))).length },
    { key:'straddle', cat:'POSIÇÃO', name:'STRADDLE', sub:'STR',           accent:'#a8a193', count: ranges.filter(r => r.positions.some(p => CATEGORY_POSITIONS.STRADDLE.includes(p))).length },
  ]

  const statItems = [
    { label: t.dashboard.statRanges,   value: ranges.length.toString(), accent: false },
    { label: t.dashboard.statHands,    value: totalHands > 0 ? totalHands.toLocaleString() : '0', accent: false },
    { label: t.dashboard.statAccuracy, value: globalAccuracy !== null ? `${globalAccuracy}%` : '—', accent: globalAccuracy !== null && globalAccuracy >= 60 },
  ]

  return (
    <div className="min-h-full pb-12">

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-warm-900 mb-4" style={{ minHeight: 300 }}>
        <div className="absolute -right-12 -top-8 opacity-25 pointer-events-none">
          <RangeMark size={280} />
        </div>
        <div className="relative h-full flex flex-col justify-end p-10">
          <div className="text-brand-500 mb-3 uppercase" style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.25em' }}>
            {t.dashboard.eyebrow}
          </div>
          <h1 className="text-warm-100 uppercase mb-4 font-display"
              style={{ fontSize: 76, lineHeight: 0.88, letterSpacing: '0.005em' }}>
            {t.dashboard.heroTitle1}<br />{t.dashboard.heroTitle2}
          </h1>
          <p className="text-warm-300 text-base mb-6 max-w-md leading-relaxed">
            {t.dashboard.subtitle}
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setPage('drill')}
              className="btn-commit"
            >
              {t.dashboard.startTraining} →
            </button>
            <button
              onClick={() => setPage('ranges')}
              className="btn-commit-outline"
            >
              {t.dashboard.viewRanges}
            </button>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-warm-700/30 rounded-2xl overflow-hidden mb-8">
        {statItems.map(s => (
          <div key={s.label} className="bg-warm-900 p-8">
            <div className="text-warm-500 mb-1.5 uppercase" style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.18em' }}>
              {s.label}
            </div>
            <div className={s.accent ? 'text-brand-500' : 'text-warm-100'}
                 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, lineHeight: 0.9, letterSpacing: '0.01em' }}>
              {s.value}
            </div>
          </div>
        ))}
      </section>

      {/* Dados na nuvem do jogador */}
      {currentUser && (
        <section className="mb-8 space-y-4">
          {trainingHistory.length >= 2 && <AccuracySparkline sessions={trainingHistory} />}
          <MyAccountStats />
        </section>
      )}

      {/* Category grid */}
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-warm-100 uppercase font-display" style={{ fontSize: 28, lineHeight: 1, letterSpacing: '0.03em' }}>
          {t.dashboard.trainByCategory}
        </h2>
      </div>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 xl:gap-4 mb-10">
        {categories.map(c => (
          <button
            key={c.key}
            onClick={() => { setActiveCategory(c.key); setPage('category-detail') }}
            className="group relative rounded-2xl overflow-hidden bg-warm-900 hover:bg-warm-800 transition-colors text-left p-5 flex flex-col justify-between"
            style={{ aspectRatio: '4/5' }}
          >
            <div>
              <div className="text-warm-500 uppercase" style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.2em' }}>
                {c.cat}
              </div>
            </div>
            <div className="absolute right-3 top-3 opacity-30 group-hover:opacity-50 transition-opacity">
              <RangeMark size={60} color={c.accent} />
            </div>
            <div className="relative">
              <h3 className="text-warm-100 uppercase mb-1.5 font-display" style={{ fontSize: 36, lineHeight: 0.9, letterSpacing: '0.02em' }}>
                {c.name}
              </h3>
              <p className="text-xs text-warm-400 mb-3">{c.sub}</p>
              <div className="flex items-center gap-1 text-warm-300 text-xs">
                <span className="tabular-nums" style={{ fontWeight: 600 }}>{c.count}</span>
                <span>{t.dashboard.rangesWord}</span>
                <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </div>
            </div>
          </button>
        ))}
      </section>

      {/* Recentes */}
      {recentRanges.length > 0 && (
        <>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-warm-100 uppercase font-display" style={{ fontSize: 28, lineHeight: 1, letterSpacing: '0.03em' }}>
              {t.dashboard.recent}
            </h2>
            <button
              onClick={() => setPage('ranges')}
              className="text-brand-500 hover:text-brand-400 text-sm transition-colors font-semibold"
            >
              {t.dashboard.viewAll} →
            </button>
          </div>

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentRanges.slice(0, 3).map(r => (
              <button
                key={r.id}
                onClick={() => setPage('drill')}
                className="group relative rounded-2xl bg-warm-900 hover:bg-warm-800 transition-colors text-left p-5 flex flex-col overflow-hidden"
                style={{ aspectRatio: '1' }}
              >
                <div className="absolute -right-6 -bottom-6 opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none">
                  <RangeMark size={110} />
                </div>
                <div className="text-warm-500 mb-2 uppercase" style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.2em' }}>
                  {r.positions.join(' · ')} · {r.tableSize}-MAX
                </div>
                <div className="text-warm-100 uppercase relative max-w-[80%] font-display"
                     style={{ fontSize: 24, lineHeight: 0.95, letterSpacing: '0.02em' }}>
                  {r.name}
                </div>
                <div className="text-xs text-warm-400 mt-2 relative">
                  {r.nonFold} mãos · {r.scenarios.length} cenário{r.scenarios.length !== 1 ? 's' : ''}
                </div>
                <div className="mt-auto flex items-end justify-between relative">
                  <div>
                    <div className="text-warm-500 uppercase" style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.18em' }}>{t.dashboard.accuracy}</div>
                    <div className={'tabular-nums mt-1 font-display ' +
                      (r.accuracy !== null && r.accuracy >= 80 ? 'text-brand-500' : r.accuracy !== null && r.accuracy >= 50 ? 'text-gold' : 'text-warm-400')}
                      style={{ fontSize: 40, lineHeight: 0.85, letterSpacing: '0.01em' }}>
                      {r.accuracy !== null ? `${r.accuracy}%` : '—'}
                    </div>
                  </div>
                  <div className="text-warm-100 text-xl opacity-0 group-hover:opacity-100 transition-opacity">→</div>
                </div>
              </button>
            ))}
          </section>

          {recentRanges.length > 3 && (
            <section className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentRanges.slice(3, 6).map(r => (
                <button
                  key={r.id}
                  onClick={() => setPage('drill')}
                  className="group flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-warm-900 hover:bg-warm-800 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="text-warm-100 truncate uppercase font-display"
                         style={{ fontSize: 18, letterSpacing: '0.03em' }}>
                      {r.name}
                    </div>
                    <div className="text-xs text-warm-500 mt-0.5">{r.positions.join(', ')} · {r.tableSize}-max</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className={'tabular-nums font-display ' +
                      (r.accuracy !== null && r.accuracy >= 80 ? 'text-brand-500' : r.accuracy !== null && r.accuracy >= 50 ? 'text-gold' : 'text-warm-300')}
                      style={{ fontSize: 24, letterSpacing: '0.01em' }}>
                      {r.accuracy !== null ? `${r.accuracy}%` : '—'}
                    </div>
                    <div className="text-[10px] text-warm-500">{r.nonFold} mãos</div>
                  </div>
                </button>
              ))}
            </section>
          )}
        </>
      )}

      {recentRanges.length === 0 && (
        <div className="card-surface p-8 text-center">
          <p className="text-warm-400 text-sm mb-4">{t.dashboard.empty}</p>
          <button onClick={() => setPage('range-setup')} className="btn-commit">
            {t.dashboard.createFirst}
          </button>
        </div>
      )}

    </div>
  )
}
