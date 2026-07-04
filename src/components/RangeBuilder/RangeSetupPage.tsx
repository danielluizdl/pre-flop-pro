import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { t } from '../../i18n'
import type { TableSize } from '../../types'

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-1 py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all',
        selected
          ? 'border-brand-500 bg-brand-600/20 text-brand-300'
          : 'border-warm-600 bg-warm-800 text-warm-400 hover:border-warm-500 hover:text-warm-200',
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
        <h1 className="font-display uppercase text-warm-100 text-[28px] leading-none tracking-wide">{t.rangeSetup.title}</h1>
        <p className="text-xs text-warm-400 mt-0.5">{t.rangeSetup.subtitle}</p>
      </div>

      {/* Q1: Table size */}
      <div className="bg-warm-800 border border-warm-700 rounded-xl p-5 space-y-3">
        <p className="font-semibold text-warm-100 text-sm">{t.rangeSetup.howManyPlayers}</p>
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
        <div className="bg-warm-800 border border-warm-700 rounded-xl p-5 space-y-3">
          <p className="font-semibold text-warm-100 text-sm">{t.rangeSetup.straddleQuestion}</p>
          <div className="flex gap-3">
            <OptionButton selected={hasStraddle} onClick={() => setHasStraddle(true)}>{t.rangeSetup.yes}</OptionButton>
            <OptionButton selected={!hasStraddle} onClick={() => setHasStraddle(false)}>{t.rangeSetup.no}</OptionButton>
          </div>
        </div>
      )}

      {/* Q3: Ante */}
      <div className="bg-warm-800 border border-warm-700 rounded-xl p-5 space-y-3">
        <p className="font-semibold text-warm-100 text-sm">{t.rangeSetup.anteQuestion}</p>
        <div className="flex gap-3">
          <OptionButton selected={hasAnte} onClick={() => setHasAnte(true)}>{t.rangeSetup.yes}</OptionButton>
          <OptionButton selected={!hasAnte} onClick={() => setHasAnte(false)}>{t.rangeSetup.no}</OptionButton>
        </div>
        {hasAnte && (
          <div className="flex items-center gap-3 pt-1 border-t border-warm-700">
            <label className="text-xs text-warm-400" htmlFor="ante-amount">{t.rangeSetup.anteAmount}</label>
            <input
              id="ante-amount"
              type="number" step={0.1} min={0.1}
              value={anteAmount}
              onChange={e => setAnteAmount(parseFloat(e.target.value) || 0.5)}
              className="w-20 p-1.5 border border-warm-600 rounded text-sm bg-warm-900 text-warm-100 text-center"
            />
            <span className="text-xs text-warm-400">bb</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleStart}
          className="btn-commit flex-1 justify-center"
        >
          {t.rangeSetup.continue} →
        </button>
        <button
          onClick={() => setPage('dashboard')}
          className="w-28 py-3 bg-warm-700 hover:bg-warm-600 text-warm-100 rounded-xl font-bold transition-colors"
        >
          {t.rangeSetup.cancel}
        </button>
      </div>
    </div>
  )
}
