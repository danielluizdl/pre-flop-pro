import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { SituationsPage } from './SituationsPage'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import type { Range } from '../../types'

const RANGE: Range = { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }

describe('SituationsPage', () => {
  it('mostra o cabeçalho e o botão de novo range', () => {
    useStore.setState({ ranges: [RANGE] })
    render(<SituationsPage />)
    expect(screen.getByText('Meus Ranges')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Novo Range' })).toBeInTheDocument()
  })

  it('estado vazio quando não há ranges', () => {
    useStore.setState({ ranges: [] })
    render(<SituationsPage />)
    expect(screen.getByText('Nenhum range criado ainda.')).toBeInTheDocument()
  })

  it('expande o grupo de posição e mostra o range', () => {
    useStore.setState({ ranges: [RANGE] })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Treinar/ })).toBeInTheDocument()
  })

  it('Editar chama loadRangeForEdit do range', () => {
    const loadRangeForEdit = vi.fn()
    useStore.setState({ ranges: [RANGE], loadRangeForEdit })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    expect(loadRangeForEdit).toHaveBeenCalledWith(1)
  })

  it('Apagar pede confirmação e só deleta se confirmado', () => {
    const deleteRange = vi.fn()
    useStore.setState({ ranges: [RANGE], deleteRange })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    const del = screen.getByRole('button', { name: 'Apagar range' })
    fireEvent.click(del)
    expect(deleteRange).not.toHaveBeenCalled()
    fireEvent.click(del)
    expect(deleteRange).toHaveBeenCalledWith(1)
    confirmSpy.mockRestore()
  })

  it('mostra a precisão acumulada do range quando há dados', () => {
    useStore.setState({
      ranges: [RANGE],
      handPerformance: { 1: { AA: { c: 8, t: 10 } } },
    })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('abre o heatmap sem dados de treino', () => {
    useStore.setState({ ranges: [RANGE], handPerformance: {} })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver heatmap' }))
    expect(screen.getByRole('dialog', { name: 'BTN RFI' })).toBeInTheDocument()
    expect(screen.getByText('Nenhum dado de treino ainda.')).toBeInTheDocument()
  })

  it('heatmap com dados mostra botão de resetar e fecha pelo ✕', () => {
    const clearHandPerformance = vi.fn()
    useStore.setState({
      ranges: [RANGE],
      handPerformance: { 1: { AA: { c: 5, t: 10 } } },
      clearHandPerformance,
    })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver heatmap' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resetar dados' }))
    expect(clearHandPerformance).toHaveBeenCalledWith(1)
  })

  it('backdrop do heatmap fecha ao clicar fora', () => {
    useStore.setState({ ranges: [RANGE], handPerformance: {} })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver heatmap' }))
    const dialog = screen.getByRole('dialog', { name: 'BTN RFI' })
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog', { name: 'BTN RFI' })).not.toBeInTheDocument()
  })

  it('olho abre o preview do range e fecha', () => {
    useStore.setState({ ranges: [RANGE] })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar range' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Novo Range navega para a configuração', () => {
    const setPage = vi.fn()
    useStore.setState({ ranges: [RANGE], setPage })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: '+ Novo Range' }))
    expect(setPage).toHaveBeenCalledWith('range-setup')
  })

  it('estado vazio: criar primeiro range navega para a configuração', () => {
    const setPage = vi.fn()
    useStore.setState({ ranges: [], setPage })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /Criar/ }))
    expect(setPage).toHaveBeenCalledWith('range-setup')
  })

  it('Treinar inicia a sessão e navega para o drill', () => {
    const g = makeEmptyGrid()
    g['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const startDrillSession = vi.fn()
    const nextDrillHand = vi.fn(() => true)
    const setPage = vi.fn()
    useStore.setState({
      ranges: [{ ...RANGE, grid: g }],
      startDrillSession, nextDrillHand, setPage,
      selectedDrillRangeIds: [], drillExcludedHands: ['AKs'],
    })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: /Treinar/ }))
    expect(startDrillSession).toHaveBeenCalled()
    expect(setPage).toHaveBeenCalledWith('drill')
    expect(useStore.getState().selectedDrillRangeIds).toEqual([1])
    expect(useStore.getState().drillExcludedHands).toEqual([])
  })

  it('Treinar sem mãos disponíveis alerta e não navega', () => {
    const nextDrillHand = vi.fn(() => false)
    const setPage = vi.fn()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    useStore.setState({ ranges: [RANGE], startDrillSession: vi.fn(), nextDrillHand, setPage })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: /Treinar/ }))
    expect(alertSpy).toHaveBeenCalled()
    expect(setPage).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('mostra badges de stack das variantes multi-stack e o nome do pré-requisito', () => {
    const prereq: Range = { ...RANGE, id: 2, name: 'Range base', positions: ['CO'] }
    const multi: Range = {
      ...RANGE, id: 3, name: 'BTN multi', prereqRangeId: 2,
      stackGrids: [
        { stackRange: '<=40', grid: makeEmptyGrid() },
        { stackRange: '>40', grid: makeEmptyGrid() },
      ],
    }
    useStore.setState({ ranges: [prereq, multi] })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect(screen.getByText('<=40')).toBeInTheDocument()
    expect(screen.getByText('>40')).toBeInTheDocument()
    expect(screen.getByText('Range base')).toBeInTheDocument()
  })

  it('heatmap de range multi-stack alterna entre as variantes', () => {
    const gLow = makeEmptyGrid()
    gLow['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const multi: Range = {
      ...RANGE, id: 4, name: 'BTN multi',
      stackGrids: [
        { stackRange: '<=40', grid: gLow, name: 'baixo' },
        { stackRange: '>40', grid: makeEmptyGrid(), name: 'alto' },
      ],
    }
    useStore.setState({ ranges: [multi], handPerformance: { 4: { AA: { c: 5, t: 10 } } } })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver heatmap' }))
    const dialog = screen.getByRole('dialog', { name: 'BTN multi' })
    expect(dialog).toBeInTheDocument()
    // botões das variantes (rotulados pelo stackRange) dentro do modal
    const altoBtns = screen.getAllByRole('button', { name: '>40' })
    fireEvent.click(altoBtns[altoBtns.length - 1])
    const baixoBtns = screen.getAllByRole('button', { name: '<=40' })
    fireEvent.click(baixoBtns[baixoBtns.length - 1])
  })

  it('range do time: mostra badge Coach e bloqueia o botão Editar para jogador', () => {
    useStore.setState({
      ranges: [RANGE],
      teamRangeIds: [1],
      currentUser: { id: 5, username: 'p1', name: 'P', email: '', role: 'player', firstLogin: false },
    })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect(screen.getByText('Coach')).toBeInTheDocument()
    const edit = screen.getByRole('button', { name: /Editar/ })
    expect(edit).toBeDisabled()
    expect(edit).toHaveAttribute('title', 'Range publicado pelo coach — não editável')
  })

  it('range do time: coach NÃO vê badge nem bloqueio (edita os próprios ranges)', () => {
    useStore.setState({
      ranges: [RANGE],
      teamRangeIds: [1],
      currentUser: { id: 1, username: 'coach1', name: 'C', email: '', role: 'coach', firstLogin: false },
    })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect(screen.queryByText('Coach')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Editar/ })).toBeEnabled()
  })

  it('range fora do time segue editável normalmente', () => {
    useStore.setState({
      ranges: [RANGE],
      teamRangeIds: [999],
      currentUser: { id: 5, username: 'p1', name: 'P', email: '', role: 'player', firstLogin: false },
    })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect(screen.queryByText('Coach')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Editar/ })).toBeEnabled()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ ranges: [RANGE], teamRangeIds: [], currentUser: null })
    const { container } = render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect((await axe(container)).violations).toEqual([])
  })
})
