import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TableEditorPage } from './TableEditorPage'
import { useStore } from '../../store/useStore'
import { POS_8MAX, SLOTS_8MAX } from '../../types'
import { makeEmptyGrid } from '../../utils/hands'
import type { PositionConfig } from '../../types'

function fullScenario(): Record<string, PositionConfig> {
  const s: Record<string, PositionConfig> = {}
  POS_8MAX.forEach((p, i) => {
    s[p.id] = { role: i === 7 ? 'open' : 'fold', bet: i === 7 ? 2 : 0, isHero: i === 7, stack: 250 }
  })
  return s
}

function setup(over: Record<string, unknown> = {}) {
  useStore.setState({
    activePositions: POS_8MAX, activeSlots: SLOTS_8MAX, currentTableSize: 8,
    currentScenario: fullScenario(), currentAnte: 0.5, tempScenarios: [], currentHeroRaiseSize: 0,
    rangeData: { id: null, name: 'BTN RFI', grid: makeEmptyGrid(), positions: ['BTN'], tableSize: 8, stackRange: '' },
    sessionGrids: [],
    ...over,
  })
}

afterEach(() => vi.restoreAllMocks())

describe('TableEditorPage', () => {
  it('mostra o cabeçalho de configurar cenários', () => {
    setup()
    render(<TableEditorPage />)
    expect(screen.getByText('Configurar Cenários')).toBeInTheDocument()
  })

  it('"Adicionar Cenário" empilha no buffer', () => {
    const addScenarioToBuffer = vi.fn()
    setup({ addScenarioToBuffer })
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Cenário/ }))
    expect(addScenarioToBuffer).toHaveBeenCalled()
  })

  it('botão global de stack chama setAllStacks', () => {
    const setAllStacks = vi.fn()
    setup({ setAllStacks })
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: '100bb' }))
    expect(setAllStacks).toHaveBeenCalledWith(100)
  })

  it('trocar a ação de uma posição chama updateRole', () => {
    const updateRole = vi.fn()
    setup({ updateRole })
    render(<TableEditorPage />)
    fireEvent.change(screen.getByLabelText("Ação de BTN"), { target: { value: '3bet' } })
    expect(updateRole).toHaveBeenCalledWith('btn', '3bet')
  })

  it('lista cenários salvos e entra em edição ao clicar', () => {
    const loadScenarioFromBuffer = vi.fn()
    setup({
      loadScenarioFromBuffer,
      tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }],
    })
    render(<TableEditorPage />)
    expect(screen.getByText('Cenários Salvos (1)')).toBeInTheDocument()
    const matches = screen.getAllByText(/BTN Open/)
    fireEvent.click(matches[matches.length - 1])
    expect(loadScenarioFromBuffer).toHaveBeenCalledWith(0)
    expect(screen.getByRole('button', { name: /Salvar alterações/ })).toBeInTheDocument()
  })

  it('remover um cenário salvo chama removeScenario', () => {
    const removeScenario = vi.fn()
    setup({
      removeScenario,
      tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }],
    })
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(removeScenario).toHaveBeenCalledWith(0)
  })

  it('finalizar sem cenários pede confirmação e salva o atual', () => {
    const addScenarioToBuffer = vi.fn()
    const finalizeRange = vi.fn()
    setup({ addScenarioToBuffer, finalizeRange })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(addScenarioToBuffer).toHaveBeenCalled()
    expect(finalizeRange).toHaveBeenCalled()
  })

  it('"Voltar" navega para o editor', () => {
    const setPage = vi.fn()
    setup({ setPage })
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }))
    expect(setPage).toHaveBeenCalledWith('editor')
  })

  it('editar um cenário e salvar chama updateScenarioInBuffer', () => {
    const updateScenarioInBuffer = vi.fn()
    setup({
      updateScenarioInBuffer,
      tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }],
    })
    render(<TableEditorPage />)
    const matches = screen.getAllByText(/BTN Open/)
    fireEvent.click(matches[matches.length - 1])
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }))
    expect(updateScenarioInBuffer).toHaveBeenCalledWith(0, expect.any(String), expect.any(String))
  })

  it('finalizar com grids de mesma posição na sessão abre o modal de nome', () => {
    const finalizeRange = vi.fn()
    setup({
      finalizeRange,
      tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }],
      sessionGrids: [{ name: 'BTN 100bb', stackRange: '<=100bb', grid: makeEmptyGrid(), positions: ['BTN'] }],
    })
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }))
    // modal de nome aberto em vez de finalizar direto
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(finalizeRange).not.toHaveBeenCalled()
    // confirmar com nome → finalizeRange(nome)
    const input = screen.getByDisplayValue('BTN 100bb')
    fireEvent.change(input, { target: { value: 'BTN combinado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(finalizeRange).toHaveBeenCalledWith('BTN combinado')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    setup()
    const { container } = render(<TableEditorPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
