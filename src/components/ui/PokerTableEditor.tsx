import { useStore } from '../../store/useStore'
import type { PositionConfig, Slot } from '../../types'

const CHIP_DENOM: Record<string, { chip: string; stripe: string; ring: string }> = {
  cream:  { chip: '#ede8de', stripe: '#4a463e',  ring: 'rgba(0,0,0,0.22)' },
  tan:    { chip: '#c95f3a', stripe: '#f5f0e6',  ring: 'rgba(255,255,255,0.32)' },
  orange: { chip: '#d97757', stripe: '#ede8de',  ring: 'rgba(255,255,255,0.36)' },
  cocoa:  { chip: '#2f2c25', stripe: '#d97757',  ring: 'rgba(217,119,87,0.55)' },
}
function chipDenom(amount: number) {
  if (amount >= 100) return 'cocoa'
  if (amount >= 25)  return 'orange'
  if (amount >= 5)   return 'tan'
  return 'cream'
}
function chipStripe(chip: string, stripe: string) {
  const s = stripe; const c = chip
  return `conic-gradient(${s} 0 4deg,${c} 4deg 41deg,${s} 41deg 49deg,${c} 49deg 86deg,${s} 86deg 94deg,${c} 94deg 131deg,${s} 131deg 139deg,${c} 139deg 176deg,${s} 176deg 184deg,${c} 184deg 221deg,${s} 221deg 229deg,${c} 229deg 266deg,${s} 266deg 274deg,${c} 274deg 311deg,${s} 311deg 319deg,${c} 319deg 356deg,${s} 356deg 360deg)`
}

function CasinoDisc({ denom, offset }: { denom: string; offset: number }) {
  const { chip, stripe, ring } = CHIP_DENOM[denom]
  const W = 22
  return (
    <div style={{
      position: 'absolute', left: 0, width: W, height: W, bottom: offset,
      borderRadius: '50%', background: chipStripe(chip, stripe),
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20),inset 0 -2px 4px rgba(0,0,0,0.30),0 1px 2px rgba(0,0,0,0.55)',
    }}>
      {/* inner solid field */}
      <div style={{ position:'absolute', inset:3, borderRadius:'50%', background: chip, border:'1px solid rgba(0,0,0,0.22)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.14)' }} />
      {/* dashed ring */}
      <div style={{ position:'absolute', inset:6, borderRadius:'50%', border:`1.5px dashed ${ring}` }} />
    </div>
  )
}

function ChipStack({ amount }: { amount: number }) {
  const denom = chipDenom(amount)
  const count = amount >= 100 ? 5 : amount >= 25 ? 4 : amount >= 5 ? 3 : 2
  const W = 22
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ position:'relative', width: W, height: W + (count - 1) * 4 }}>
        {Array.from({ length: count }, (_, i) => (
          <CasinoDisc key={i} denom={denom} offset={i * 4} />
        ))}
      </div>
      <span style={{ color:'#ede8de', fontSize:11, fontWeight:700, background:'rgba(0,0,0,0.65)', padding:'1px 6px', borderRadius:6, textShadow:'0 1px 2px black', whiteSpace:'nowrap' }}>
        {amount} bb
      </span>
    </div>
  )
}

const SUIT_BG: Record<string, string> = { h: '#dc2626', d: '#2563eb', c: '#047857', s: '#1f1d1a' }
const SUIT_ICON: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }

function SmallCard({ rank, suit }: { rank: string; suit: string }) {
  return (
    <div
      className="rounded border-2 border-white/40 shadow-lg flex flex-col items-center justify-center gap-px"
      style={{ width: 38, height: 56, background: SUIT_BG[suit] ?? '#2f2c25', flexShrink: 0 }}
    >
      <span className="font-extrabold text-white leading-none" style={{ fontSize: 14 }}>{rank}</span>
      <span className="text-white leading-none" style={{ fontSize: 17 }}>{SUIT_ICON[suit]}</span>
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
          'absolute w-[55px] h-[55px] rounded-full border-2 flex flex-col justify-center items-center font-bold z-10 transition-all duration-300',
          isHero
            ? 'bg-amber-500 border-white text-white shadow-[0_0_16px_#f59e0b] z-20 scale-110'
            : isFolded
              ? 'opacity-50 bg-warm-700 border-warm-600 text-warm-400 scale-90'
              : 'bg-warm-800 border-white/70 text-white shadow-[0_0_10px_rgba(255,255,255,0.15)]',
        ].join(' ')}
        style={{ top: `${slot.t}%`, left: `${slot.l}%`, transform: isHero ? 'translate(-50%,-50%) scale(1.1)' : 'translate(-50%,-50%)' }}
      >
        <div className="text-[0.69rem] font-bold">{label}</div>
        {isHero && <small className="text-[0.52rem] text-yellow-300 leading-none">HERO</small>}

        {/* Mini face-down cards for active villains */}
        {!isHero && !isFolded && (
          <div className="absolute top-[39px] right-0 flex z-10">
            <div className="w-3.5 h-[18px] bg-red-700 border border-white/60 rounded-sm shadow" style={{ transform: 'rotate(-8deg)' }} />
            <div className="w-3.5 h-[18px] bg-red-700 border border-white/60 rounded-sm shadow -ml-1" style={{ transform: 'rotate(8deg)' }} />
          </div>
        )}

        {/* Stack badge */}
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-black/80 border border-warm-700 rounded-md text-center whitespace-nowrap z-10 shadow-lg px-2 py-0.5">
          <div className="text-blue-400 text-[11.5px] font-bold leading-tight">{stack || 100} bb</div>
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

export interface HeroCards { r1: string; s1: string; r2: string; s2: string }

export function PokerTableEditor({ heroCards }: { heroCards?: HeroCards } = {}) {
  const activePositions = useStore(s => s.activePositions)
  const activeSlots     = useStore(s => s.activeSlots)
  const currentScenario = useStore(s => s.currentScenario)
  const currentAnte     = useStore(s => s.currentAnte)

  const heroPosIndex = activePositions.findIndex(p => currentScenario[p.id]?.isHero)
  const numPlayers   = activePositions.length

  let pot = currentAnte * numPlayers
  activePositions.forEach(p => { pot += parseFloat(String(currentScenario[p.id]?.bet ?? 0)) })

  // Hero is always rendered at visual slot 0 (rotation puts hero first)
  const heroSlot = activeSlots[0]

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
          <div className="eyebrow-accent" style={{ letterSpacing: '0.22em', fontSize: 9 }}>Pote Total</div>
          <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 28, lineHeight: 1, letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums', color: '#ede8de', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            {pot.toFixed(1)}<span style={{ fontSize: 16, color: '#8a857a' }}> bb</span>
          </div>
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

      {/* Hero cards — to the right of the hero circle */}
      {heroCards && heroSlot && (
        <div
          className="absolute z-[25] flex items-center pointer-events-none"
          style={{
            top: `${heroSlot.t}%`,
            left: `${heroSlot.l}%`,
            transform: 'translate(32px, -50%)',
          }}
        >
          <SmallCard rank={heroCards.r1} suit={heroCards.s1} />
          <SmallCard rank={heroCards.r2} suit={heroCards.s2} />
        </div>
      )}

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
