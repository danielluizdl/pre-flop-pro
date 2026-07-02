import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { RangeSetupPage } from './RangeSetupPage'
import { useStore } from '../../store/useStore'

describe('RangeSetupPage', () => {
  beforeEach(() => {
    useStore.setState({ setupNewRange: vi.fn(), setPage: vi.fn() })
  })

  it('mostra as perguntas iniciais com defaults (8-max, straddle, ante)', () => {
    render(<RangeSetupPage />)
    expect(screen.getByText('Quantos players?')).toBeInTheDocument()
    expect(screen.getByText('Terá Straddle obrigatório?')).toBeInTheDocument()
    expect(screen.getByText('Terá ante?')).toBeInTheDocument()
  })

  it('esconde a pergunta de straddle ao escolher 6-max', async () => {
    render(<RangeSetupPage />)
    expect(screen.getByText('Terá Straddle obrigatório?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '6-max' }))
    expect(screen.queryByText('Terá Straddle obrigatório?')).not.toBeInTheDocument()
  })

  it('esconde o input de ante ao escolher "Não"', async () => {
    render(<RangeSetupPage />)
    expect(screen.getByText('Quanto o ante?')).toBeInTheDocument()
    const anteBox = screen.getByText('Terá ante?').closest('div') as HTMLElement
    await userEvent.click(within(anteBox).getByRole('button', { name: 'Não' }))
    expect(screen.queryByText('Quanto o ante?')).not.toBeInTheDocument()
  })

  it('chama setupNewRange com os defaults ao continuar', async () => {
    const setupNewRange = vi.fn()
    useStore.setState({ setupNewRange })
    render(<RangeSetupPage />)
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(setupNewRange).toHaveBeenCalledWith(8, true, 0.5)
  })

  it('passa straddle=false em 6-max', async () => {
    const setupNewRange = vi.fn()
    useStore.setState({ setupNewRange })
    render(<RangeSetupPage />)
    await userEvent.click(screen.getByRole('button', { name: '6-max' }))
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(setupNewRange).toHaveBeenCalledWith(6, false, 0.5)
  })

  it('cancelar volta para o dashboard', async () => {
    const setPage = vi.fn()
    useStore.setState({ setPage })
    render(<RangeSetupPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(setPage).toHaveBeenCalledWith('dashboard')
  })

  it('ante "Não" chama setupNewRange com ante 0', async () => {
    const setupNewRange = vi.fn()
    useStore.setState({ setupNewRange })
    render(<RangeSetupPage />)
    const anteBox = screen.getByText('Terá ante?').closest('div') as HTMLElement
    await userEvent.click(within(anteBox).getByRole('button', { name: 'Não' }))
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(setupNewRange).toHaveBeenCalledWith(8, true, 0)
  })

  it('mudar o valor do ante reflete no setupNewRange', async () => {
    const setupNewRange = vi.fn()
    useStore.setState({ setupNewRange })
    render(<RangeSetupPage />)
    const input = screen.getByLabelText('Quanto o ante?') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1.5' } })
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(setupNewRange).toHaveBeenCalledWith(8, true, 1.5)
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<RangeSetupPage />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
