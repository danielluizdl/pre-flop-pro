import { useStore } from '../../store/useStore'
import {
  getAllPairs,
  getAllSuited,
  getAllOffsuit,
} from '../../utils/hands'

export type QuickSelectMode = 'brush' | 'filter'

interface HandGroup {
  id: string
  label: string
  getHands: () => string[]
}

const GROUPS: HandGroup[] = [
  { id: 'pairs',    label: 'Pares',    getHands: getAllPairs   },
  { id: 'suited',   label: 'Suiteds',  getHands: getAllSuited  },
  { id: 'offsuit',  label: 'Offsuits', getHands: getAllOffsuit },
]

interface Props {
  mode: QuickSelectMode
  excludedHands?: string[]
  onSetExcluded?: (hands: string[]) => void
}

export function HandQuickSelect({ mode, excludedHands = [], onSetExcluded }: Props) {
  const applyBrushToHands = useStore(s => s.applyBrushToHands)
  const clearHands        = useStore(s => s.clearHands)
  const storeGrid         = useStore(s => s.rangeData.grid)
  const brush             = useStore(s => s.brush)
  const brushTotal = brush.call + brush.raise + brush.allin

  function handleGroup(group: HandGroup) {
    const hands = group.getHands()

    if (mode === 'brush') {
      // Toggle: se TODAS as mãos do grupo já estão pintadas → limpa; senão → aplica brush
      const allPainted = hands.every(h => (storeGrid[h]?.fold ?? 100) < 100)
      if (allPainted) {
        clearHands(hands)
      } else {
        if (brushTotal === 0) return
        applyBrushToHands(hands)
      }
      return
    }

    // mode === 'filter'
    if (!onSetExcluded) return
    const allExcluded = hands.every(h => excludedHands.includes(h))
    if (allExcluded) {
      onSetExcluded(excludedHands.filter(h => !hands.includes(h)))
    } else {
      const toAdd = hands.filter(h => !excludedHands.includes(h))
      onSetExcluded([...excludedHands, ...toAdd])
    }
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {GROUPS.map(group => {
        const hands = group.getHands()

        let active = false
        let partial = false

        if (mode === 'brush') {
          const painted = hands.filter(h => (storeGrid[h]?.fold ?? 100) < 100).length
          active  = painted === hands.length
          partial = painted > 0 && painted < hands.length
        } else {
          const excCount = hands.filter(h => excludedHands.includes(h)).length
          active  = excCount === 0           // todas incluídas = "ativo"
          partial = excCount > 0 && excCount < hands.length
        }

        const disabled = mode === 'brush' && brushTotal === 0 && !active

        return (
          <button
            key={group.id}
            onClick={() => handleGroup(group)}
            disabled={disabled}
            title={disabled ? 'Defina o brush primeiro' : group.label}
            className={[
              'px-2.5 py-1 rounded-md text-xs font-semibold border transition-all duration-150 select-none',
              disabled
                ? 'cursor-not-allowed border-gray-700/50 bg-gray-800 text-gray-500'
                : active
                  ? 'bg-brand-600/90 border-brand-500 text-white shadow-sm'
                  : partial
                    ? 'bg-gray-700 border-gray-500 text-gray-200 ring-1 ring-brand-500/40'
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-200 hover:bg-gray-700',
            ].join(' ')}
          >
            {group.label}
          </button>
        )
      })}
    </div>
  )
}
