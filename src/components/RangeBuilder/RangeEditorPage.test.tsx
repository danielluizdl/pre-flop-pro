import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RangeEditorPage } from './RangeEditorPage'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import { POS_8MAX } from '../../types'

function setup() {
  useStore.setState({
    activePositions: POS_8MAX,
    selectedEditorPositions: [],
    rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
    sessionGrids: [],
  })
}

describe('RangeEditorPage', () => {
  it('mostra o cabeçalho de criação e os botões de posição', () => {
    setup()
    render(<RangeEditorPage />)
    expect(screen.getByText('Criar Range')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'BTN' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    setup()
    const { container } = render(<RangeEditorPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
