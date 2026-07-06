import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useModalA11y } from '../../utils/useModalA11y'
import { t } from '../../i18n'

const PANEL_MARGIN = 12

export function OnboardingTour() {
  const stepIndex = useStore(s => s.onboardingStep) ?? 0
  const [rect, setRect] = useState<DOMRect | null>(null)

  const steps = [
    { key: 'drill', title: t.tour.step1Title, body: t.tour.step1Body },
    { key: 'exercise', title: t.tour.step2Title, body: t.tour.step2Body },
    { key: 'history', title: t.tour.step3Title, body: t.tour.step3Body },
  ]
  const total = steps.length
  const step = steps[Math.min(stepIndex, total - 1)]

  useEffect(() => {
    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.key}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step.key])

  function finish() { useStore.setState({ onboardingStep: null }) }
  function next() {
    if (stepIndex + 1 >= total) finish()
    else useStore.setState({ onboardingStep: stepIndex + 1 })
  }

  const dialogRef = useModalA11y<HTMLDivElement>(true, finish)

  const visible = !!rect
  const panelWidth = Math.min(300, window.innerWidth - PANEL_MARGIN * 2)
  const panelTop = rect ? rect.bottom + 14 : 0
  const panelLeftRaw = rect ? rect.left + rect.width / 2 - panelWidth / 2 : 0
  const panelLeft = Math.min(Math.max(panelLeftRaw, PANEL_MARGIN), window.innerWidth - panelWidth - PANEL_MARGIN)

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 60, pointerEvents: visible ? 'auto' : 'none' }}
      onClick={finish}
    >
      {rect && (
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
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        onClick={e => e.stopPropagation()}
        className={`fixed bg-warm-900 border border-warm-700 rounded-2xl p-4 shadow-2xl transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
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
            <div className="flex gap-1" aria-hidden="true">
              {steps.map((s, i) => (
                <span
                  key={s.key}
                  className={`w-1.5 h-1.5 rounded-full ${i === stepIndex ? 'bg-brand-500' : 'bg-warm-700'}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              {stepIndex + 1 >= total ? t.tour.finish : t.tour.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
