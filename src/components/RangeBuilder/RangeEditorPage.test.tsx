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

  it('"PRÓXIMO" com nome e posição vai para o table-editor', () => {
    const initTableConfig = vi.fn()
    const setPage = vi.fn()
    setup({
      selectedEditorPositions: ['BTN'],
      rangeData: { id: null, name: 'BTN RFI', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
      initTableConfig, setPage,
    })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /PRÓXIMO/ }))
    expect(initTableConfig).toHaveBeenCalled()
    expect(setPage).toHaveBeenCalledWith('table-editor')
    expect(useStore.getState().rangeData.positions).toEqual(['BTN'])
  })

  it('"PRÓXIMO" sem nome dispara alerta e não navega', () => {
    const setPage = vi.fn()
    setup({ selectedEditorPositions: ['BTN'], setPage })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /PRÓXIMO/ }))
    expect(alertSpy).toHaveBeenCalled()
    expect(setPage).not.toHaveBeenCalled()
  })

  it('"Salvar e criar" válido empurra o grid para a sessão', () => {
    const pushGridToSession = vi.fn()
    setup({
      selectedEditorPositions: ['BTN'],
      rangeData: { id: null, name: 'BTN RFI', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
      pushGridToSession,
    })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Salvar e criar/ }))
    expect(pushGridToSession).toHaveBeenCalled()
  })

  it('modo de edição: salvar alterações chama updateSessionGrid quando há mudança', () => {
    const updateSessionGrid = vi.fn()
    setup({
      selectedEditorPositions: ['BTN'],
      sessionGrids: [{ name: 'Grid A', stackRange: '', grid: makeEmptyGrid(), positions: ['BTN'] }],
      updateSessionGrid,
    })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByText('Grid A'))
    // altera o nome → habilita "Salvar alterações"
    fireEvent.change(screen.getByPlaceholderText('Ex: Defesa BB vs UTG'), { target: { value: 'Grid A editado' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações no #1/ }))
    expect(updateSessionGrid).toHaveBeenCalledWith(0, expect.objectContaining({ name: 'Grid A editado' }))
  })

  it('"Salvar e criar" com stack sobreposto ao da sessão dispara alerta e não empurra', () => {
    const pushGridToSession = vi.fn()
    setup({
      selectedEditorPositions: ['BTN'],
      rangeData: { id: null, name: 'BTN 20-40', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '20-40' },
      sessionGrids: [{ name: 'BTN antigo', stackRange: '20-40', grid: makeEmptyGrid(), positions: ['BTN'] }],
      pushGridToSession,
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Salvar e criar/ }))
    expect(alertSpy).toHaveBeenCalled()
    expect(pushGridToSession).not.toHaveBeenCalled()
  })

  it('"PRÓXIMO" com editor vazio mas grids na sessão vai direto ao table-editor', () => {
    const initTableConfig = vi.fn()
    const setPage = vi.fn()
    setup({
      selectedEditorPositions: [],
      rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
      sessionGrids: [{ name: 'Grid A', stackRange: '', grid: makeEmptyGrid(), positions: ['BTN'] }],
      initTableConfig, setPage,
    })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /PRÓXIMO/ }))
    expect(initTableConfig).toHaveBeenCalled()
    expect(setPage).toHaveBeenCalledWith('table-editor')
  })

  it('modo de edição: "Cancelar" sai do modo sem salvar', () => {
    setup({
      selectedEditorPositions: [],
      sessionGrids: [{ name: 'Grid A', stackRange: '', grid: makeEmptyGrid(), positions: ['BTN'] }],
    })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByText('Grid A'))
    expect(screen.getByText('editando')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('editando')).not.toBeInTheDocument()
  })

  it('remover um grid da sessão pede confirmação e chama removeSessionGrid', () => {
    const removeSessionGrid = vi.fn()
    setup({
      sessionGrids: [
        { name: 'Grid A', stackRange: '<=40', grid: makeEmptyGrid(), positions: ['BTN'] },
        { name: 'Grid B', stackRange: '>40', grid: makeEmptyGrid(), positions: ['BTN'] },
      ],
      removeSessionGrid,
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { container } = render(<RangeEditorPage />)
    // o botão de remover é o X dentro do badge do grid
    const badges = container.querySelectorAll('.card-surface .relative')
    const removeBtn = badges[0].querySelector('button')!
    fireEvent.click(removeBtn)
    expect(confirmSpy).toHaveBeenCalledWith('Remover "Grid A (<=40)"?')
    expect(removeSessionGrid).toHaveBeenCalledWith(0)
  })

  it('recusar a confirmação não remove o grid da sessão', () => {
    const removeSessionGrid = vi.fn()
    setup({
      sessionGrids: [{ name: 'Grid A', stackRange: '', grid: makeEmptyGrid(), positions: ['BTN'] }],
      removeSessionGrid,
    })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { container } = render(<RangeEditorPage />)
    const removeBtn = container.querySelector('.card-surface .relative button')!
    fireEvent.click(removeBtn)
    expect(removeSessionGrid).not.toHaveBeenCalled()
  })

  it('digitar um stack range textual atualiza o rangeData', () => {
    setup()
    render(<RangeEditorPage />)
    fireEvent.change(screen.getByPlaceholderText('Ex: <= 250, ou 250-300'), { target: { value: '30-60bb' } })
    expect(useStore.getState().rangeData.stackRange).toBe('30-60bb')
  })

  it('selecionar pré-requisito no picker grava o prereqRangeId', () => {
    setup({
      ranges: [{ id: 9, name: 'BB defesa', positions: ['BB'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }],
    })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /sem pré-requisito/ }))
    fireEvent.click(screen.getByText('BB defesa'))
    expect(useStore.getState().rangeData.prereqRangeId).toBe(9)
  })

  it('clicar num botão de posição seleciona o HERO (single-select)', () => {
    setup()
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: 'BTN' }))
    expect(useStore.getState().selectedEditorPositions).toEqual(['BTN'])
  })

  it('"Salvar e criar" com nome mas sem posição dispara alerta de validação', () => {
    const pushGridToSession = vi.fn()
    setup({
      rangeData: { id: null, name: 'Sem posição', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
      pushGridToSession,
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Salvar e criar/ }))
    expect(alertSpy).toHaveBeenCalled()
    expect(pushGridToSession).not.toHaveBeenCalled()
  })

  it('"PRÓXIMO" com nome mas sem posição dispara alerta e não navega', () => {
    const setPage = vi.fn()
    setup({
      selectedEditorPositions: [],
      rangeData: { id: null, name: 'BTN RFI', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
      setPage,
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByRole('button', { name: /PRÓXIMO/ }))
    expect(alertSpy).toHaveBeenCalled()
    expect(setPage).not.toHaveBeenCalled()
  })

  it('modo de edição: salvar sem sobreposição ignora self e grids de outra posição', () => {
    const updateSessionGrid = vi.fn()
    setup({
      selectedEditorPositions: ['BTN'],
      sessionGrids: [
        { name: 'CO x',  stackRange: '20-40', grid: makeEmptyGrid(), positions: ['CO'] },
        { name: 'BTN A', stackRange: '20-40', grid: makeEmptyGrid(), positions: ['BTN'] },
        { name: 'BTN B', stackRange: '60-80', grid: makeEmptyGrid(), positions: ['BTN'] },
      ],
      updateSessionGrid,
    })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByText('BTN B'))
    fireEvent.change(screen.getByPlaceholderText('Ex: Defesa BB vs UTG'), { target: { value: 'BTN B v2' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações no #3/ }))
    expect(updateSessionGrid).toHaveBeenCalledWith(2, expect.objectContaining({ name: 'BTN B v2', stackRange: '60-80' }))
  })

  it('modo de edição: salvar com stack sobreposto a outro grid dispara alerta e não salva', () => {
    const updateSessionGrid = vi.fn()
    setup({
      selectedEditorPositions: ['BTN'],
      sessionGrids: [
        { name: 'BTN A', stackRange: '20-40', grid: makeEmptyGrid(), positions: ['BTN'] },
        { name: 'BTN B', stackRange: '60-80', grid: makeEmptyGrid(), positions: ['BTN'] },
      ],
      updateSessionGrid,
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByText('BTN B'))
    fireEvent.change(screen.getByPlaceholderText('Ex: <= 250, ou 250-300'), { target: { value: '30-50' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações no #2/ }))
    expect(alertSpy).toHaveBeenCalled()
    expect(updateSessionGrid).not.toHaveBeenCalled()
  })

  it('"PRÓXIMO" em modo de edição com mudança salva o grid antes de navegar', () => {
    const updateSessionGrid = vi.fn()
    const initTableConfig = vi.fn()
    const setPage = vi.fn()
    setup({
      selectedEditorPositions: ['BTN'],
      rangeData: { id: null, name: 'Base', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
      sessionGrids: [{ name: 'Grid A', stackRange: '', grid: makeEmptyGrid(), positions: ['BTN'] }],
      updateSessionGrid, initTableConfig, setPage,
    })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByText('Grid A'))
    fireEvent.change(screen.getByPlaceholderText('Ex: Defesa BB vs UTG'), { target: { value: 'Grid A editado' } })
    fireEvent.click(screen.getByRole('button', { name: /PRÓXIMO/ }))
    expect(updateSessionGrid).toHaveBeenCalled()
    expect(setPage).toHaveBeenCalledWith('table-editor')
  })

  it('"PRÓXIMO" em modo de edição sem mudança cancela a edição e navega', () => {
    const updateSessionGrid = vi.fn()
    const setPage = vi.fn()
    setup({
      selectedEditorPositions: ['BTN'],
      rangeData: { id: null, name: 'Base', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
      sessionGrids: [{ name: 'Grid A', stackRange: '', grid: makeEmptyGrid(), positions: ['BTN'] }],
      updateSessionGrid, setPage,
    })
    render(<RangeEditorPage />)
    fireEvent.click(screen.getByText('Grid A'))
    fireEvent.click(screen.getByRole('button', { name: /PRÓXIMO/ }))
    expect(updateSessionGrid).not.toHaveBeenCalled()
    expect(setPage).toHaveBeenCalledWith('table-editor')
  })

  it('remover o grid em edição cancela a edição', () => {
    const removeSessionGrid = vi.fn()
    setup({
      selectedEditorPositions: ['BTN'],
      sessionGrids: [{ name: 'Grid A', stackRange: '', grid: makeEmptyGrid(), positions: ['BTN'] }],
      removeSessionGrid,
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { container } = render(<RangeEditorPage />)
    fireEvent.click(screen.getByText('Grid A'))
    expect(screen.getByText('editando')).toBeInTheDocument()
    const removeBtn = container.querySelector('.card-surface .relative button')!
    fireEvent.click(removeBtn)
    expect(removeSessionGrid).toHaveBeenCalledWith(0)
    expect(screen.queryByText('editando')).not.toBeInTheDocument()
  })

  it('remover um grid anterior ao que está em edição decrementa o índice de edição', () => {
    const removeSessionGrid = vi.fn()
    setup({
      selectedEditorPositions: ['BTN'],
      sessionGrids: [
        { name: 'Grid A', stackRange: '', grid: makeEmptyGrid(), positions: ['BTN'] },
        { name: 'Grid B', stackRange: '', grid: makeEmptyGrid(), positions: ['BTN'] },
      ],
      removeSessionGrid,
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { container } = render(<RangeEditorPage />)
    fireEvent.click(screen.getByText('Grid B'))
    const badges = container.querySelectorAll('.card-surface .relative')
    fireEvent.click(badges[0].querySelector('button')!)
    expect(removeSessionGrid).toHaveBeenCalledWith(0)
    expect(screen.getByText('editando')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    setup()
    const { container } = render(<RangeEditorPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
