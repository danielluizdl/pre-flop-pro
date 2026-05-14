import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { Sidebar } from './Sidebar'
import { Dashboard } from './Dashboard'
import { RangeEditorPage } from '../RangeBuilder/RangeEditorPage'
import { RangeSetupPage } from '../RangeBuilder/RangeSetupPage'
import { TableEditorPage } from '../TableEditor/TableEditorPage'
import { SituationsPage } from '../Situations/SituationsPage'
import { TrainerPage } from '../Trainer/TrainerPage'
import { StatsPage } from '../Stats/StatsPage'
import { LoginPage } from '../Auth/LoginPage'

export function AppLayout() {
  const { page, darkMode, userMode } = useStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  if (userMode === null) return <LoginPage />

  function renderPage() {
    switch (page) {
      case 'dashboard':    return <Dashboard />
      case 'ranges':       return <SituationsPage />
      case 'range-setup':  return <RangeSetupPage />
      case 'editor':       return <RangeEditorPage />
      case 'table-editor': return <TableEditorPage />
      case 'drill':        return <TrainerPage />
      case 'history':      return <StatsPage />
      default:             return <Dashboard />
    }
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-warm-950 text-warm-100 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />

        <main className="flex-1 overflow-y-auto px-8 py-6 min-w-0">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
