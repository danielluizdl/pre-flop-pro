import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { PokerTableEditor } from './PokerTableEditor'
import { useStore } from '../../store/useStore'
import { POS_6MAX, SLOTS_6MAX, type PositionConfig } from '../../types'

function scenario(): Record<string, PositionConfig> {
  const s: Record<string, PositionConfig> = {}
  POS_6MAX.forEach(p => {
    s[p.id] = { role: 'fold', bet: 0, isHero: false, stack: 100 }
  })
  s.sb = { role: 'post', bet: 0.5, isHero: false, stack: 100 }
  s.bb = { role: 'post', bet: 1, isHero: false, stack: 100 }
  s.btn = { role: 'open', bet: 2.5, isHero: true, stack: 100 }
  return s
}

beforeEach(() => {
  useStore.setState({
    activePositions: POS_6MAX,
    activeSlots: SLOTS_6MAX,
    currentScenario: scenario(),
    currentAnte: 0,
    currentTableSize: 6,
  })
})

describe('PokerTableEditor', () => {
  it('renderiza o pote e os assentos das posições', () => {
    render(<PokerTableEditor />)
    expect(screen.getByText('Pote')).toBeInTheDocument()
    expect(screen.getByText('BTN')).toBeInTheDocument()
    expect(screen.getByText('SB')).toBeInTheDocument()
    expect(screen.getAllByText('BB').length).toBeGreaterThan(0)
  })

  it('mostra o botão do dealer (D)', () => {
    render(<PokerTableEditor />)
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('renderiza as cartas do herói quando heroCards é fornecido', () => {
    render(<PokerTableEditor heroCards={{ r1: 'A', s1: 'h', r2: 'K', s2: 's' }} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('K')).toBeInTheDocument()
    expect(screen.getByText('♥')).toBeInTheDocument()
    expect(screen.getByText('♠')).toBeInTheDocument()
  })

  it('renderiza a pilha de fichas do ante quando há ante', () => {
    useStore.setState({ currentAnte: 0.5 })
    render(<PokerTableEditor />)
    expect(screen.getByText(/3 bb/)).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<PokerTableEditor heroCards={{ r1: 'A', s1: 'h', r2: 'K', s2: 's' }} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
