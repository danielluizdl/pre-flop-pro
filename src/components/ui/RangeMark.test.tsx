import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RangeMark } from './RangeMark'

describe('RangeMark', () => {
  it('renderiza 16 células no grid 4x4', () => {
    const { container } = render(<RangeMark size={40} />)
    const grid = container.firstChild as HTMLElement
    expect(grid.children).toHaveLength(16)
  })

  it('aplica a largura informada e a cor padrão nas células ativas', () => {
    const { container } = render(<RangeMark size={80} />)
    const grid = container.firstChild as HTMLElement
    expect(grid.style.width).toBe('80px')
    const firstCell = grid.children[0] as HTMLElement
    expect(firstCell.style.background).toContain('rgb(217, 119, 87)')
  })

  it('respeita a cor custom', () => {
    const { container } = render(<RangeMark size={40} color="#00ff00" />)
    const firstCell = (container.firstChild as HTMLElement).children[0] as HTMLElement
    expect(firstCell.style.background).toContain('rgb(0, 255, 0)')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<RangeMark size={40} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
