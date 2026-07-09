import { GraduationCap } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { t } from '../../i18n'
import type { TourScope } from '../Auth/OnboardingTour'

export function PageTutorialButton({ scope }: { scope: TourScope }) {
  const startPageTutorial = useStore(s => s.startPageTutorial)
  return (
    <button
      onClick={() => startPageTutorial(scope)}
      className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-warm-600 bg-warm-800/60 text-warm-300 hover:bg-warm-700 hover:text-warm-100 text-xs font-semibold transition-colors"
    >
      <GraduationCap size={13} className="flex-shrink-0" />
      {t.tour.tutorialButton}
    </button>
  )
}
