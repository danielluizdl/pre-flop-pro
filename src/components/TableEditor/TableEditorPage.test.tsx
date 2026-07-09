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

function paintedGrid() {
  const g = makeEmptyGrid()
  g.AA = { fold: 0, call: 0, raise: 100, allin: 0 }
  return g
}

function setup(over: Record<string, unknown> = {}) {
  useStore.setState({
    activePositions: POS_8MAX, activeSlots: SLOTS_8MAX, currentTableSize: 8,
    currentScenario: fullScenario(), currentAnte: 0.5, tempScenarios: [], currentHeroRaiseSize: 0,
    rangeData: { id: null, name: 'BTN RFI', grid: paintedGrid(), positions: ['BTN'], tableSize: 8, stackRange: '' },
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

  it('finalizar sem nenhuma mão pintada alerta e não finaliza nem pede confirmação de cenário', () => {
    const finalizeRange = vi.fn()
    const addScenarioToBuffer = vi.fn()
    setup({
      finalizeRange,
      addScenarioToBuffer,
      tempScenarios: [],
      rangeData: { id: null, name: 'BTN RFI', grid: makeEmptyGrid(), positions: ['BTN'], tableSize: 8, stackRange: '' },
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }))
    expect(alertSpy).toHaveBeenCalledWith('Pinte pelo menos uma mão na matriz antes de finalizar — um range sem mãos não é salvo.')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(addScenarioToBuffer).not.toHaveBeenCalled()
    expect(finalizeRange).not.toHaveBeenCalled()
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
      sessionGrids: [{ name: 'BTN 100bb', stackRange: '<=100bb', grid: paintedGrid(), positions: ['BTN'] }],
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

  it('modal de nome: confirmar com nome vazio alerta e não finaliza', () => {
    const finalizeRange = vi.fn()
    setup({
      finalizeRange,
      tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }],
      sessionGrids: [{ name: '', stackRange: '<=100bb', grid: paintedGrid(), positions: ['BTN'] }],
      rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: ['BTN'], tableSize: 8, stackRange: '' },
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(alertSpy).toHaveBeenCalled()
    expect(finalizeRange).not.toHaveBeenCalled()
  })

  it('finalizar sem cenários e recusar a confirmação não salva nada', () => {
    const finalizeRange = vi.fn()
    const addScenarioToBuffer = vi.fn()
    setup({ finalizeRange, addScenarioToBuffer, tempScenarios: [] })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }))
    expect(addScenarioToBuffer).not.toHaveBeenCalled()
    expect(finalizeRange).not.toHaveBeenCalled()
  })

  it('cenário salvo com um stack destoante mostra o label "* Nbb"', () => {
    const data = fullScenario()
    data[POS_8MAX[0].id] = { ...data[POS_8MAX[0].id], stack: 120 }
    setup({ tempScenarios: [{ id: 1, data, pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }] })
    render(<TableEditorPage />)
    expect(screen.getByText(/\* 120bb/)).toBeInTheDocument()
  })

  it('mudar a aposta e o stack de uma posição chama updateBet/updateStack', () => {
    const updateBet = vi.fn()
    const updateStack = vi.fn()
    setup({ updateBet, updateStack })
    render(<TableEditorPage />)
    const betInputs = screen.getAllByRole('spinbutton', { name: /Aposta/ })
    fireEvent.change(betInputs[0], { target: { value: '3' } })
    expect(updateBet).toHaveBeenCalled()
    const stackInputs = screen.getAllByRole('spinbutton', { name: /Stack de/ })
    fireEvent.change(stackInputs[0], { target: { value: '100' } })
    expect(updateStack).toHaveBeenCalled()
  })

  it('stack customizado: digitar e aplicar chama setAllStacks; zero não chama', () => {
    const setAllStacks = vi.fn()
    setup({ setAllStacks })
    render(<TableEditorPage />)
    const input = screen.getByLabelText('Stack para todos os jogadores')
    fireEvent.change(input, { target: { value: '80' } })
    fireEvent.click(screen.getByTitle('Aplicar'))
    expect(setAllStacks).toHaveBeenCalledWith(80)
    setAllStacks.mockClear()
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByTitle('Aplicar'))
    expect(setAllStacks).not.toHaveBeenCalled()
  })

  it('input de raise futuro do herói chama setHeroRaiseSize', () => {
    const setHeroRaiseSize = vi.fn()
    setup({ setHeroRaiseSize })
    render(<TableEditorPage />)
    fireEvent.change(screen.getByLabelText('Tamanho do raise futuro'), { target: { value: '3.5' } })
    expect(setHeroRaiseSize).toHaveBeenCalledWith(3.5)
  })

  it('entrar em edição e cancelar volta ao botão de adicionar cenário', () => {
    setup({ tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }] })
    render(<TableEditorPage />)
    const matches = screen.getAllByText(/BTN Open/)
    fireEvent.click(matches[matches.length - 1])
    expect(screen.getByRole('button', { name: /Salvar alterações/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: /Adicionar Cenário/ })).toBeInTheDocument()
  })

  it('modal de nome: Enter no campo confirma e chama finalizeRange', () => {
    const finalizeRange = vi.fn()
    setup({
      finalizeRange,
      tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }],
      sessionGrids: [{ name: 'BTN 100bb', stackRange: '<=100bb', grid: paintedGrid(), positions: ['BTN'] }],
    })
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }))
    const input = screen.getByDisplayValue('BTN 100bb')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(finalizeRange).toHaveBeenCalledWith('BTN 100bb')
  })

  it('modal de nome: Cancelar e backdrop fecham sem finalizar', () => {
    const finalizeRange = vi.fn()
    setup({
      finalizeRange,
      tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }],
      sessionGrids: [{ name: 'BTN 100bb', stackRange: '<=100bb', grid: paintedGrid(), positions: ['BTN'] }],
    })
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(finalizeRange).not.toHaveBeenCalled()
    // reabre e fecha pelo backdrop
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('modal de nome: remover uma variação de grid da sessão chama removeSessionGrid', () => {
    const removeSessionGrid = vi.fn()
    const playedGrid = () => { const g = makeEmptyGrid(); g['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }; return g }
    setup({
      removeSessionGrid,
      tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }],
      sessionGrids: [
        { name: 'BTN 100bb', stackRange: '<=100bb', grid: playedGrid(), positions: ['BTN'] },
        { name: 'BTN 40bb', stackRange: '<=40bb', grid: playedGrid(), positions: ['BTN'] },
      ],
    })
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }))
    const dialog = screen.getByRole('dialog')
    const removeButtons = dialog.querySelectorAll('button.absolute')
    expect(removeButtons.length).toBeGreaterThan(0)
    fireEvent.click(removeButtons[0])
    expect(removeSessionGrid).toHaveBeenCalled()
  })

  it('marcar o herói de uma posição chama updateHero', () => {
    const updateHero = vi.fn()
    setup({ updateHero })
    render(<TableEditorPage />)
    const heroRadios = screen.getAllByRole('radio')
    fireEvent.click(heroRadios[0])
    expect(updateHero).toHaveBeenCalled()
  })

  it('remover o cenário em edição limpa o modo de edição', () => {
    const removeScenario = vi.fn()
    setup({
      removeScenario,
      tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }],
    })
    render(<TableEditorPage />)
    const matches = screen.getAllByText(/BTN Open/)
    fireEvent.click(matches[matches.length - 1])
    expect(screen.getByRole('button', { name: /Salvar alterações/ })).toBeInTheDocument()
    const removeBtn = document.querySelector('button.text-red-400')!
    fireEvent.click(removeBtn)
    expect(removeScenario).toHaveBeenCalledWith(0)
    expect(screen.queryByRole('button', { name: /Salvar alterações/ })).not.toBeInTheDocument()
  })

  it('modal de nome ao editar range existente pré-preenche com o nome atual do range', () => {
    setup({
      rangeData: { id: 42, name: 'BTN RFI', grid: makeEmptyGrid(), positions: ['BTN'], tableSize: 8, stackRange: '' },
      ranges: [{ id: 42, name: 'Range existente', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }],
      tempScenarios: [{ id: 1, data: fullScenario(), pot: '5.0', ante: 0.5, summary: 'BTN Open (2bb)' }],
      sessionGrids: [{ name: 'BTN 100bb', stackRange: '<=100bb', grid: paintedGrid(), positions: ['BTN'] }],
    })
    render(<TableEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }))
    expect(screen.getByDisplayValue('Range existente')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    setup()
    const { container } = render(<TableEditorPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
