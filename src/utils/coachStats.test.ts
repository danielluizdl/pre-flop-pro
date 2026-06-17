import { describe, it, expect } from 'vitest'
import {
  wilsonInterval,
  wilsonLowerBound,
  confidenceLevel,
  weightedErrors,
  leakImpact,
  rankLeaks,
  weightedErrorRate,
  knowledgeGapScore,
  rankKnowledgeGaps,
  severityProfile,
} from './coachStats'

describe('wilsonInterval', () => {
  it('retorna zeros para total 0', () => {
    expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 0, mid: 0 })
  })

  it('mid é a proporção observada', () => {
    expect(wilsonInterval(40, 200).mid).toBeCloseTo(0.2, 10)
  })

  it('intervalo estreita conforme n cresce (mesma proporção)', () => {
    const small = wilsonInterval(2, 10)
    const big = wilsonInterval(40, 200)
    const wSmall = small.upper - small.lower
    const wBig = big.upper - big.lower
    expect(wBig).toBeLessThan(wSmall)
  })

  it('piso de 100% não é 1 quando n é pequeno', () => {
    const w = wilsonInterval(3, 3)
    expect(w.lower).toBeLessThan(1)
    expect(w.lower).toBeGreaterThan(0)
    expect(w.upper).toBe(1)
  })

  it('piso de 0% fica em 0 e upper acima de 0', () => {
    const w = wilsonInterval(0, 10)
    expect(w.lower).toBe(0)
    expect(w.upper).toBeGreaterThan(0)
  })

  it('valor conhecido: 50/100 a 95% ~ [0.404, 0.596]', () => {
    const w = wilsonInterval(50, 100, 1.96)
    expect(w.lower).toBeCloseTo(0.4038, 3)
    expect(w.upper).toBeCloseTo(0.5962, 3)
  })

  it('lower bound de n grande aproxima a proporção', () => {
    const w = wilsonInterval(800, 1000)
    expect(w.lower).toBeGreaterThan(0.77)
    expect(w.lower).toBeLessThan(0.8)
  })

  it('clampeia correct fora de [0,total]', () => {
    expect(wilsonInterval(15, 10).mid).toBe(1)
    expect(wilsonInterval(-5, 10).mid).toBe(0)
  })

  it('wilsonLowerBound concorda com wilsonInterval.lower', () => {
    expect(wilsonLowerBound(7, 20)).toBeCloseTo(wilsonInterval(7, 20).lower, 12)
  })
})

describe('confidenceLevel', () => {
  it('classifica por tamanho de amostra', () => {
    expect(confidenceLevel(0)).toBe('low')
    expect(confidenceLevel(14)).toBe('low')
    expect(confidenceLevel(15)).toBe('medium')
    expect(confidenceLevel(49)).toBe('medium')
    expect(confidenceLevel(50)).toBe('high')
    expect(confidenceLevel(500)).toBe('high')
  })
})

describe('weightedErrors / leakImpact', () => {
  it('sem erros = 0', () => {
    expect(weightedErrors({ total: 100, correct: 100, graves: 0, imprecisos: 0 })).toBe(0)
  })

  it('pondera graves > untagged > imprecisos', () => {
    const grave = weightedErrors({ total: 10, correct: 9, graves: 1, imprecisos: 0 })
    const impreciso = weightedErrors({ total: 10, correct: 9, graves: 0, imprecisos: 1 })
    const untagged = weightedErrors({ total: 10, correct: 9, graves: 0, imprecisos: 0 })
    expect(grave).toBe(1)
    expect(impreciso).toBeCloseTo(0.4, 10)
    expect(untagged).toBeCloseTo(0.7, 10)
    expect(grave).toBeGreaterThan(untagged)
    expect(untagged).toBeGreaterThan(impreciso)
  })

  it('mistura: graves + imprecisos + untagged', () => {
    // 200 mãos, 160 certas => 40 erros; 20 graves, 10 imprecisos, 10 untagged
    const w = weightedErrors({ total: 200, correct: 160, graves: 20, imprecisos: 10 })
    expect(w).toBeCloseTo(20 * 1 + 10 * 0.4 + 10 * 0.7, 10)
  })

  it('volume amplifica o impacto na mesma taxa de erro', () => {
    const small = leakImpact({ total: 10, correct: 8, graves: 2, imprecisos: 0 })
    const big = leakImpact({ total: 200, correct: 160, graves: 40, imprecisos: 0 })
    expect(big).toBeGreaterThan(small)
  })

  it('clampeia contagens de severidade incoerentes', () => {
    // graves > erros: erros = 2, mas graves=5 informado
    const w = weightedErrors({ total: 10, correct: 8, graves: 5, imprecisos: 5 })
    expect(w).toBeCloseTo(2, 10)
  })
})

