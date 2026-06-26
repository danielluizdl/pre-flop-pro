import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { BrushControls } from './BrushControls'
import { useStore } from '../../store/useStore'

function setBrushState(over: Partial<ReturnType<typeof useStore.getState>['brush']> = {}) {
  useStore.setState({
    brush: {
      call: 0, raise: 0, allin: 0, extra: 0,
      raiseSize: '', extraLabel: '', extraColor: '#a855f7',
      ...over,
    },
  })
}

describe('BrushControls', () => {
  beforeEach(() => setBrushState())

  it('mostra as linhas de ação e o fold read-only', () => {
    render(<BrushControls />)
    expect(screen.getByText('Fold')).toBeInTheDocument()
    expect(screen.getByText('Call')).toBeInTheDocument()
    expect(screen.getByText('Raise')).toBeInTheDocument()
    expect(screen.getByText('All-In')).toBeInTheDocument()
  })

  it('calcula o fold como 100 - soma das ações', () => {
    setBrushState({ call: 30, raise: 20 })
    render(<BrushControls />)
    const fold = screen.getByDisplayValue('50')
    expect(fold).toBeDisabled()
  })

  it('aplica o preset de 100% zerando as demais ações', async () => {
    render(<BrushControls />)
    const callPreset = screen.getAllByRole('button', { name: '100%' })[0]
    await userEvent.click(callPreset)
    expect(useStore.getState().brush.call).toBe(100)
    expect(useStore.getState().brush.raise).toBe(0)
  })

  it('clampeia a soma total para no máximo 100%', () => {
    setBrushState({ call: 60, raise: 30 })
    render(<BrushControls />)
    const spinners = screen.getAllByRole('spinbutton')
    fireEvent.change(spinners[2], { target: { value: '50' } })
    const b = useStore.getState().brush
    expect(b.call + b.raise + b.allin + b.extra).toBeLessThanOrEqual(100)
    expect(b.allin).toBe(50)
  })

  it('cria uma nova condição custom ao clicar "+ Nova Condição"', async () => {
    render(<BrushControls />)
    await userEvent.click(screen.getByRole('button', { name: /Nova Condição/ }))
    expect(useStore.getState().brush.extraLabel).toBe('Custom')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<BrushControls />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
