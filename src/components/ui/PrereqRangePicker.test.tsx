import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { PrereqRangePicker } from './PrereqRangePicker'
import { makeEmptyGrid } from '../../utils/hands'
import type { Range } from '../../types'

function makeRange(id: number, name: string, positions: string[]): Range {
  return {
    id,
    name,
    positions,
    grid: { ...makeEmptyGrid(), AA: { fold: 0, call: 0, raise: 100, allin: 0 } },
    scenarios: [],
    tableSize: 8,
  }
}

const RANGES = [
  makeRange(1, 'BTN Open', ['BTN']),
  makeRange(2, 'CO Open', ['CO']),
  makeRange(3, 'BTN vs CO', ['BTN']),
]

describe('PrereqRangePicker', () => {
  it('lista os ranges disponíveis agrupados por posição', () => {
    render(
      <PrereqRangePicker
        ranges={RANGES}
        excludeId={null}
        filterPositions={[]}
        currentPrereqId={undefined}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByText('Selecionar Range Pré-requisito')).toBeInTheDocument()
    expect(screen.getByText('BTN Open')).toBeInTheDocument()
    expect(screen.getByText('CO Open')).toBeInTheDocument()
    expect(screen.getByText('— sem pré-requisito —')).toBeInTheDocument()
  })

  it('exclui o próprio range (excludeId)', () => {
    render(
      <PrereqRangePicker
        ranges={RANGES}
        excludeId={1}
        filterPositions={[]}
        currentPrereqId={undefined}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.queryByText('BTN Open')).not.toBeInTheDocument()
    expect(screen.getByText('BTN vs CO')).toBeInTheDocument()
  })

  it('filtra por posição quando filterPositions é informado', () => {
    render(
      <PrereqRangePicker
        ranges={RANGES}
        excludeId={null}
        filterPositions={['CO']}
        currentPrereqId={undefined}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByText('CO Open')).toBeInTheDocument()
    expect(screen.queryByText('BTN Open')).not.toBeInTheDocument()
  })

  it('chama onSelect e onClose ao escolher um range', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <PrereqRangePicker
        ranges={RANGES}
        excludeId={null}
        filterPositions={[]}
        currentPrereqId={undefined}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    await userEvent.click(screen.getByText('CO Open'))
    expect(onSelect).toHaveBeenCalledWith(2)
    expect(onClose).toHaveBeenCalled()
  })

  it('seleciona "sem pré-requisito" com null', async () => {
    const onSelect = vi.fn()
    render(
      <PrereqRangePicker
        ranges={RANGES}
        excludeId={null}
        filterPositions={[]}
        currentPrereqId={1}
        onSelect={onSelect}
        onClose={() => {}}
      />
    )
    await userEvent.click(screen.getByText('— sem pré-requisito —'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('colapsa e reabre um grupo de posição ao clicar no cabeçalho', async () => {
    render(
      <PrereqRangePicker
        ranges={RANGES}
        excludeId={null}
        filterPositions={[]}
        currentPrereqId={undefined}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByText('BTN Open')).toBeInTheDocument()
    const header = screen.getByText('BTN').closest('button')!
    await userEvent.click(header)
    expect(screen.queryByText('BTN Open')).not.toBeInTheDocument()
    await userEvent.click(header)
    expect(screen.getByText('BTN Open')).toBeInTheDocument()
  })

  it('marca o range atualmente selecionado como pré-requisito', () => {
    render(
      <PrereqRangePicker
        ranges={RANGES}
        excludeId={null}
        filterPositions={[]}
        currentPrereqId={2}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )
    const selected = screen.getByText('CO Open').closest('button')!
    expect(selected.className).toContain('border-brand-600/60')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(
      <PrereqRangePicker
        ranges={RANGES}
        excludeId={null}
        filterPositions={[]}
        currentPrereqId={undefined}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
