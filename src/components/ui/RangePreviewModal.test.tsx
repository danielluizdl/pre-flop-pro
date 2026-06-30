import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RangePreviewModal } from './RangePreviewModal'
import { makeEmptyGrid } from '../../utils/hands'
import type { Range } from '../../types'

const RANGE: Range = {
  id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), tableSize: 8,
  scenarios: [{ id: 1, data: {}, pot: '2.5', ante: 0.5, summary: 'BTN abre' }],
}

describe('RangePreviewModal', () => {
  it('mostra o nome, a seção de cenários e o cenário', () => {
    render(<RangePreviewModal range={RANGE} onClose={() => {}} />)
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
    expect(screen.getByText('Cenários')).toBeInTheDocument()
    expect(screen.getByText('BTN abre')).toBeInTheDocument()
  })

  it('chama onClose ao clicar no botão de fechar', () => {
    const onClose = vi.fn()
    render(<RangePreviewModal range={RANGE} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('expõe semântica de diálogo rotulado', () => {
    render(<RangePreviewModal range={RANGE} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'BTN RFI' })).toBeInTheDocument()
  })

  it('fecha ao pressionar Esc', () => {
    const onClose = vi.fn()
    render(<RangePreviewModal range={RANGE} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('com stackGrids mostra seletor de grids e troca ao clicar', () => {
    const multi: Range = {
      ...RANGE,
      stackGrids: [
        { stackRange: '<=250bb', grid: makeEmptyGrid() },
        { stackRange: '>=300bb', grid: makeEmptyGrid() },
      ],
    }
    render(<RangePreviewModal range={multi} onClose={() => {}} />)
    const btn1 = screen.getByRole('button', { name: '<=250bb' })
    const btn2 = screen.getByRole('button', { name: '>=300bb' })
    expect(btn1.className).toContain('bg-brand-600')
    fireEvent.click(btn2)
    expect(btn2.className).toContain('bg-brand-600')
    expect(btn1.className).not.toContain('bg-brand-600')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<RangePreviewModal range={RANGE} onClose={() => {}} />)
    expect((await axe(container)).violations).toEqual([])
  })
})
