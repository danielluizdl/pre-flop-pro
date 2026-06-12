import { describe, it, expect } from 'vitest'
import { djb2 } from './hash'

describe('djb2', () => {
  it('é determinístico para a mesma entrada', () => {
    expect(djb2('abc')).toBe(djb2('abc'))
    const big = JSON.stringify({ a: 1, b: [1, 2, 3], c: 'x'.repeat(10000) })
    expect(djb2(big)).toBe(djb2(big))
  })

  it('produz hashes diferentes para entradas diferentes', () => {
    expect(djb2('abc')).not.toBe(djb2('abd'))
    expect(djb2('')).not.toBe(djb2('a'))
  })

  it('retorna string compacta (base36)', () => {
    const h = djb2('qualquer coisa')
    expect(typeof h).toBe('string')
    expect(h.length).toBeLessThan(10)
  })
})
