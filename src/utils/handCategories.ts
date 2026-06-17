import { leakImpact, wilsonLowerBound, confidenceLevel, type Confidence, type LeakCounts } from './coachStats'

const RANK_ORDER = 'AKQJT98765432'

export function rankIndex(r: string): number {
  return RANK_ORDER.indexOf(r)
}

export interface ParsedHand {
  r1: string
  r2: string
  i1: number
  i2: number
  pair: boolean
  suited: boolean
  offsuit: boolean
}

export function parseHand(hand: string): ParsedHand | null {
  if (!hand || hand.length < 2) return null
  const r1 = hand[0], r2 = hand[1]
  const i1 = rankIndex(r1), i2 = rankIndex(r2)
  if (i1 < 0 || i2 < 0) return null
  const pair = r1 === r2
  const suffix = hand.length >= 3 ? hand[2] : ''
  const suited = !pair && suffix === 's'
  const offsuit = !pair && suffix === 'o'
  if (!pair && !suited && !offsuit) return null
  return { r1, r2, i1, i2, pair, suited, offsuit }
}

// Broadway = ambas as cartas T+ (índices 0..4), não-par. Conector = gap 1, não-par.
export const SEGMENT_ORDER = ['Pares', 'Broadways', 'Suited', 'Offsuit', 'Conectores', 'Ases suited'] as const
export type Segment = (typeof SEGMENT_ORDER)[number]

export function segmentsOf(hand: string): Segment[] {
  const p = parseHand(hand)
  if (!p) return []
  const out: Segment[] = []
  if (p.pair) { out.push('Pares'); return out }
  if (p.suited) out.push('Suited')
  if (p.offsuit) out.push('Offsuit')
  if (p.i1 <= 4 && p.i2 <= 4) out.push('Broadways')
  if (Math.abs(p.i1 - p.i2) === 1) out.push('Conectores')
  if ((p.r1 === 'A' || p.r2 === 'A') && p.suited) out.push('Ases suited')
  return out
}

export interface SegmentAgg extends LeakCounts {
  segment: Segment
  accuracy: number
  accuracyLower: number
  impact: number
  confidence: Confidence
}

export interface HandRow extends LeakCounts {
  hand: string
}

const ACC = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 1000) / 10 : 0)

export function aggregateSegments(rows: HandRow[]): SegmentAgg[] {
  const acc = new Map<Segment, LeakCounts>()
  for (const s of SEGMENT_ORDER) acc.set(s, { total: 0, correct: 0, graves: 0, imprecisos: 0 })
  for (const r of rows) {
    for (const seg of segmentsOf(r.hand)) {
      const a = acc.get(seg)!
      a.total += r.total
      a.correct += r.correct
      a.graves += r.graves
      a.imprecisos += r.imprecisos
    }
  }
  return SEGMENT_ORDER
    .map(segment => {
      const a = acc.get(segment)!
      return {
        segment,
        ...a,
        accuracy: ACC(a.correct, a.total),
        accuracyLower: Math.round(wilsonLowerBound(a.correct, a.total) * 1000) / 10,
        impact: leakImpact(a),
        confidence: confidenceLevel(a.total),
      }
    })
    .filter(s => s.total > 0)
}
