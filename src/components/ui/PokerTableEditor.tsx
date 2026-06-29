import { useStore } from '../../store/useStore'
import { t } from '../../i18n'
import type { PositionConfig, Slot } from '../../types'
import styles from './PokerTable.module.css'
import { chipAnchor, dealerAnchor } from './tableGeometry'

/* ── Casino chip ─────────────────────────────────────────────────────────── */
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
      <div style={{ position:'absolute', inset:3, borderRadius:'50%', background: chip, border:'1px solid rgba(0,0,0,0.22)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.14)' }} />
      <div style={{ position:'absolute', inset:6, borderRadius:'50%', border:`1.5px dashed ${ring}` }} />
    </div>
  )
}

function ChipStack({ amount, labelLeft = false }: { amount: number; labelLeft?: boolean }) {
  const denom = chipDenom(amount)
  const count = amount >= 100 ? 5 : amount >= 25 ? 4 : amount >= 5 ? 3 : 2
  const W = 22
  return (
    <div style={{ display:'flex', flexDirection: labelLeft ? 'row-reverse' : 'row', alignItems:'center', gap:6 }}>
      <div style={{ position:'relative', width: W, height: W + (count - 1) * 4 }}>
        {Array.from({ length: count }, (_, i) => (
          <CasinoDisc key={i} denom={denom} offset={i * 4} />
        ))}
      </div>
      <span style={{ color:'#ede8de', fontSize:12, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'0.02em', textShadow:'0 1px 2px rgba(0,0,0,0.85)', whiteSpace:'nowrap' }}>
        {amount} bb
      </span>
    </div>
  )
}

/* ── Hero hole cards ─────────────────────────────────────────────────────── */
const SUIT_BG: Record<string, string>   = { h: '#dc2626', d: '#2563eb', c: '#047857', s: '#1f1d1a' }
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

/* ── Seat ────────────────────────────────────────────────────────────────── */
const BLIND_BET: Record<string, number> = { SB: 0.5, BB: 1.0, STR: 2.0 }

interface SeatProps {
  label: string
  data: PositionConfig
  slot: Slot
  visualIdx: number
  tableSize: 6 | 8
}

function Seat({ label, data, slot, visualIdx, tableSize }: SeatProps) {
  const { role, bet, stack, isHero } = data
  const isFolded    = (role === 'fold' || role === 'limp-fold') && !isHero
  const hasCards    = !isHero && !isFolded
  const displayBet  = (isFolded && bet === 0 && label in BLIND_BET) ? BLIND_BET[label] : bet

  const cls = [
    styles.seatPos,
    isHero   ? styles.hero   : '',
    isFolded ? styles.folded : '',
  ].filter(Boolean).join(' ')

  const ca = chipAnchor(slot, visualIdx, tableSize)

  return (
    <>
      <div
        className={cls}
        style={{ top: `${slot.t}%`, left: `${slot.l}%` }}
      >
        {hasCards && (
          <div className={styles.cards}>
            <div className={styles.cardBack} />
            <div className={styles.cardBack} />
          </div>
        )}
        <div className={styles.seat}>
          <span className={styles.pos}>{label}</span>
        </div>
        <div className={styles.stackBox}>
          {stack || 100}<span className={styles.stackUnit}> BB</span>
        </div>
      </div>

      {displayBet > 0 && (
        <div
          className="absolute z-[15] pointer-events-none"
          style={{ top: `${ca.t}%`, left: `${ca.l}%`, transform: 'translate(-50%,-50%)' }}
        >
          <ChipStack amount={displayBet} labelLeft={ca.l < 50} />
        </div>
      )}
    </>
  )
}

/* ── Public interface ────────────────────────────────────────────────────── */
export interface HeroCards { r1: string; s1: string; r2: string; s2: string }

export function PokerTableEditor({ heroCards }: { heroCards?: HeroCards } = {}) {
  const activePositions = useStore(s => s.activePositions)
  const activeSlots     = useStore(s => s.activeSlots)
  const currentScenario = useStore(s => s.currentScenario)
  const currentAnte     = useStore(s => s.currentAnte)
  const currentTableSize = useStore(s => s.currentTableSize)

  const heroPosIndex = activePositions.findIndex(p => currentScenario[p.id]?.isHero)
  const numPlayers   = activePositions.length

  const btnPosIndex = activePositions.findIndex(p => p.id === 'btn')

  let pot = currentAnte * numPlayers
  activePositions.forEach(p => { pot += parseFloat(String(currentScenario[p.id]?.bet ?? 0)) })

  const heroSlot = activeSlots[0]

  return (
    <div className={styles.table}>
      {/* Dashed inner ring rendered via ::before in CSS */}

      {/* Pot */}
      <div className={styles.potWrap}>
        <div className={styles.potInner}>
          <div className={styles.potEyebrow}>{t.table.pot}</div>
          <div className={styles.potValue}>
            {pot.toFixed(1)}<span className={styles.potUnit}>BB</span>
          </div>
        </div>
      </div>

      {/* Ante chip stack */}
      {currentAnte > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingTop: '18%' }}>
          <ChipStack amount={parseFloat((currentAnte * numPlayers).toFixed(1))} />
        </div>
      )}

      {/* Dealer button — floats on felt between BTN seat and center */}
      {(() => {
        if (btnPosIndex === -1) return null
        const btnVisualIdx = heroPosIndex !== -1
          ? (btnPosIndex - heroPosIndex + numPlayers) % numPlayers
          : btnPosIndex
        const s = activeSlots[btnVisualIdx]
        if (!s) return null
        const dp = dealerAnchor(s, btnVisualIdx, currentTableSize)
        return (
          <div
            className={styles.dealerButton}
            style={{ left: `${dp.l}%`, top: `${dp.t}%` }}
          >D</div>
        )
      })()}

      {/* Seats */}
      {Array.from({ length: numPlayers }, (_, i) => {
        const logicalIndex = heroPosIndex !== -1 ? (heroPosIndex + i) % numPlayers : i
        const pos          = activePositions[logicalIndex]
        const data         = currentScenario[pos.id]
        if (!data) return null
        const slot         = activeSlots[i]
        return (
          <Seat key={pos.id} label={pos.label} data={data} slot={slot} visualIdx={i} tableSize={currentTableSize} />
        )
      })}

      {/* Hero hole cards — to the right of the hero circle */}
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
    </div>
  )
}
