import { useStore } from '../../store/useStore'
import { LayoutDashboard, Layers, Edit3, PlayCircle, Clock, Moon, Sun, LogOut } from 'lucide-react'
import { clsx } from 'clsx'
import type { Page } from '../../types'
import { AdminPanel } from '../Admin/AdminPanel'

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'ranges',      label: 'Meus Ranges',  icon: Layers },
  { id: 'range-setup', label: 'Criar Range',  icon: Edit3 },
  { id: 'drill',       label: 'Drill',        icon: PlayCircle },
  { id: 'history',     label: 'Histórico',    icon: Clock },
]

interface Props {
  collapsed: boolean
}

export function Sidebar({ collapsed }: Props) {
  const { page, setPage, darkMode, toggleDarkMode, userMode, logout } = useStore()

  return (
    <aside className={clsx(
      'flex flex-col bg-gray-900 border-r border-gray-700/50 h-full transition-all duration-300',
      collapsed ? 'w-14' : 'w-52',
    )}>
      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-2 px-3 py-4 border-b border-gray-700/50',
        collapsed && 'justify-center',
      )}>
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0 font-black text-white text-sm">
          PF
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-sm leading-tight">
            Pre-Flop<br />
            <span className="text-brand-400 font-black">Pro</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const active = page === item.id
            || (item.id === 'range-setup' && (page === 'editor' || page === 'table-editor'))
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-all',
                active
                  ? 'bg-brand-600/20 text-brand-400 font-semibold'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                collapsed && 'justify-center px-0',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {active && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-gray-700/50 space-y-0.5">
        <button
          onClick={toggleDarkMode}
          className={clsx(
            'w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all',
            collapsed && 'justify-center px-0',
          )}
          title={darkMode ? 'Modo claro' : 'Modo escuro'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{darkMode ? 'Modo Claro' : 'Modo Escuro'}</span>}
        </button>

        {userMode === 'admin' && !collapsed && <AdminPanel />}

        {userMode === 'visitor' && !collapsed && (
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-800 hover:text-gray-400 transition-all"
            title="Sair"
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span>Sair</span>
          </button>
        )}

        {collapsed && (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center px-0 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-800 hover:text-gray-400 transition-all"
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </aside>
  )
}
