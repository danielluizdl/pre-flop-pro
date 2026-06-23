import { useStore } from '../../store/useStore'

const PRESETS = [0, 25, 50, 75, 100]
const CUSTOM_COLORS = ['#a855f7', '#f97316', '#06b6d4', '#eab308', '#ec4899', '#84cc16']

function PresetButton({ p, active, onClick }: { p: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-6 rounded-full border bg-warm-800 font-display text-[13px] tracking-[0.06em] cursor-pointer transition-colors ${
        active
          ? 'border-brand-600 bg-brand-600/15 text-warm-100'
          : 'border-warm-600 text-warm-500 hover:border-brand-600 hover:text-warm-100'
      }`}
    >
      {p}%
    </button>
  )
}

interface ActionRowProps {
  label: string
  color: string
  field: 'call' | 'raise' | 'allin' | 'extra'
  value: number
  onChange: (field: 'call' | 'raise' | 'allin' | 'extra', v: number) => void
  extra?: React.ReactNode
}

function ActionRow({ label, color, field, value, onChange, extra }: ActionRowProps) {
  return (
    <div className="p-3 rounded-lg bg-warm-800 border border-warm-700 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-white">
          <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />
          {label}
        </div>
        <div className="flex items-center gap-1">
          {extra}
          <input
            type="number"
            className="w-12 p-1 text-right font-bold border border-warm-600 rounded text-sm bg-warm-900 text-white"
            value={value}
            min={0} max={100}
            onChange={e => onChange(field, Number(e.target.value))}
          />
          <span className="text-sm text-warm-400">%</span>
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
          <PresetButton key={p} p={p} active={value === p} onClick={() => onChange(field, p)} />
        ))}
      </div>
    </div>
  )
}

export function BrushControls() {
  const brush    = useStore(s => s.brush)
  const setBrush = useStore(s => s.setBrush)
  const fold = Math.max(0, 100 - brush.call - brush.raise - brush.allin - brush.extra)

  function handleRemoveExtra() {
    const state = useStore.getState()
    const newGrid = { ...state.rangeData.grid }
    Object.keys(newGrid).forEach(h => {
      const d = newGrid[h]
      if (d.extra) newGrid[h] = { ...d, fold: d.fold + d.extra, extra: 0 }
    })
    useStore.setState({
      rangeData: { ...state.rangeData, grid: newGrid },
      brush: { ...state.brush, extra: 0, extraLabel: '' },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Fold — read-only */}
      <div className="p-3 rounded-lg bg-warm-800 border border-warm-700 flex justify-between items-center">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-white">
          <span className="w-3 h-3 rounded-full bg-warm-500 inline-block" />
          Fold
        </div>
        <div className="flex items-center gap-1">
          <input
            type="text"
            className="w-12 p-1 text-right font-bold border border-warm-600 rounded text-sm bg-warm-900/50 text-warm-400"
            value={fold}
            disabled
          />
          <span className="text-sm text-warm-500">%</span>
        </div>
      </div>

      <ActionRow label="Call"   color="#22c55e" field="call"  value={brush.call}  onChange={setBrush} />

      <ActionRow
        label="Raise" color="#ef4444" field="raise" value={brush.raise} onChange={setBrush}
        extra={
          <input
            type="text"
            className="w-14 p-1 border border-warm-600 rounded text-xs text-center bg-warm-900 text-white"
            placeholder="bb"
            value={brush.raiseSize}
            onChange={e => setBrush('raiseSize', e.target.value)}
          />
        }
      />

      <ActionRow label="All-In" color="#6b2d0d" field="allin" value={brush.allin} onChange={setBrush} />

      {brush.extraLabel ? (
        <div className="p-3 rounded-lg bg-warm-800 border border-warm-700 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: brush.extraColor }} />
              <input
                type="text"
                value={brush.extraLabel}
                onChange={e => setBrush('extraLabel', e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-white font-semibold text-sm border-b border-warm-600 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="w-12 p-1 text-right font-bold border border-warm-600 rounded text-sm bg-warm-900 text-white"
                value={brush.extra}
                min={0} max={100}
                onChange={e => setBrush('extra', Number(e.target.value))}
              />
              <span className="text-sm text-warm-400">%</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            {CUSTOM_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setBrush('extraColor', c)}
                className="w-5 h-5 rounded-full border-2 transition-all flex-shrink-0"
                style={{
                  backgroundColor: c,
                  borderColor: brush.extraColor === c ? 'white' : 'transparent',
                  transform: brush.extraColor === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
            <button
              onClick={handleRemoveExtra}
              className="ml-auto text-xs text-warm-500 hover:text-red-400 transition-colors"
            >
              remover
            </button>
          </div>
          <input
            type="range" min={0} max={100} value={brush.extra}
            className="w-full cursor-pointer"
            style={{ accentColor: brush.extraColor }}
            onChange={e => setBrush('extra', Number(e.target.value))}
          />
          <div className="flex gap-1 justify-between">
            {PRESETS.map(p => (
              <PresetButton key={p} p={p} active={brush.extra === p} onClick={() => setBrush('extra', p)} />
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setBrush('extraLabel', 'Custom')}
          className="w-full py-2 border border-dashed border-warm-600 rounded-lg text-sm text-warm-500 hover:text-warm-300 hover:border-warm-400 transition-colors"
        >
          + Nova Condição
        </button>
      )}
    </div>
  )
}
