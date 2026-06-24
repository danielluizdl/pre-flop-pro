import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RangeActionGrid, type ActionFreq } from './RangeActionGrid'

describe('RangeActionGrid', () => {
  it('renderiza título, subtítulo e as 169 células', () => {
    const { container } = render(<RangeActionGrid title="Range real" subtitle="gabarito" grid={{}} />)
    expect(screen.getByRole('heading', { name: 'Range real' })).toBeInTheDocument()
    expect(screen.getByText('gabarito')).toBeInTheDocument()
    expect(screen.getByText('AA')).toBeInTheDocument()
    expect(screen.getByText('72o')).toBeInTheDocument()
    const cells = container.querySelectorAll('.aspect-square')
    expect(cells).toHaveLength(169)
  })

  it('mostra tooltip com as frequências ao passar o mouse numa mão', () => {
    const grid: Record<string, ActionFreq> = { AA: { raise: 100 } }
    render(<RangeActionGrid title="t" grid={grid} />)
    fireEvent.mouseEnter(screen.getByText('AA'))
    expect(screen.getByText('100% Raise')).toBeInTheDocument()
  })

  it('compõe frequências mistas com fold residual no tooltip', () => {
    const grid: Record<string, ActionFreq> = { KK: { raise: 60, call: 20 } }
    render(<RangeActionGrid title="t" grid={grid} />)
    fireEvent.mouseEnter(screen.getByText('KK'))
    expect(screen.getByText('60% Raise · 20% Call · 20% Fold')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<RangeActionGrid title="Range real" grid={{ AA: { raise: 100 } }} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  }, 20000)
})
