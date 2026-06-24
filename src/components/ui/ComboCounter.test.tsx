import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { ComboCounter } from './ComboCounter'
import { makeEmptyGrid } from '../../utils/hands'

describe('ComboCounter', () => {
  it('mostra o cabeçalho e a linha de total', () => {
    render(<ComboCounter grid={makeEmptyGrid()} />)
    expect(screen.getByText('Combos por ação')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('lista a ação pintada na mão', () => {
    const grid = { ...makeEmptyGrid(), AA: { fold: 0, call: 0, raise: 100, allin: 0 } }
    render(<ComboCounter grid={grid} />)
    expect(screen.getByText('Raise')).toBeInTheDocument()
  })

  it('usa o extraLabel custom quando há combos extra', () => {
    const grid = { ...makeEmptyGrid(), AA: { fold: 0, call: 0, raise: 0, allin: 0, extra: 100 } }
    render(<ComboCounter grid={grid} extraLabel="ISO" />)
    expect(screen.getByText('ISO')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<ComboCounter grid={makeEmptyGrid()} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
