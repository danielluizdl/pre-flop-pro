import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { LayoutDashboard, Layers, PlayCircle, Grid3x3, Clock, Moon, Sun, Settings, Plus, LogOut, Globe, GraduationCap, UserCog } from 'lucide-react'
import { clsx } from 'clsx'
import type { Page } from '../../types'
import { AdminPanel } from '../Admin/AdminPanel'
import { RangeMark } from '../ui/RangeMark'
import { LANGS, type Lang } from '../../i18n'
import { t } from '../../i18n'

function nextLang(current: Lang): Lang {
  const idx = LANGS.findIndex(l => l.code === current)
  return LANGS[(idx + 1) % LANGS.length].code
}

const NAV_ICONS: { id: Page; icon: React.ElementType }[] = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'ranges',    icon: Layers },
  { id: 'drill',     icon: PlayCircle },
  { id: 'exercise',  icon: Grid3x3 },
  { id: 'history',   icon: Clock },
]

export function TopNav() {
  const page           = useStore(s => s.page)
  const setPage        = useStore(s => s.setPage)
  const darkMode       = useStore(s => s.darkMode)
  const toggleDarkMode = useStore(s => s.toggleDarkMode)
  const userMode       = useStore(s => s.userMode)

  const currentUser    = useStore(s => s.currentUser)
  const authLogout     = useStore(s => s.authLogout)
  const lang           = useStore(s => s.lang)
  const setLang        = useStore(s => s.setLang)

  const NAV_LABELS: Partial<Record<Page, string>> = {
    dashboard: t.nav.dashboard, ranges: t.nav.ranges, drill: t.nav.drill, exercise: t.exercise.navLabel, history: t.nav.history,
  }
  const NAV_ITEMS = NAV_ICONS.map(n => ({ ...n, label: NAV_LABELS[n.id] ?? n.id }))

  const [adminOpen, setAdminOpen]     = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const role    = currentUser?.username ?? (userMode === 'admin' ? 'Admin' : 'Visitante')
  const initial = role[0].toUpperCase()

  return (
    <>
      <header className="sticky top-0 z-50 h-16 bg-warm-900 border-b border-warm-700">
        <div className="max-w-[1800px] mx-auto w-full h-full flex items-center px-6 md:px-10">
        {/* Brand */}
        <div className="flex items-center pr-3 mr-3 sm:pr-6 sm:mr-8 border-r border-warm-700 flex-shrink-0">
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
                <span className="sr-only sm:not-sr-only">{item.label}</span>
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

        {/* Conta */}
        {currentUser?.role === 'coach' && (
          <button
            onClick={() => setPage('admin')}
            className="mr-2 text-[13px] font-medium text-brand-500 hover:text-brand-400 transition-colors px-2 py-1.5 whitespace-nowrap"
          >
            {t.nav.coachPanel}
          </button>
        )}

        {/* Util buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleDarkMode}
            className="w-9 h-9 flex items-center justify-center rounded-full text-warm-400 hover:bg-warm-800 hover:text-warm-100 transition-colors"
            title={darkMode ? t.nav.lightMode : t.nav.darkMode}
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
              title={t.nav.publishRanges}
            >
              <Settings size={18} />
            </button>
          )}
        </div>

        {/* + Novo Range */}
        <button
          onClick={() => setPage('range-setup')}
          aria-label={t.nav.newRange}
          className="ml-2 sm:ml-3 flex items-center gap-1.5 rounded-full bg-warm-100 hover:bg-warm-50 text-warm-950 transition-colors font-display uppercase"
          style={{ fontSize: 13, letterSpacing: '0.10em', padding: '6px 14px' }}
        >
          <Plus size={14} strokeWidth={2.5} />
          <span className="hidden sm:inline">{t.nav.newRange}</span>
        </button>

        {/* Profile */}
        <div ref={profileRef} className="relative flex items-center gap-2.5 pl-2 ml-2 sm:pl-4 sm:ml-3 border-l border-warm-700">
          <button
            onClick={() => setProfileOpen(o => !o)}
            aria-label={t.nav.account}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div
              className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #d97757, #c95f3a)' }}
            >
              <span className="text-white leading-none" style={{ fontSize: 11, fontWeight: 700 }}>{initial}</span>
            </div>
            <span className="hidden sm:inline text-warm-300 uppercase leading-none whitespace-nowrap" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.18em' }}>
              {role}
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-warm-900 border border-warm-700 rounded-xl shadow-xl overflow-hidden z-50">
              <button
                onClick={() => setLang(nextLang(lang))}
                className="w-full flex items-center justify-between gap-2.5 px-4 py-3 text-sm text-warm-300 hover:bg-warm-800 hover:text-warm-100 transition-colors"
              >
                <span className="flex items-center gap-2.5"><Globe size={15} className="flex-shrink-0" />{t.nav.language}</span>
                <span className="text-xs font-bold text-warm-500">{LANGS.find(l => l.code === lang)?.label}</span>
              </button>
              <button
                onClick={() => { setProfileOpen(false); setPage('account') }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-warm-300 hover:bg-warm-800 hover:text-warm-100 transition-colors border-t border-warm-700/60"
              >
                <UserCog size={15} className="flex-shrink-0" />
                {t.nav.editAccount}
              </button>
              <button
                onClick={() => { setProfileOpen(false); useStore.setState({ onboardingStep: 0, onboardingScope: null }) }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-warm-300 hover:bg-warm-800 hover:text-warm-100 transition-colors border-t border-warm-700/60"
              >
                <GraduationCap size={15} className="flex-shrink-0" />
                {t.nav.replayTutorial}
              </button>
              <button
                onClick={() => { setProfileOpen(false); authLogout() }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-warm-300 hover:bg-warm-800 hover:text-warm-100 transition-colors border-t border-warm-700/60"
              >
                <LogOut size={15} className="flex-shrink-0" />
                {t.nav.logout}
              </button>
            </div>
          )}
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
