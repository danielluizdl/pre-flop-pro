import type { HandData } from '../types'

export const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const
const SUITS = ['c', 'd', 'h', 's'] as const

export const ALL_HANDS: string[] = (() => {
  const hands: string[] = []
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      if (i === j) hands.push(RANKS[i] + RANKS[j])
      else if (i < j) hands.push(RANKS[i] + RANKS[j] + 's')
      else hands.push(RANKS[j] + RANKS[i] + 'o')
    }
  }
  return hands
})()

export function makeEmptyGrid(): Record<string, HandData> {
  const grid: Record<string, HandData> = {}
  ALL_HANDS.forEach(h => { grid[h] = { fold: 100, call: 0, raise: 0, allin: 0, size: 0 } })
  return grid
}

export function generateSuits(hand: string): [string, string] {
  const type = hand.length === 3 ? hand[2] : ''
  const s1 = SUITS[Math.floor(Math.random() * 4)]
  if (type === 's') return [s1, s1]
  let s2 = s1
  while (s2 === s1) s2 = SUITS[Math.floor(Math.random() * 4)]
  return [s1, s2]
}

export function getRngCorrectAction(data: HandData, rng: number): string {
  if (rng <= data.raise) return 'Raise'
  if (rng <= data.raise + data.call) return 'Call'
  if (rng <= data.raise + data.call + data.allin) return 'Allin'
  return 'Fold'
}

export function getHighestFrequencyAction(data: HandData): string {
  const opts = [
    { action: 'Raise', pct: data.raise },
    { action: 'Call',  pct: data.call  },
    { action: 'Allin', pct: data.allin },
    { action: 'Fold',  pct: data.fold  },
  ]
  return opts.reduce((best, cur) => (cur.pct > best.pct ? cur : best)).action
}

export function countNonFoldHands(grid: Record<string, HandData>): number {
  return Object.values(grid).filter(d => d.fold < 100).length
}
