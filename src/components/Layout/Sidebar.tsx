import { useStore } from '../../store/useStore'
import { LayoutDashboard, Layers, Edit3, PlayCircle, Clock, Moon, Sun, LogOut, Menu } from 'lucide-react'
import { clsx } from 'clsx'
import type { Page } from '../../types'
import { AdminPanel } from '../Admin/AdminPanel'
import { t } from '../../i18n'

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',   label: t.nav.dashboard,   icon: LayoutDashboard },
  { id: 'ranges',      label: t.nav.ranges,      icon: Layers },
  { id: 'range-setup', label: t.nav.createRange, icon: Edit3 },
  { id: 'drill',       label: t.nav.drill,       icon: PlayCircle },
  { id: 'history',     label: t.nav.history,     icon: Clock },
]

interface Props {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: Props) {
  const { page, setPage, darkMode, toggleDarkMode, userMode, logout } = useStore()

  return (
    <aside className={clsx(
      'flex flex-col bg-warm-900 border-r border-warm-700/50 h-full transition-all duration-300 flex-shrink-0',
      collapsed ? 'w-14' : 'w-52',
    )}>
      {/* Logo + toggle */}
      <div className={clsx(
        'flex items-center gap-2 px-3 py-4 border-b border-warm-700/50',
        collapsed ? 'justify-center' : 'justify-between',
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            {/* Range mark */}
            <div className="inline-grid grid-cols-4 flex-shrink-0" style={{ gap: 1, width: 22 }}>
              {[true,true,true,true, true,true,true,false, true,true,false,false, true,false,false,false].map((on, i) => (
                <span key={i} style={{ aspectRatio:'1', borderRadius:1, background: on ? '#d97757' : 'transparent', outline: on ? 'none' : '1px solid rgba(217,119,87,0.18)', outlineOffset: -1 }} />
              ))}
            </div>
            <span className="font-display uppercase text-warm-100 whitespace-nowrap leading-none" style={{ fontSize: 20, letterSpacing: '0.015em' }}>
              Pre-Flop <span className="text-brand-500">Pro</span>
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-warm-400 hover:text-white hover:bg-warm-800 transition-colors flex-shrink-0"
          title={collapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
        >
          <Menu size={18} />
        </button>
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
                  : 'text-warm-400 hover:bg-warm-800 hover:text-white',
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
      <div className="px-2 py-3 border-t border-warm-700/50 space-y-0.5">
        <button
          onClick={toggleDarkMode}
          className={clsx(
            'w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-warm-400 hover:bg-warm-800 hover:text-white transition-all',
            collapsed && 'justify-center px-0',
          )}
          title={darkMode ? t.nav.lightMode : t.nav.darkMode}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{darkMode ? t.nav.lightModeLabel : t.nav.darkModeLabel}</span>}
        </button>

        {userMode === 'admin' && !collapsed && <AdminPanel />}

        {userMode === 'visitor' && !collapsed && (
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-warm-600 hover:bg-warm-800 hover:text-warm-400 transition-all"
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span>{t.nav.logout}</span>
          </button>
        )}

        {collapsed && (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center px-0 py-2.5 rounded-lg text-sm text-warm-600 hover:bg-warm-800 hover:text-warm-400 transition-all"
            title={t.nav.logout}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </aside>
  )
}
