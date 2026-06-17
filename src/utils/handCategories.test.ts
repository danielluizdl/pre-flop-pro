import { describe, it, expect } from 'vitest'
import { parseHand, segmentsOf, aggregateSegments, rankIndex } from './handCategories'

describe('rankIndex / parseHand', () => {
  it('ordena A alto, 2 baixo', () => {
    expect(rankIndex('A')).toBe(0)
    expect(rankIndex('2')).toBe(12)
    expect(rankIndex('X')).toBe(-1)
  })

  it('par', () => {
    const p = parseHand('TT')!
    expect(p.pair).toBe(true)
    expect(p.suited).toBe(false)
    expect(p.offsuit).toBe(false)
  })

  it('suited e offsuit', () => {
    expect(parseHand('AKs')!.suited).toBe(true)
    expect(parseHand('AKo')!.offsuit).toBe(true)
  })

  it('mãos inválidas => null', () => {
    expect(parseHand('')).toBeNull()
    expect(parseHand('Z9s')).toBeNull()
    expect(parseHand('AK')).toBeNull() // sem suffix e não-par
  })
})

describe('segmentsOf', () => {
  it('par só entra em Pares', () => {
    expect(segmentsOf('AA')).toEqual(['Pares'])
    expect(segmentsOf('22')).toEqual(['Pares'])
  })

  it('AKs: suited + broadway + ases suited', () => {
    const s = segmentsOf('AKs')
    expect(s).toContain('Suited')
    expect(s).toContain('Broadways')
    expect(s).toContain('Ases suited')
    expect(s).not.toContain('Offsuit')
  })

  it('KQo: offsuit + broadway, não conector? KQ é conector', () => {
    const s = segmentsOf('KQo')
    expect(s).toContain('Offsuit')
    expect(s).toContain('Broadways')
    expect(s).toContain('Conectores')
  })

  it('98s: suited + conector, não broadway', () => {
    const s = segmentsOf('98s')
    expect(s).toContain('Suited')
    expect(s).toContain('Conectores')
    expect(s).not.toContain('Broadways')
  })

  it('A5s: ases suited e suited, não broadway nem conector', () => {
    const s = segmentsOf('A5s')
    expect(s).toContain('Ases suited')
    expect(s).toContain('Suited')
    expect(s).not.toContain('Broadways')
    expect(s).not.toContain('Conectores')
  })

  it('T9o: conector e broadway? T é broadway, 9 não => não broadway', () => {
    const s = segmentsOf('T9o')
    expect(s).toContain('Conectores')
    expect(s).not.toContain('Broadways')
  })

  it('JTs: broadway + conector + suited', () => {
    const s = segmentsOf('JTs')
    expect(s).toEqual(expect.arrayContaining(['Suited', 'Broadways', 'Conectores']))
  })
})

describe('aggregateSegments', () => {
  it('soma contagens por segmento e calcula precisão/impacto', () => {
    const rows = [
      { hand: 'AA', total: 100, correct: 95, graves: 3, imprecisos: 2 },
      { hand: 'AKs', total: 80, correct: 40, graves: 30, imprecisos: 10 },
      { hand: 'AKo', total: 60, correct: 30, graves: 20, imprecisos: 10 },
    ]
    const segs = aggregateSegments(rows)
    const pares = segs.find(s => s.segment === 'Pares')!
    expect(pares.total).toBe(100)
    expect(pares.accuracy).toBe(95)

    const suited = segs.find(s => s.segment === 'Suited')!
    expect(suited.total).toBe(80)
    expect(suited.accuracy).toBe(50)

    const broadways = segs.find(s => s.segment === 'Broadways')!
    // AKs + AKo
    expect(broadways.total).toBe(140)
    expect(broadways.correct).toBe(70)
    expect(broadways.impact).toBeGreaterThan(0)
  })

  it('omite segmentos sem dados', () => {
    const segs = aggregateSegments([{ hand: 'AA', total: 10, correct: 10, graves: 0, imprecisos: 0 }])
    expect(segs.map(s => s.segment)).toEqual(['Pares'])
  })

  it('mão inválida não quebra a agregação', () => {
    const segs = aggregateSegments([{ hand: 'ZZZ', total: 10, correct: 5, graves: 5, imprecisos: 0 }])
    expect(segs).toEqual([])
  })

  it('anexa accuracyLower e confidence', () => {
    const segs = aggregateSegments([{ hand: 'AKs', total: 5, correct: 1, graves: 4, imprecisos: 0 }])
    const suited = segs.find(s => s.segment === 'Suited')!
    expect(suited.confidence).toBe('low')
    expect(suited.accuracyLower).toBeGreaterThanOrEqual(0)
    expect(suited.accuracyLower).toBeLessThan(suited.accuracy + 0.01)
  })
})
