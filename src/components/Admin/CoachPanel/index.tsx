import { useState } from 'react'
import { useStore } from '../../../store/useStore'
import { t } from '../../../i18n'
import { TeamView } from './TeamView'
import { RecallView, PublishTeamRanges } from './RecallView'
import { AdminView } from './AdminView'

export { TopHandsPanel, HandDetailCard, PlayerQuickSummary, ConsultRangeDetail } from './TeamView'
export { AdminView } from './AdminView'

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
