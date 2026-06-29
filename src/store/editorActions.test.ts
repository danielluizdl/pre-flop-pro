import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import type { PositionConfig } from '../types'

function seat(over: Partial<PositionConfig> = {}): PositionConfig {
  return { role: 'fold', bet: 0, isHero: false, stack: 250, ...over }
}

describe('toggleEditorPosition (single-select)', () => {
  beforeEach(() => useStore.setState({ selectedEditorPositions: [] }))

  it('seleciona uma posição quando nada está selecionado', () => {
    useStore.getState().toggleEditorPosition('BTN')
    expect(useStore.getState().selectedEditorPositions).toEqual(['BTN'])
  })

  it('clicar na posição já selecionada deseleciona', () => {
    useStore.setState({ selectedEditorPositions: ['BTN'] })
    useStore.getState().toggleEditorPosition('BTN')
    expect(useStore.getState().selectedEditorPositions).toEqual([])
  })

  it('clicar em outra posição troca (mantém no máximo 1)', () => {
    useStore.setState({ selectedEditorPositions: ['BTN'] })
    useStore.getState().toggleEditorPosition('CO')
    expect(useStore.getState().selectedEditorPositions).toEqual(['CO'])
  })
})

describe('updateRole — apostas dos blinds', () => {
  beforeEach(() => {
    useStore.setState({
      currentTableSize: 6,
      currentScenario: {
        sb:  seat({ role: 'post', bet: 0.5 }),
        bb:  seat({ role: 'post', bet: 1.0 }),
        btn: seat({ role: 'open', bet: 2.5 }),
      },
    })
  })

  it('fold em SB/BB mantém a aposta do blind na mesa', () => {
    useStore.getState().updateRole('sb', 'fold')
    useStore.getState().updateRole('bb', 'fold')
    const s = useStore.getState().currentScenario
    expect(s.sb.role).toBe('fold')
    expect(s.sb.bet).toBe(0.5)
    expect(s.bb.bet).toBe(1.0)
  })

  it('fold em posição não-blind zera a aposta', () => {
    useStore.getState().updateRole('btn', 'fold')
    expect(useStore.getState().currentScenario.btn.bet).toBe(0)
  })

  it('open usa 2.5bb em 6-max e 6bb em 8-max', () => {
    useStore.getState().updateRole('btn', 'open')
    expect(useStore.getState().currentScenario.btn.bet).toBe(2.5)
    useStore.setState({ currentTableSize: 8 })
    useStore.getState().updateRole('btn', 'open')
    expect(useStore.getState().currentScenario.btn.bet).toBe(6)
  })

  it('call iguala a maior aposta da mesa', () => {
    useStore.getState().updateRole('bb', 'call')
    expect(useStore.getState().currentScenario.bb.bet).toBe(2.5)
  })
})
