import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { LayoutDashboard, Layers, PlayCircle, Clock, Moon, Sun, Settings, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import type { Page } from '../../types'
import { AdminPanel } from '../Admin/AdminPanel'
import { RangeMark } from '../ui/RangeMark'

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'ranges',    label: 'Meus Ranges', icon: Layers },
  { id: 'drill',     label: 'Drill',       icon: PlayCircle },
  { id: 'history',   label: 'Histórico',   icon: Clock },
]

export function TopNav() {
  const page           = useStore(s => s.page)
  const setPage        = useStore(s => s.setPage)
  const darkMode       = useStore(s => s.darkMode)
  const toggleDarkMode = useStore(s => s.toggleDarkMode)
  const userMode       = useStore(s => s.userMode)

  const [adminOpen, setAdminOpen] = useState(false)

  // TODO: ligar com auth store quando existir
  const role    = userMode === 'admin' ? 'Admin' : 'Visitante'
  const initial = role[0]

  return (
    <>
      <header className="sticky top-0 z-50 h-16 bg-warm-900 border-b border-warm-700">
        <div className="max-w-[1800px] mx-auto w-full h-full flex items-center px-6 md:px-10">
        {/* Brand */}
        <div className="flex items-center pr-6 mr-8 border-r border-warm-700 flex-shrink-0">
          <button
            onClick={() => setPage('dashboard')}
            className="flex items-center gap-2.5 flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <RangeMark size={20} />
            <span
              className="text-warm-100 text-xl tracking-tight whitespace-nowrap"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
            >
              Pre-Flop <em className="not-italic" style={{ color: '#d97757' }}>Pro</em>
            </span>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex items-stretch gap-1 h-full flex-shrink-0">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={clsx(
                  'relative flex items-center gap-1.5 px-3.5 h-full whitespace-nowrap text-[13px] font-medium transition-colors',
                  active ? 'text-brand-500' : 'text-warm-300 hover:text-warm-100',
                )}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span>{item.label}</span>
                {active && (
                  <span
                    className="ml-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: '#d97757', boxShadow: '0 0 5px #d97757aa' }}
                  />
                )}
                {active && (
                  <span
                    className="absolute left-3.5 right-3.5"
                    style={{ bottom: -1, height: 2, background: '#d97757', borderRadius: '2px 2px 0 0' }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Util buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleDarkMode}
            className="w-9 h-9 flex items-center justify-center rounded-full text-warm-400 hover:bg-warm-800 hover:text-warm-100 transition-colors"
            title={darkMode ? 'Modo claro' : 'Modo escuro'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {userMode === 'admin' && (
            <button
              onClick={() => setAdminOpen(true)}
              className={clsx(
                'w-9 h-9 flex items-center justify-center rounded-full transition-colors',
                adminOpen
                  ? 'bg-warm-800 text-warm-100'
                  : 'text-warm-400 hover:bg-warm-800 hover:text-warm-100',
              )}
              title="Publicar ranges"
            >
              <Settings size={18} />
            </button>
          )}
        </div>

        {/* + Novo Range */}
        <button
          onClick={() => setPage('range-setup')}
          className="ml-3 flex items-center gap-1.5 rounded-full bg-warm-100 hover:bg-warm-50 text-warm-950 transition-colors font-display uppercase"
          style={{ fontSize: 13, letterSpacing: '0.10em', padding: '6px 14px' }}
        >
          <Plus size={14} strokeWidth={2.5} />
          Novo Range
        </button>

        {/* Profile */}
        <div className="flex items-center gap-2.5 pl-4 ml-3 border-l border-warm-700">
          <div
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #d97757, #c95f3a)' }}
          >
            <span className="text-white leading-none" style={{ fontSize: 11, fontWeight: 700 }}>{initial}</span>
          </div>
          <span className="text-warm-300 uppercase leading-none whitespace-nowrap" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.18em' }}>
            {role}
          </span>
        </div>
        </div>
      </header>

      {/* Modal de publicação — apenas para admins */}
      {userMode === 'admin' && (
        <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
      )}
    </>
  )
}
