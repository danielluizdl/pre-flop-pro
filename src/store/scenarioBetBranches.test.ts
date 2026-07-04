import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { POS_6MAX, POS_8MAX, SLOTS_6MAX, SLOTS_8MAX } from '../types'

const s = () => useStore.getState()

describe('updateRole: apostas por posição/role (ramos de bet)', () => {
  beforeEach(() => {
    useStore.setState({
      activePositions: POS_8MAX,
      activeSlots: SLOTS_8MAX,
      currentTableSize: 8,
      currentHasStraddle: true,
      currentAnte: 0.5,
    })
    s().initTableConfig()
  })

  it('post recoloca os blinds/straddle em SB/BB/STR', () => {
    s().updateBet('sb', 0)
    s().updateRole('sb', 'post')
    expect(s().currentScenario.sb.bet).toBe(0.5)
    s().updateBet('bb', 0)
    s().updateRole('bb', 'post')
    expect(s().currentScenario.bb.bet).toBe(1.0)
    s().updateBet('str', 0)
    s().updateRole('str', 'post')
    expect(s().currentScenario.str.bet).toBe(2.0)
  })

  it('fold mantém a aposta do blind em SB/BB/STR e zera as demais posições', () => {
    s().updateRole('sb', 'fold')
    expect(s().currentScenario.sb.bet).toBe(0.5)
    s().updateRole('bb', 'fold')
    expect(s().currentScenario.bb.bet).toBe(1.0)
    s().updateRole('str', 'fold')
    expect(s().currentScenario.str.bet).toBe(2.0)
    s().updateBet('utg', 3)
    s().updateRole('utg', 'fold')
    expect(s().currentScenario.utg.bet).toBe(0)
  })

  it('limp/limp-fold usam 2bb em 8-max', () => {
    s().updateRole('utg', 'limp')
    expect(s().currentScenario.utg.bet).toBe(2)
    s().updateRole('mp', 'limp-fold')
    expect(s().currentScenario.mp.bet).toBe(2)
  })

  it('limp usa 1bb e open 2.5bb em 6-max', () => {
    useStore.setState({
      activePositions: POS_6MAX,
      activeSlots: SLOTS_6MAX,
      currentTableSize: 6,
      currentHasStraddle: false,
      currentAnte: 0,
    })
    s().initTableConfig()
    s().updateRole('utg', 'limp')
    expect(s().currentScenario.utg.bet).toBe(1)
    s().updateRole('co', 'open')
    expect(s().currentScenario.co.bet).toBe(2.5)
  })

  it('iso triplica a maior aposta vigente', () => {
    s().updateBet('utg', 2)
    s().updateRole('co', 'iso')
    expect(s().currentScenario.co.bet).toBe(6)
  })
})

describe('setupNewRange e setters simples', () => {
  it('setupNewRange 8-max com straddle posta STR em 2bb', () => {
    s().setupNewRange(8, true, 0.5)
    expect(s().currentScenario.str.role).toBe('post')
    expect(s().currentScenario.str.bet).toBe(2.0)
    expect(s().currentAnte).toBe(0.5)
  })

  it('setCurrentAnte e setHeroRaiseSize atualizam o estado', () => {
    s().setCurrentAnte(0.25)
    expect(s().currentAnte).toBe(0.25)
    s().setHeroRaiseSize(3)
    expect(s().currentHeroRaiseSize).toBe(3)
  })

  it('setRangesFilter / setAcceptAnyFreq / setFocusErrors / setUseRng', () => {
    s().setRangesFilter('CUSTOM')
    expect(s().rangesFilter).toBe('CUSTOM')
    s().setAcceptAnyFreq(true)
    expect(s().acceptAnyFreq).toBe(true)
    s().setFocusErrors(true)
    expect(s().focusErrors).toBe(true)
    s().setUseRng(true)
    expect(s().useRngForFrequency).toBe(true)
  })

  it('logout limpa userMode e adminToken', () => {
    useStore.setState({ userMode: 'admin', adminToken: { token: 'x', expiresAt: 1 } })
    s().logout()
    expect(s().userMode).toBeNull()
    expect(s().adminToken).toBeNull()
  })

  it('setAdminWorkerUrl persiste em localStorage', () => {
    s().setAdminWorkerUrl('https://exemplo.dev/w')
    expect(s().adminWorkerUrl).toBe('https://exemplo.dev/w')
    expect(localStorage.getItem('admin-worker-url')).toBe('https://exemplo.dev/w')
  })
})

describe('deleteRange registra ids de admin deletados', () => {
  it('deletar um range nativo (admin) grava o id em fbr-deleted-admin-ids', () => {
    localStorage.removeItem('fbr-deleted-admin-ids')
    const adminRange = s().ranges[0]
    expect(adminRange).toBeTruthy()
    s().deleteRange(adminRange.id)
    expect(s().ranges.find(r => r.id === adminRange.id)).toBeUndefined()
    const deleted = JSON.parse(localStorage.getItem('fbr-deleted-admin-ids') ?? '[]')
    expect(deleted).toContain(adminRange.id)
  })
})
