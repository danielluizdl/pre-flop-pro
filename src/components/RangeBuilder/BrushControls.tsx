import { useStore } from '../../store/useStore'

const PRESETS = [0, 25, 50, 75, 100]

interface ActionRowProps {
  label: string
  color: string
  field: 'call' | 'raise' | 'allin'
  value: number
  onChange: (field: 'call' | 'raise' | 'allin', v: number) => void
  extra?: React.ReactNode
}

function ActionRow({ label, color, field, value, onChange, extra }: ActionRowProps) {
  return (
    <div className="p-3 rounded-lg bg-gray-800 border border-gray-700 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-white">
          <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />
          {label}
        </div>
        <div className="flex items-center gap-1">
          {extra}
          <input
            type="number"
            className="w-12 p-1 text-right font-bold border border-gray-600 rounded text-sm bg-gray-900 text-white"
            value={value}
            min={0} max={100}
            onChange={e => onChange(field, Number(e.target.value))}
          />
          <span className="text-sm text-gray-400">%</span>
        </div>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        className="w-full cursor-pointer"
        style={{ accentColor: color }}
        onChange={e => onChange(field, Number(e.target.value))}
      />
      <div className="flex gap-1 justify-between">
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => onChange(field, p)}
            className="flex-1 py-1 text-xs border border-gray-600 bg-gray-900 rounded cursor-pointer text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            {p}%
          </button>
        ))}
      </div>
    </div>
  )
}

export function BrushControls() {
  const brush = useStore(s => s.brush)
  const setBrush = useStore(s => s.setBrush)
  const fold = Math.max(0, 100 - brush.call - brush.raise - brush.allin)

  return (
    <div className="flex flex-col gap-3">
      {/* Fold — read-only */}
      <div className="p-3 rounded-lg bg-gray-800 border border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-white">
          <span className="w-3 h-3 rounded-full bg-gray-500 inline-block" />
          Fold
        </div>
        <div className="flex items-center gap-1">
          <input
            type="text"
            className="w-12 p-1 text-right font-bold border border-gray-600 rounded text-sm bg-gray-900/50 text-gray-400"
            value={fold}
            disabled
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </div>

      <ActionRow label="Call"   color="#22c55e" field="call"  value={brush.call}  onChange={setBrush} />

      <ActionRow
        label="Raise" color="#ef4444" field="raise" value={brush.raise} onChange={setBrush}
        extra={
          <input
            type="text"
            className="w-14 p-1 border border-gray-600 rounded text-xs text-center bg-gray-900 text-white"
            placeholder="bb"
            value={brush.raiseSize}
            onChange={e => setBrush('raiseSize', e.target.value)}
          />
        }
      />

      <ActionRow label="All-In" color="#6b2d0d" field="allin" value={brush.allin} onChange={setBrush} />
    </div>
  )
}