describe('rankLeaks', () => {
  it('ordena por impacto desc, não por % de erro bruto', () => {
    const rows = [
      { hand: 'AA', total: 5, correct: 1, graves: 4, imprecisos: 0 }, // 80% erro, n=5
      { hand: 'KK', total: 200, correct: 120, graves: 80, imprecisos: 0 }, // 40% erro, n=200
    ]
    const ranked = rankLeaks(rows)
    expect(ranked[0].hand).toBe('KK')
    expect(ranked[1].hand).toBe('AA')
  })

  it('anexa accuracyLower e confidence', () => {
    const ranked = rankLeaks([{ hand: 'QQ', total: 3, correct: 3, graves: 0, imprecisos: 0 }])
    expect(ranked[0].confidence).toBe('low')
    expect(ranked[0].accuracyLower).toBeGreaterThan(0)
    expect(ranked[0].accuracyLower).toBeLessThan(100)
  })

  it('não muta o array de entrada', () => {
    const rows = [{ hand: 'JJ', total: 10, correct: 5, graves: 5, imprecisos: 0 }]
    const snapshot = JSON.stringify(rows)
    rankLeaks(rows)
    expect(JSON.stringify(rows)).toBe(snapshot)
  })

  it('desempata por accuracyLower e total', () => {
    const rows = [
      { hand: 'A', total: 20, correct: 10, graves: 10, imprecisos: 0 },
      { hand: 'B', total: 200, correct: 190, graves: 10, imprecisos: 0 },
    ]
    // ambos impacto = 10 (graves). B tem mais tentativas e maior accuracyLower.
    const ranked = rankLeaks(rows)
    expect(ranked[0].impact).toBe(ranked[1].impact)
    // menor accuracyLower (pior precisão confiável) vem primeiro
    expect(ranked[0].hand).toBe('A')
  })
})

describe('weightedErrorRate', () => {
  it('0 sem mãos', () => {
    expect(weightedErrorRate({ total: 0, correct: 0, graves: 0, imprecisos: 0 })).toBe(0)
  })
  it('proporção ponderada por gravidade', () => {
    // 100 mãos, 20 graves => 20*1/100 = 0.2
    expect(weightedErrorRate({ total: 100, correct: 80, graves: 20, imprecisos: 0 })).toBeCloseTo(0.2, 10)
  })
})

describe('knowledgeGapScore / rankKnowledgeGaps', () => {
  it('zero quando não há consultas', () => {
    expect(knowledgeGapScore({ consults: 0, total: 100, correct: 10, graves: 90, imprecisos: 0 })).toBe(0)
  })

  it('cresce com consultas E com taxa de erro', () => {
    const low = knowledgeGapScore({ consults: 10, total: 100, correct: 90, graves: 10, imprecisos: 0 })
    const highErr = knowledgeGapScore({ consults: 10, total: 100, correct: 50, graves: 50, imprecisos: 0 })
    const highConsult = knowledgeGapScore({ consults: 40, total: 100, correct: 90, graves: 10, imprecisos: 0 })
    expect(highErr).toBeGreaterThan(low)
    expect(highConsult).toBeGreaterThan(low)
  })

  it('mão muito consultada mas sempre certa tem score baixo', () => {
    expect(knowledgeGapScore({ consults: 100, total: 100, correct: 100, graves: 0, imprecisos: 0 })).toBe(0)
  })

  it('rankKnowledgeGaps ordena por score e filtra sem consulta', () => {
    const rows = [
      { hand: 'AA', consults: 0, total: 50, correct: 10, graves: 40, imprecisos: 0 },
      { hand: 'KK', consults: 30, total: 100, correct: 50, graves: 50, imprecisos: 0 },
      { hand: 'QQ', consults: 5, total: 100, correct: 50, graves: 50, imprecisos: 0 },
    ]
    const ranked = rankKnowledgeGaps(rows)
    expect(ranked.map(r => r.hand)).toEqual(['KK', 'QQ'])
    expect(ranked[0].accuracy).toBe(50)
  })
})

describe('severityProfile', () => {
  it('sem erros => na', () => {
    expect(severityProfile(0, 0).classification).toBe('na')
  })
  it('predomínio de graves => conceitual', () => {
    const p = severityProfile(80, 20)
    expect(p.classification).toBe('conceitual')
    expect(p.graveShare).toBe(80)
  })
  it('predomínio de imprecisos => estratégia mista', () => {
    expect(severityProfile(10, 90).classification).toBe('estrategia-mista')
  })
  it('equilíbrio => misto', () => {
    expect(severityProfile(50, 50).classification).toBe('misto')
  })
})
