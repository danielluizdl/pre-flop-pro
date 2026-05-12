import { useStore } from '../../store/useStore'
import type { PositionConfig, Slot } from '../../types'

function chipColor(amount: number) {
  if (amount >= 25) return { bg: 'radial-gradient(circle,#424242 0%,#000 100%)', border: '#ffd700' }
  if (amount >= 5)  return { bg: 'radial-gradient(circle,#448aff 0%,#0d47a1 100%)', border: '#bbdefb' }
  return                   { bg: 'radial-gradient(circle,#ff5252 0%,#b71c1c 100%)', border: '#ffcdd2' }
}

function ChipStack({ amount }: { amount: number }) {
  const { bg, border } = chipColor(amount)
  const count = amount >= 25 ? 5 : amount >= 5 ? 3 : 2
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-6 h-6">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="absolute w-full h-full rounded-full border-2 border-dashed"
            style={{ background: bg, borderColor: border, bottom: i * 2.5 }}
          />
        ))}
      </div>
      <span className="text-white text-xs font-extrabold bg-black/60 px-1.5 py-0.5 rounded-lg"
            style={{ textShadow: '0 1px 2px black' }}>
        {amount} bb
      </span>
    </div>
  )
}

interface SeatProps {
  label: string
  data: PositionConfig
  slot: Slot
}

const BLIND_BET: Record<string, number> = { SB: 0.5, BB: 1.0, STR: 2.0 }

function Seat({ label, data, slot }: SeatProps) {
  const { role, bet, stack, isHero } = data
  const isFolded = (role === 'fold' || role === 'limp-fold') && !isHero
  const displayBet = (isFolded && bet === 0 && label in BLIND_BET) ? BLIND_BET[label] : bet

  return (
    <>
      {/* Seat circle */}
      <div
        className={[
          'absolute w-[48px] h-[48px] rounded-full border-2 flex flex-col justify-center items-center font-bold z-10 transition-all duration-300',
          isHero
            ? 'bg-amber-500 border-white text-white shadow-[0_0_16px_#f59e0b] z-20 scale-110'
            : isFolded
              ? 'opacity-50 bg-gray-700 border-gray-600 text-gray-400 scale-90'
              : 'bg-gray-800 border-white/70 text-white shadow-[0_0_10px_rgba(255,255,255,0.15)]',
        ].join(' ')}
        style={{ top: `${slot.t}%`, left: `${slot.l}%`, transform: isHero ? 'translate(-50%,-50%) scale(1.1)' : 'translate(-50%,-50%)' }}
      >
        <div className="text-[0.6rem] font-bold">{label}</div>
        {isHero && <small className="text-[0.45rem] text-yellow-300 leading-none">HERO</small>}

        {/* Mini face-down cards for active villains */}
        {!isHero && !isFolded && (
          <div className="absolute top-[34px] right-0 flex z-10">
            <div className="w-3 h-4 bg-red-700 border border-white/60 rounded-sm shadow" style={{ transform: 'rotate(-8deg)' }} />
            <div className="w-3 h-4 bg-red-700 border border-white/60 rounded-sm shadow -ml-1" style={{ transform: 'rotate(8deg)' }} />
          </div>
        )}

        {/* Stack badge */}
        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded border border-gray-600 whitespace-nowrap z-10 shadow">
          {stack || 100} bb
        </div>
      </div>

      {/* Chips toward center */}
      {displayBet > 0 && (
        <div
          className="absolute z-[15] pointer-events-none"
          style={{
            top: `${slot.t + (50 - slot.t) * 0.3}%`,
            left: `${slot.l + (50 - slot.l) * 0.3}%`,
            transform: 'translate(-50%,-50%)',
          }}
        >
          <ChipStack amount={displayBet} />
        </div>
      )}
    </>
  )
}

export function PokerTableEditor() {
  const activePositions = useStore(s => s.activePositions)
  const activeSlots     = useStore(s => s.activeSlots)
  const currentScenario = useStore(s => s.currentScenario)
  const currentAnte     = useStore(s => s.currentAnte)

  const heroPosIndex = activePositions.findIndex(p => currentScenario[p.id]?.isHero)
  const numPlayers   = activePositions.length

  let pot = currentAnte * numPlayers
  activePositions.forEach(p => { pot += parseFloat(String(currentScenario[p.id]?.bet ?? 0)) })

  return (
    <div
      className="relative"
      style={{
        width: '100%',
        paddingBottom: '63%',
        background: 'radial-gradient(ellipse at 40% 35%, #35654d 0%, #244a36 100%)',
        borderRadius: '50%',
        border: '10px solid #2e2e2e',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5), 0 0 0 4px #111',
      }}
    >
      {/* Pot */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: '4%' }}>
        <div className="text-center" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
          <div className="text-[9px] uppercase text-white/50 tracking-widest">Pote Total</div>
          <div className="text-2xl font-extrabold text-yellow-400">{pot.toFixed(1)} bb</div>
        </div>
      </div>

      {/* Ante */}
      {currentAnte > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingTop: '18%' }}>
          <ChipStack amount={parseFloat((currentAnte * numPlayers).toFixed(1))} />
        </div>
      )}

      {/* Seats */}
      {Array.from({ length: numPlayers }, (_, i) => {
        const logicalIndex = heroPosIndex !== -1 ? (heroPosIndex + i) % numPlayers : i
        const pos = activePositions[logicalIndex]
        const data = currentScenario[pos.id]
        if (!data) return null
        const slot = activeSlots[i]
        return <Seat key={pos.id} label={pos.label} data={data} slot={slot} />
      })}

      {/* Dealer button — follows BTN after rotation */}
      {(() => {
        const btnIdx = activePositions.findIndex(p => p.id === 'btn')
        if (btnIdx === -1) return null
        const btnVisualSlot = heroPosIndex !== -1
          ? (btnIdx - heroPosIndex + numPlayers) % numPlayers
          : btnIdx
        const slot = activeSlots[btnVisualSlot]
        const dTop  = slot.t < 50 ? slot.t + 10 : slot.t - 10
        const dLeft = slot.l < 50 ? slot.l + 10 : slot.l - 10
        return (
          <div
            key="dealer"
            className="absolute w-5 h-5 bg-white text-black rounded-full text-[9px] font-black flex items-center justify-center shadow pointer-events-none z-[5]"
            style={{ top: `${dTop}%`, left: `${dLeft}%`, transform: 'translate(-50%,-50%)' }}
          >
            D
          </div>
        )
      })()}
    </div>
  )
}
