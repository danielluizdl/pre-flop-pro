import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { POS_8MAX, SLOTS_8MAX } from '../types'

const s = () => useStore.getState()

beforeEach(() => {
  useStore.setState({
    activePositions: POS_8MAX,
    activeSlots: SLOTS_8MAX,
    currentTableSize: 8,
    currentHasStraddle: true,
    currentAnte: 0.5,
    currentHeroRaiseSize: 0,
    tempScenarios: [],
  })
  s().initTableConfig()
})

describe('initTableConfig / setupNewRange', () => {
  it('initTableConfig posta blinds e straddle, folda o resto', () => {
    const sc = s().currentScenario
    expect(sc.sb.role).toBe('post')
    expect(sc.sb.bet).toBe(0.5)
    expect(sc.bb.bet).toBe(1.0)
    expect(sc.str.role).toBe('post')
    expect(sc.str.bet).toBe(2.0)
    expect(sc.utg.role).toBe('fold')
    expect(sc.btn.stack).toBe(250)
  })

  it('setupNewRange para 8-max sem straddle deixa STR foldado', () => {
    s().setupNewRange(8, false, 0.5)
    expect(s().currentScenario.str.role).toBe('fold')
    expect(s().page).toBe('editor')
    expect(s().rangeData.tableSize).toBe(8)
  })
})

describe('updateHero / updateRole / updateBet / updateStack', () => {
  it('updateHero marca só uma posição como hero', () => {
    s().updateHero('btn')
    expect(s().currentScenario.btn.isHero).toBe(true)
    expect(s().currentScenario.co.isHero).toBe(false)
    s().updateHero('co')
    expect(s().currentScenario.btn.isHero).toBe(false)
    expect(s().currentScenario.co.isHero).toBe(true)
  })

  it('updateRole open usa 6bb em 8-max', () => {
    s().updateRole('btn', 'open')
    expect(s().currentScenario.btn.bet).toBe(6)
  })

  it('updateRole 3bet triplica a maior aposta vigente', () => {
    s().updateBet('co', 6)
    s().updateRole('btn', '3bet')
    expect(s().currentScenario.btn.bet).toBe(18)
  })

  it('updateRole call iguala a maior aposta da mesa', () => {
    s().updateBet('co', 6)
    s().updateRole('btn', 'call')
    expect(s().currentScenario.btn.bet).toBe(6)
  })

  it('updateRole allin usa o stack da posição', () => {
    s().updateStack('btn', 120)
    s().updateRole('btn', 'allin')
    expect(s().currentScenario.btn.bet).toBe(120)
  })

  it('setAllStacks aplica o mesmo stack a todos', () => {
    s().setAllStacks(80)
    expect(Object.values(s().currentScenario).every(p => p.stack === 80)).toBe(true)
  })
})

describe('buffer de cenários', () => {
  it('addScenarioToBuffer guarda cópia do cenário com o heroRaiseSize', () => {
    useStore.setState({ currentHeroRaiseSize: 4 })
    s().addScenarioToBuffer('5.0', 'BTN Open')
    const buf = s().tempScenarios
    expect(buf).toHaveLength(1)
    expect(buf[0].pot).toBe('5.0')
    expect(buf[0].summary).toBe('BTN Open')
    expect(buf[0].heroRaiseSize).toBe(4)
  })

  it('addScenarioToBuffer omite heroRaiseSize quando é 0', () => {
    useStore.setState({ currentHeroRaiseSize: 0 })
    s().addScenarioToBuffer('3.0', 'X')
    expect(s().tempScenarios[0].heroRaiseSize).toBeUndefined()
  })

  it('updateScenarioInBuffer atualiza só o índice alvo', () => {
    s().addScenarioToBuffer('3.0', 'A')
    s().addScenarioToBuffer('4.0', 'B')
    s().updateScenarioInBuffer(1, '9.0', 'B editado')
    expect(s().tempScenarios[0].summary).toBe('A')
    expect(s().tempScenarios[1].summary).toBe('B editado')
    expect(s().tempScenarios[1].pot).toBe('9.0')
  })

  it('removeScenario remove pelo índice', () => {
    s().addScenarioToBuffer('3.0', 'A')
    s().addScenarioToBuffer('4.0', 'B')
    s().removeScenario(0)
    expect(s().tempScenarios).toHaveLength(1)
    expect(s().tempScenarios[0].summary).toBe('B')
  })

  it('loadScenarioFromBuffer restaura cenário/ante/raise', () => {
    s().updateStack('btn', 90)
    useStore.setState({ currentHeroRaiseSize: 2, currentAnte: 1 })
    s().addScenarioToBuffer('3.0', 'A')
    s().setAllStacks(250)
    useStore.setState({ currentHeroRaiseSize: 0, currentAnte: 0.5 })
    s().loadScenarioFromBuffer(0)
    expect(s().currentScenario.btn.stack).toBe(90)
    expect(s().currentHeroRaiseSize).toBe(2)
    expect(s().currentAnte).toBe(1)
  })

  it('loadScenarioFromBuffer ignora índice inexistente', () => {
    const before = s().currentScenario
    s().loadScenarioFromBuffer(99)
    expect(s().currentScenario).toBe(before)
  })
})
