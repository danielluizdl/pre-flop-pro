import { describe, it, expect } from 'vitest'
import { encodeSparse, decodeSparse, encodeRange, decodeRange } from './sparseGrid'
import { ALL_HANDS, makeEmptyGrid, getTopFrequencyActions, getRngCorrectAction } from './hands'
import adminRangesRaw from '../data/adminRanges.json'
import type { Range, HandData } from '../types'

const ranges = (adminRangesRaw as unknown as { ranges: Range[] }).ranges

function isFold(c: HandData | undefined): boolean {
  return !c || ((c.fold ?? 100) >= 100 && !c.call && !c.raise && !c.allin && !c.extra)
}

describe('sparseGrid básico', () => {
  it('encodeSparse mantém só mãos jogáveis (fold < 100)', () => {
    const dense = makeEmptyGrid()
    dense['AA'] = { fold: 0, call: 0, raise: 100, allin: 0, size: 0 }
    const sparse = encodeSparse(dense)
    expect(Object.keys(sparse)).toEqual(['AA'])
  })

  it('decodeSparse expande para 169 mãos preenchendo o resto com fold', () => {
    const sparse = { AA: { fold: 0, call: 0, raise: 100, allin: 0, size: 0 } }
    const full = decodeSparse(sparse)
    expect(Object.keys(full).length).toBe(169)
    expect(full['AA']).toEqual(sparse['AA'])
    expect(full['KK']).toEqual({ fold: 100, call: 0, raise: 0, allin: 0, size: 0 })
  })

  it('lê formato denso antigo de forma equivalente ao esparso', () => {
    const dense = makeEmptyGrid()
    dense['AA'] = { fold: 0, call: 0, raise: 100, allin: 0, size: 0 }
    const fromDense = decodeSparse(dense)
    const fromSparse = decodeSparse(encodeSparse(dense))
    expect(Object.keys(fromDense).length).toBe(169)
    ALL_HANDS.forEach(h => {
      expect(getTopFrequencyActions(fromDense[h])).toEqual(getTopFrequencyActions(fromSparse[h]))
    })
  })

  it('encodeRange/decodeRange tratam grid principal e stackGrids', () => {
    const grid = makeEmptyGrid()
    grid['AA'] = { fold: 0, call: 0, raise: 100, allin: 0, size: 0 }
    const sg = makeEmptyGrid()
    sg['KK'] = { fold: 0, call: 100, raise: 0, allin: 0, size: 0 }
    const r: Range = {
      id: 1, name: 'R', positions: ['BTN'], grid, scenarios: [], tableSize: 6,
      stackGrids: [{ stackRange: '<20', grid: sg }],
    }
    const enc = encodeRange(r)
    expect(Object.keys(enc.grid)).toEqual(['AA'])
    expect(Object.keys(enc.stackGrids![0].grid)).toEqual(['KK'])
    const dec = decodeRange(enc)
    expect(Object.keys(dec.grid).length).toBe(169)
    expect(Object.keys(dec.stackGrids![0].grid).length).toBe(169)
    expect(dec.grid['AA']).toEqual(grid['AA'])
    expect(dec.stackGrids![0].grid['KK']).toEqual(sg['KK'])
  })
})

describe('roundtrip com TODOS os ranges reais', () => {
  it('decodeSparse(encodeSparse(grid)) idêntico ao original para as 169 mãos', () => {
    const problems: string[] = []
    ranges.forEach(r => {
      const grids = [r.grid, ...(r.stackGrids?.map(s => s.grid) ?? [])]
      const extra = r.customAction?.label
      grids.forEach((grid, gi) => {
        const round = decodeSparse(encodeSparse(grid))
        if (Object.keys(round).length !== 169) problems.push(`${r.id} g${gi} tamanho ${Object.keys(round).length}`)
        ALL_HANDS.forEach(h => {
          const orig = grid[h]
          const rt = round[h]
          if (JSON.stringify(getTopFrequencyActions(orig, extra)) !== JSON.stringify(getTopFrequencyActions(rt, extra)))
            problems.push(`${r.id} g${gi} ${h} topfreq`)
          for (let rng = 1; rng <= 100; rng++) {
            if (getRngCorrectAction(orig, rng, extra) !== getRngCorrectAction(rt, rng, extra)) {
              problems.push(`${r.id} g${gi} ${h} rng=${rng}`)
              break
            }
          }
          if (!isFold(orig) && JSON.stringify(orig) !== JSON.stringify(rt))
            problems.push(`${r.id} g${gi} ${h} célula não-fold alterada`)
        })
      })
    })
    expect(problems.slice(0, 20), problems.slice(0, 20).join('\n')).toEqual([])
  }, 120000)
})
