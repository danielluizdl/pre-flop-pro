import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RangeEditorPage } from './RangeEditorPage'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import { POS_8MAX } from '../../types'

function setup(over: Record<string, unknown> = {}) {
  useStore.setState({
    activePositions: POS_8MAX,
    selectedEditorPositions: [],
    rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
    sessionGrids: [],
    ...over,
  })
}

afterEach(() => vi.restoreAllMocks())

describe('RangeEditorPage', () => {
  it('mostra o cabeçalho de criação e os botões de posição', () => {
    setup()
    render(<RangeEditorPage />)
    expect(screen.getByText('Criar Range')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'BTN' })).toBeInTheDocument()
  })

  it('digitar o nome atualiza o rangeData', () => {
    setup()
    render(<RangeEditorPage />)
    fireEvent.change(screen.getByPlaceholderText('Ex: Defesa BB vs UTG'), { target: { value: 'BTN vs SB' } })
    expect(useStore.getState().rangeData.name).toBe('BTN vs SB')
  })

  it('preset de stack seta e re-clicar limpa', () => {
    setup()
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: '250-300bb' }))
    expect(useStore.getState().rangeData.stackRange).toBe('250-300bb')
    fireEvent.click(screen.getByRole('button', { name: '250-300bb' }))
    expect(useStore.getState().rangeData.stackRange).toBe('')
  })

  it('botão "limpar" zera o stack range textual', () => {
    setup({ rangeData: { id: null, name: 'X', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '120bb' } })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: 'limpar' }))
    expect(useStore.getState().rangeData.stackRange).toBe('')
  })

  it('"Salvar e criar" sem nome dispara alerta de validação', () => {
    setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Salvar e criar/ }))
    expect(alertSpy).toHaveBeenCalled()
  })

  it('abre o seletor de pré-requisito', () => {
    setup({ ranges: [{ id: 9, name: 'BB defesa', positions: ['BB'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }] })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /sem pré-requisito/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('"Limpar Grid" pede confirmação antes de resetar', () => {
    setup()
    const resetGrid = vi.fn()
    useStore.setState({ resetGrid })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Limpar Grid' }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(resetGrid).toHaveBeenCalled()
  })

  it('lista grids salvos na sessão e entra em modo de edição ao clicar', () => {
    setup({
      sessionGrids: [{ name: 'Grid A', stackRange: '<=250bb', grid: makeEmptyGrid(), positions: ['BTN'] }],
    })
    render(<RangeEditorPage />)
    expect(screen.getByText('Salvos nesta sessão (1)')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Grid A'))
    expect(screen.getByText('editando')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    setup()
    const { container } = render(<RangeEditorPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
