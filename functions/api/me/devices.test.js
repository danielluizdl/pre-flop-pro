import { describe, it, expect } from 'vitest'
import { toDeviceList } from './devices.js'

describe('toDeviceList', () => {
  const rows = [
    { id: 1, token_hash: 'aaa', created_at: 100, expires_at: 200 },
    { id: 2, token_hash: 'bbb', created_at: 90, expires_at: 190 },
  ]

  it('mapeia colunas para o shape do cliente sem vazar token_hash', () => {
    const out = toDeviceList(rows, 'aaa')
    expect(out[0]).toEqual({ id: 1, createdAt: 100, expiresAt: 200, current: true })
    expect(out[0]).not.toHaveProperty('token_hash')
  })

  it('marca como current apenas a sessão do token atual', () => {
    const out = toDeviceList(rows, 'bbb')
    expect(out.find(d => d.id === 1).current).toBe(false)
    expect(out.find(d => d.id === 2).current).toBe(true)
  })

  it('lida com lista vazia ou nula', () => {
    expect(toDeviceList([], 'x')).toEqual([])
    expect(toDeviceList(null, 'x')).toEqual([])
  })
})
