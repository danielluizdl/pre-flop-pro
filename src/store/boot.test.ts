import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import adminRaw from '../data/adminRanges.json'
import { DEFAULT_RANGES } from '../data/defaultRanges'

vi.mock('../utils/sentry', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  captureError: vi.fn(),
}))

const ADMIN_VERSION = (adminRaw as { version: number }).version
const FIRST_ADMIN_ID = (adminRaw as { ranges: { id: number }[] }).ranges[0].id

const userRange = {
  id: 999999, name: 'meu range', positions: ['BTN'],
  grid: {}, scenarios: [], tableSize: 8,
}

async function freshStore() {
  vi.resetModules()
  const mod = await import('./useStore')
  return mod.useStore
}

describe('store boot: loadRanges / seed de admin ranges', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('../data/adminRanges.json')
  })

  it('versão nova: preserva ranges do usuário, não reinjeta admin deletado e limpa a lista de deletados', async () => {
    localStorage.setItem('fbr-ranges-v1', JSON.stringify([userRange]))
    localStorage.setItem('admin-ranges-version', '0')
    localStorage.setItem('fbr-deleted-admin-ids', JSON.stringify([FIRST_ADMIN_ID]))

    const useStore = await freshStore()
    const ranges = useStore.getState().ranges

    expect(ranges.some(r => r.id === 999999)).toBe(true)
    expect(ranges.some(r => r.id === FIRST_ADMIN_ID)).toBe(false)
    expect(localStorage.getItem('admin-ranges-version')).toBe(String(ADMIN_VERSION))
    expect(localStorage.getItem('fbr-deleted-admin-ids')).toBe(null)
  })

  it('versão já vista: injeta apenas ranges de admin ausentes sem sobrescrever', async () => {
    localStorage.setItem('admin-ranges-version', String(ADMIN_VERSION))
    localStorage.setItem('fbr-ranges-v1', JSON.stringify([userRange]))

    const useStore = await freshStore()
    const ranges = useStore.getState().ranges

    expect(ranges.some(r => r.id === 999999)).toBe(true)
    expect(ranges.some(r => r.id === FIRST_ADMIN_ID)).toBe(true)
  })

  it('versão já vista: range de admin deletado não é reinjetado', async () => {
    localStorage.setItem('admin-ranges-version', String(ADMIN_VERSION))
    localStorage.setItem('fbr-ranges-v1', JSON.stringify([userRange]))
    localStorage.setItem('fbr-deleted-admin-ids', JSON.stringify([FIRST_ADMIN_ID]))

    const useStore = await freshStore()
    expect(useStore.getState().ranges.some(r => r.id === FIRST_ADMIN_ID)).toBe(false)
  })

  it('JSON inválido em fbr-ranges-v1: cai no catch e usa os defaults semeados', async () => {
    localStorage.setItem('fbr-ranges-v1', '{corrompido')
    const useStore = await freshStore()
    expect(useStore.getState().ranges.length).toBeGreaterThan(0)
  })

  it('loadTeamRangeIds: filtra valores não-numéricos ao ler pfp-team-range-ids', async () => {
    localStorage.setItem('pfp-team-range-ids', JSON.stringify([1, 'x', 2, null, 3]))
    const useStore = await freshStore()
    expect(useStore.getState().teamRangeIds).toEqual([1, 2, 3])
  })

  it('loadTeamRangeIds: JSON inválido → lista vazia', async () => {
    localStorage.setItem('pfp-team-range-ids', 'nao-json')
    const useStore = await freshStore()
    expect(useStore.getState().teamRangeIds).toEqual([])
  })

  it('adminRanges.json vazio: SEEDED_DEFAULTS cai nos DEFAULT_RANGES', async () => {
    vi.doMock('../data/adminRanges.json', () => ({ default: { version: 0, ranges: [] } }))
    vi.resetModules()
    const { useStore } = await import('./useStore')
    const ids = new Set(useStore.getState().ranges.map(r => r.id))
    expect(DEFAULT_RANGES.every(r => ids.has(r.id))).toBe(true)
  })

  it('deleteRange em id de admin: registra em fbr-deleted-admin-ids', async () => {
    const useStore = await freshStore()
    useStore.getState().deleteRange(FIRST_ADMIN_ID)
    const deleted = JSON.parse(localStorage.getItem('fbr-deleted-admin-ids') ?? '[]')
    expect(deleted).toContain(FIRST_ADMIN_ID)
    expect(useStore.getState().ranges.some(r => r.id === FIRST_ADMIN_ID)).toBe(false)
  })
})
