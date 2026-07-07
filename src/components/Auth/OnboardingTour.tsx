import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useModalA11y } from '../../utils/useModalA11y'
import { t } from '../../i18n'

const PANEL_MARGIN = 12
const PANEL_WIDTH_MAX = 340
const PANEL_EST_HEIGHT = 220
const MEASURE_TIMEOUT_MS = 2500
const MEASURE_INTERVAL_MS = 100

interface TourStep {
  target: string
  run: () => void
  title: string
  body: string
}

export function OnboardingTour() {
  const stepIndex = useStore(s => s.onboardingStep) ?? 0
  const setPage = useStore(s => s.setPage)
  const setupNewRange = useStore(s => s.setupNewRange)
  const initTableConfig = useStore(s => s.initTableConfig)

  const steps: TourStep[] = [
    { target: 'dashboard-hero', run: () => setPage('dashboard'), title: t.tour.dashboardTitle, body: t.tour.dashboardBody },
    { target: 'ranges-new', run: () => setPage('ranges'), title: t.tour.rangesTitle, body: t.tour.rangesBody },
    { target: 'setup-tablesize', run: () => setPage('range-setup'), title: t.tour.setupTitle, body: t.tour.setupBody },
    { target: 'editor-matrix', run: () => setupNewRange(8, true, 0.5), title: t.tour.editorTitle, body: t.tour.editorBody },
    { target: 'table-editor-table', run: () => { initTableConfig(); setPage('table-editor') }, title: t.tour.tableEditorTitle, body: t.tour.tableEditorBody },
    { target: 'drill-select', run: () => setPage('drill'), title: t.tour.drillTitle, body: t.tour.drillBody },
    { target: 'exercise-select', run: () => setPage('exercise'), title: t.tour.exerciseTitle, body: t.tour.exerciseBody },
    { target: 'stats-header', run: () => setPage('history'), title: t.tour.historyTitle, body: t.tour.historyBody },
  ]
  const total = steps.length
  const step = steps[Math.min(stepIndex, total - 1)]

  const [rect, setRect] = useState<DOMRect | null>(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    step.run()
    setRect(null)
    setFallback(false)

    let elapsed = 0
    const timer = setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (el) {
        setRect(el.getBoundingClientRect())
        clearInterval(timer)
        return
      }
      elapsed += MEASURE_INTERVAL_MS
      if (elapsed >= MEASURE_TIMEOUT_MS) {
        setFallback(true)
        clearInterval(timer)
      }
    }, MEASURE_INTERVAL_MS)

    function onViewportChange() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)

    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  function finish() { useStore.setState({ onboardingStep: null }) }
  function next() {
    if (stepIndex + 1 >= total) finish()
    else useStore.setState({ onboardingStep: stepIndex + 1 })
  }

  const dialogRef = useModalA11y<HTMLDivElement>(true, finish)

  const panelWidth = Math.min(PANEL_WIDTH_MAX, window.innerWidth - PANEL_MARGIN * 2)
  let panelTop = 88
  let panelLeft = Math.max(PANEL_MARGIN, (window.innerWidth - panelWidth) / 2)
  if (rect) {
    panelTop = rect.bottom + 14
    if (panelTop + PANEL_EST_HEIGHT > window.innerHeight - PANEL_MARGIN) {
      panelTop = Math.max(window.innerHeight - PANEL_EST_HEIGHT - PANEL_MARGIN, PANEL_MARGIN)
    }
    const rawLeft = rect.left + rect.width / 2 - panelWidth / 2
    panelLeft = Math.min(Math.max(rawLeft, PANEL_MARGIN), window.innerWidth - panelWidth - PANEL_MARGIN)
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 60 }} onClick={finish}>
      {rect && !fallback && (
        <div
          aria-hidden="true"
          className="fixed rounded-xl transition-all duration-300"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgba(3,7,18,0.78)',
            pointerEvents: 'none',
          }}
        />
      )}
      {!rect && (
        <div aria-hidden="true" className="fixed inset-0" style={{ background: 'rgba(3,7,18,0.6)' }} />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        onClick={e => e.stopPropagation()}
        className="fixed bg-warm-900 border border-warm-700 rounded-2xl p-4 shadow-2xl transition-all duration-300"
        style={{ top: panelTop, left: panelLeft, width: panelWidth }}
      >
        <p id="tour-title" className="text-sm font-bold text-warm-100 mb-1">{step.title}</p>
        <p className="text-xs text-warm-300 leading-relaxed mb-3">{step.body}</p>
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={finish}
            className="text-[0.7rem] text-warm-500 hover:text-warm-300 transition-colors whitespace-nowrap"
          >
            {t.tour.skip}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[0.65rem] text-warm-500 tabular-nums">{stepIndex + 1}/{total}</span>
            <button
              onClick={next}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              {stepIndex + 1 >= total ? t.tour.finish : t.tour.next}
            </button>
          </div>
        </div>
        <p className="text-[0.62rem] text-warm-600 mt-2 leading-snug">{t.tour.replayNote}</p>
      </div>
    </div>
  )
}
