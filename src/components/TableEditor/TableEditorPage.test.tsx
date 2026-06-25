import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TableEditorPage } from './TableEditorPage'
import { useStore } from '../../store/useStore'
import { POS_8MAX, SLOTS_8MAX } from '../../types'

function setup() {
  useStore.setState({
    activePositions: POS_8MAX, activeSlots: SLOTS_8MAX, currentTableSize: 8, currentScenario: {},
    currentAnte: 0.5, tempScenarios: [], currentHeroRaiseSize: 0,
  })
}

describe('TableEditorPage', () => {
  it('mostra o cabeçalho de configurar cenários', () => {
    setup()
    render(<TableEditorPage />)
    expect(screen.getByText('Configurar Cenários')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    setup()
    const { container } = render(<TableEditorPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
