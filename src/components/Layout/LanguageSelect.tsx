import { useState, useRef, useEffect } from 'react'
import { Globe } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { LANGS } from '../../i18n'

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const lang = useStore(s => s.lang)
  const setLang = useStore(s => s.setLang)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const current = LANGS.find(l => l.code === lang) ?? LANGS[0]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Idioma / Language / Idioma"
        className={[
          'h-9 flex items-center gap-1.5 rounded-full text-warm-400 hover:bg-warm-800 hover:text-warm-100 transition-colors text-xs font-bold',
          compact ? 'w-full justify-center px-0' : 'px-2.5',
        ].join(' ')}
      >
        <Globe size={16} className="flex-shrink-0" />
        {!compact && <span>{current.label}</span>}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Idioma / Language / Idioma"
          className="absolute right-0 top-full mt-2 w-40 bg-warm-900 border border-warm-700 rounded-xl shadow-xl overflow-hidden z-50"
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false) } }}
        >
          {LANGS.map(l => (
            <button
              key={l.code}
              role="option"
              aria-selected={l.code === lang}
              onClick={() => { setLang(l.code); setOpen(false) }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors ${l.code === lang ? 'text-brand-300 font-semibold bg-warm-800/50' : 'text-warm-300 hover:bg-warm-800 hover:text-warm-100'}`}
            >
              <span>{l.name}</span>
              <span className="text-xs text-warm-500">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
