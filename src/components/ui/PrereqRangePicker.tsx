import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { countNonFoldHands } from '../../utils/hands'
import type { Range } from '../../types'

const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'UTG']

interface Props {
  ranges: Range[]
  excludeId: number | null
  filterPositions: string[]
  currentPrereqId: number | undefined
  onSelect: (id: number | null) => void
  onClose: () => void
}

export function PrereqRangePicker({ ranges, excludeId, filterPositions, currentPrereqId, onSelect, onClose }: Props) {
  const available = ranges.filter(r =>
    r.id !== excludeId &&
    (filterPositions.length === 0 || r.positions.some(p => filterPositions.includes(p)))
  )

  const grouped: Record<string, Range[]> = {}
  for (const r of available) {
    for (const pos of r.positions) {
      if (!grouped[pos]) grouped[pos] = []
      grouped[pos].push(r)
    }
  }
  const orderedKeys = [
    ...POSITION_ORDER.filter(p => grouped[p]),
    ...Object.keys(grouped).filter(p => !POSITION_ORDER.includes(p)).sort(),
  ]

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(orderedKeys))

  function toggleGroup(pos: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(pos) ? next.delete(pos) : next.add(pos)
      return next
    })
  }

  function handleSelect(id: number | null) {
    onSelect(id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-warm-900 border border-warm-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prereq-picker-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-warm-700 flex-shrink-0">
          <h2 id="prereq-picker-title" className="text-sm font-bold text-white">Selecionar Range Pré-requisito</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-warm-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scroll area */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {/* Sem pré-requisito */}
          <button
            onClick={() => handleSelect(null)}
            className={[
              'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors',
              currentPrereqId === undefined
                ? 'bg-brand-900/30 border-brand-600/60 text-white'
                : 'bg-warm-800 border-warm-700 text-warm-400 hover:border-warm-500 hover:text-white',
            ].join(' ')}
          >
            <span>— sem pré-requisito —</span>
            {currentPrereqId === undefined && <Check size={14} className="text-brand-400" />}
          </button>

          {/* Grupos por posição */}
          {orderedKeys.map(pos => {
            const group = grouped[pos]
            const isOpen = openGroups.has(pos)
            return (
              <div key={pos} className="border border-warm-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(pos)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-warm-800 hover:bg-warm-750 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm w-10 text-left">{pos}</span>
                    <span className="text-warm-400 text-xs">{group.length} range{group.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span className={`text-warm-400 text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>›</span>
                </button>

                {isOpen && (
                  <div className="border-t border-warm-700 bg-warm-900/40 p-2 space-y-1">
                    {group.map(r => {
                      const selected = r.id === currentPrereqId
                      return (
                        <button
                          key={r.id}
                          onClick={() => handleSelect(r.id)}
                          className={[
                            'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors',
                            selected
                              ? 'bg-brand-900/30 border-brand-600/60'
                              : 'bg-warm-800 border-warm-700 hover:border-warm-500',
                          ].join(' ')}
                        >
                          <div>
                            <p className="text-sm font-semibold text-white leading-tight">{r.name}</p>
                            <p className="text-xs text-warm-500 mt-0.5">{countNonFoldHands(r.grid)} mãos</p>
                          </div>
                          {selected && <Check size={14} className="text-brand-400 flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
