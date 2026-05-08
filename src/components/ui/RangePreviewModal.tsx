import { HandMatrix } from '../RangeBuilder/HandMatrix'
import type { Range } from '../../types'

interface Props {
  range: Range
  onClose: () => void
}

export function RangePreviewModal({ range, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="font-bold text-white text-lg">{range.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {range.tableSize}-max · {range.positions.join(', ')} · {range.scenarios.length} cenário{range.scenarios.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl ml-4 flex-shrink-0">✕</button>
        </div>

        <div className="flex gap-6 flex-wrap">
          <div className="flex-shrink-0">
            <HandMatrix readOnly grid={range.grid} customActionColor={range.customAction?.color} />
          </div>

          <div className="flex-1 min-w-[200px]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cenários</p>
            <div className="space-y-2">
              {range.scenarios.map((s, i) => (
                <div key={s.id} className="bg-gray-800 border border-gray-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold bg-gray-700 text-gray-300 rounded px-1.5 py-0.5">#{i + 1}</span>
                    <span className="text-xs text-brand-400 font-medium">Pot: {s.pot}bb</span>
                    {!!s.heroRaiseSize && (
                      <span className="text-xs text-gray-500">Raise: {s.heroRaiseSize}bb</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{s.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
