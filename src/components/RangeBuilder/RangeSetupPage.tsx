import { useState } from 'react'
import { useStore } from '../../store/useStore'
import type { TableSize } from '../../types'

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-1 py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all',
        selected
          ? 'border-brand-500 bg-brand-600/20 text-brand-300'
          : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-gray-200',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function RangeSetupPage() {
  const setPage       = useStore(s => s.setPage)
  const setupNewRange = useStore(s => s.setupNewRange)

  const [tableSize, setTableSize]     = useState<TableSize>(8)
  const [hasStraddle, setHasStraddle] = useState(true)
  const [hasAnte, setHasAnte]         = useState(true)
  const [anteAmount, setAnteAmount]   = useState(0.5)

  function handleStart() {
    setupNewRange(tableSize, tableSize === 8 && hasStraddle, hasAnte ? anteAmount : 0)
  }

  return (
    <div className="max-w-md mx-auto space-y-5 pt-2">
      <div>
        <h1 className="text-xl font-bold text-white">Novo Range</h1>
        <p className="text-xs text-gray-400 mt-0.5">Configure o formato do jogo antes de criar o range.</p>
      </div>

      {/* Q1: Table size */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
        <p className="font-semibold text-white text-sm">Quantos players?</p>
        <div className="flex gap-3">
          <OptionButton selected={tableSize === 6} onClick={() => { setTableSize(6); setHasStraddle(false) }}>
            6-max
          </OptionButton>
          <OptionButton selected={tableSize === 8} onClick={() => setTableSize(8)}>
            8-max
          </OptionButton>
        </div>
      </div>

      {/* Q2: Straddle — only for 8-max */}
      {tableSize === 8 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
          <p className="font-semibold text-white text-sm">Terá Straddle obrigatório?</p>
          <div className="flex gap-3">
            <OptionButton selected={hasStraddle} onClick={() => setHasStraddle(true)}>Sim</OptionButton>
            <OptionButton selected={!hasStraddle} onClick={() => setHasStraddle(false)}>Não</OptionButton>
          </div>
        </div>
      )}

      {/* Q3: Ante */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
        <p className="font-semibold text-white text-sm">Terá ante?</p>
        <div className="flex gap-3">
          <OptionButton selected={hasAnte} onClick={() => setHasAnte(true)}>Sim</OptionButton>
          <OptionButton selected={!hasAnte} onClick={() => setHasAnte(false)}>Não</OptionButton>
        </div>
        {hasAnte && (
          <div className="flex items-center gap-3 pt-1 border-t border-gray-700">
            <label className="text-xs text-gray-400">Quanto o ante?</label>
            <input
              type="number" step={0.1} min={0.1}
              value={anteAmount}
              onChange={e => setAnteAmount(parseFloat(e.target.value) || 0.5)}
              className="w-20 p-1.5 border border-gray-600 rounded text-sm bg-gray-900 text-white text-center"
            />
            <span className="text-xs text-gray-400">bb</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleStart}
          className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-colors"
        >
          Continuar →
        </button>
        <button
          onClick={() => setPage('dashboard')}
          className="w-28 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
