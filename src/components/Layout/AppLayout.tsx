import { lazy, Suspense } from 'react'
import { useStore } from '../../store/useStore'
import { TopNav } from './TopNav'
import { Dashboard } from './Dashboard'
import { RangeEditorPage } from '../RangeBuilder/RangeEditorPage'
import { RangeSetupPage } from '../RangeBuilder/RangeSetupPage'
import { TableEditorPage } from '../TableEditor/TableEditorPage'
import { SituationsPage } from '../Situations/SituationsPage'
import { CategoryDetailPage } from '../Situations/CategoryDetailPage'
import { LoginPage } from '../Auth/LoginPage'
import { WelcomeModal } from '../Auth/WelcomeModal'
import { ChangePasswordModal } from '../Auth/ChangePasswordModal'
import { RouterSync } from './RouterSync'

const TrainerPage = lazy(() => import('../Trainer/TrainerPage').then(m => ({ default: m.TrainerPage })))
const StatsPage = lazy(() => import('../Stats/StatsPage').then(m => ({ default: m.StatsPage })))
const CoachPanel = lazy(() => import('../Admin/CoachPanel'))

export function AppLayout() {
  const { page, darkMode, userMode } = useStore()
  const storageBlocked = useStore(s => s.storageBlocked)
  const currentUser = useStore(s => s.currentUser)
  const justSignedUp = useStore(s => s.justSignedUp)

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
      case 'admin':           return currentUser?.role === 'coach' ? <CoachPanel /> : <Dashboard />
      default:                return <Dashboard />
    }
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <RouterSync />
      <div className="min-h-screen bg-warm-950 text-warm-100">
        {storageBlocked && (
          <div className="bg-red-900/40 border-b border-red-700 text-red-200 text-sm px-6 py-2.5 text-center">
            Armazenamento cheio: seus dados NÃO estão sendo salvos. Exporte um backup no Dashboard e libere espaço.
          </div>
        )}
        {justSignedUp
          ? <WelcomeModal />
          : currentUser?.firstLogin === true && <ChangePasswordModal />}
        <TopNav />
        <main className="w-full max-w-[1800px] mx-auto px-6 md:px-10 pt-8 pb-16">
          <Suspense fallback={<p className="text-sm text-warm-500">Carregando…</p>}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
