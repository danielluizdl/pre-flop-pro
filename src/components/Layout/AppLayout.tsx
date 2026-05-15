import { useStore } from '../../store/useStore'
import { TopNav } from './TopNav'
import { Dashboard } from './Dashboard'
import { RangeEditorPage } from '../RangeBuilder/RangeEditorPage'
import { RangeSetupPage } from '../RangeBuilder/RangeSetupPage'
import { TableEditorPage } from '../TableEditor/TableEditorPage'
import { SituationsPage } from '../Situations/SituationsPage'
import { CategoryDetailPage } from '../Situations/CategoryDetailPage'
import { TrainerPage } from '../Trainer/TrainerPage'
import { StatsPage } from '../Stats/StatsPage'
import { LoginPage } from '../Auth/LoginPage'

export function AppLayout() {
  const { page, darkMode, userMode } = useStore()

  if (userMode === null) return <LoginPage />

  function renderPage() {
    switch (page) {
      case 'dashboard':    return <Dashboard />
      case 'ranges':       return <SituationsPage />
      case 'range-setup':  return <RangeSetupPage />
      case 'editor':       return <RangeEditorPage />
      case 'table-editor': return <TableEditorPage />
      case 'drill':        return <TrainerPage />
      case 'history':         return <StatsPage />
      case 'category-detail': return <CategoryDetailPage />
      default:                return <Dashboard />
    }
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-warm-950 text-warm-100">
        <TopNav />
        <main className="w-full max-w-[1800px] mx-auto px-6 md:px-10 pt-8 pb-16">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
