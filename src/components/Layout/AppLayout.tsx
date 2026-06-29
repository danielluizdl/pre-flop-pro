import { lazy, Suspense } from 'react'
import { useStore } from '../../store/useStore'
import { TopNav } from './TopNav'
import { Dashboard } from './Dashboard'
import { SituationsPage } from '../Situations/SituationsPage'
import { LoginPage } from '../Auth/LoginPage'
import { WelcomeModal } from '../Auth/WelcomeModal'
import { ChangePasswordModal } from '../Auth/ChangePasswordModal'
import { RouterSync } from './RouterSync'
import { ErrorBoundary } from './ErrorBoundary'
import { t } from '../../i18n'

const TrainerPage = lazy(() => import('../Trainer/TrainerPage').then(m => ({ default: m.TrainerPage })))
const StatsPage = lazy(() => import('../Stats/StatsPage').then(m => ({ default: m.StatsPage })))
const CoachPanel = lazy(() => import('../Admin/CoachPanel'))
// Fluxo de criação/edição de range e detalhe de categoria não estão na carga
// inicial (só via navegação) → lazy para enxugar o chunk principal.
const RangeSetupPage = lazy(() => import('../RangeBuilder/RangeSetupPage').then(m => ({ default: m.RangeSetupPage })))
const RangeEditorPage = lazy(() => import('../RangeBuilder/RangeEditorPage').then(m => ({ default: m.RangeEditorPage })))
const TableEditorPage = lazy(() => import('../TableEditor/TableEditorPage').then(m => ({ default: m.TableEditorPage })))
const CategoryDetailPage = lazy(() => import('../Situations/CategoryDetailPage').then(m => ({ default: m.CategoryDetailPage })))

export function AppLayout() {
  const { page, darkMode, userMode, lang } = useStore()
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
      {/* key={lang}: troca de idioma re-monta a árvore (estado do drill vive no
          store, não se perde) garantindo que até componentes memoizados peguem o novo idioma. */}
      <div key={lang} className="min-h-screen bg-warm-950 text-warm-100">
        {storageBlocked && (
          <div className="bg-red-900/40 border-b border-red-700 text-red-200 text-sm px-6 py-2.5 text-center">
            {t.app.storageFull}
          </div>
        )}
        {justSignedUp
          ? <WelcomeModal />
          : currentUser?.firstLogin === true && <ChangePasswordModal />}
        <TopNav />
        <main className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 md:px-10 pt-6 sm:pt-8 pb-16">
          <ErrorBoundary variant="section" resetKey={page}>
            <Suspense fallback={<p className="text-sm text-warm-500">{t.common.loading}</p>}>
              {renderPage()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
