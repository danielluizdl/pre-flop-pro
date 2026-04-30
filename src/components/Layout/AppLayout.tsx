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
import { Menu } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  dashboard:     'Dashboard',
  ranges:        'Meus Ranges',
  'range-setup': 'Novo Range',
  editor:        'Editor de Range',
  'table-editor': 'Configurar Cenários',
  drill:         'Treinar',
  history:       'Histórico',
}

export function AppLayout() {
  const { page, darkMode } = useStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
      <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center gap-3 px-5 py-3 border-b border-gray-700/50 bg-gray-900/50 flex-shrink-0">
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <Menu size={18} />
            </button>
            <h1 className="font-semibold text-white text-sm">{PAGE_TITLES[page] ?? 'FreeBetRange'}</h1>
          </header>

          <main className="flex-1 overflow-auto p-5 lg:p-6">
            {renderPage()}
          </main>
        </div>
      </div>
    </div>
  )
}
