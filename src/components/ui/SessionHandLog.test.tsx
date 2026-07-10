import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { SessionHandLog } from './SessionHandLog'
import type { HandHistoryEntry } from '../../types'

function entry(overrides: Partial<HandHistoryEntry> = {}): HandHistoryEntry {
  return {
    id: 1, hand: 'AKs', suits: ['h', 'h'], actionTaken: 'Raise', correctAction: 'Raise',
    rng: 42, correct: true, rangeName: 'BTN RFI', rangeId: 10, stackGridIdx: -1,
    ...overrides,
  }
}

describe('SessionHandLog', () => {
  it('abre o acordeão e lista as mãos com acerto e erro', () => {
    const log = [
      entry(),
      entry({ id: 2, hand: 'T9o', suits: ['c', 'd'], actionTaken: 'Call', correctAction: 'Fold', correct: false, severity: 'grave' }),
    ]
    render(<SessionHandLog handLog={log} />)
    expect(screen.getByText('(2)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mãos da sessão/ }))
    expect(screen.getAllByText('Raise').length).toBeGreaterThan(0)
    // erro mostra ação tomada → ação correta
    expect(screen.getByText('Call')).toBeInTheDocument()
    expect(screen.getByText('Fold')).toBeInTheDocument()
  })

  it('mostra o nome do range em cada mão quando a sessão tem mais de um range', () => {
    const log = [
      entry(),
      entry({ id: 2, rangeName: 'SB 3bet', rangeId: 11, stackRange: '40-100' }),
    ]
    render(<SessionHandLog handLog={log} />)
    fireEvent.click(screen.getByRole('button', { name: /Mãos da sessão/ }))
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
    expect(screen.getByText('SB 3bet · 40-100')).toBeInTheDocument()
  })

  it('não repete o nome do range quando a sessão tem um range só', () => {
    render(<SessionHandLog handLog={[entry(), entry({ id: 2 })]} />)
    fireEvent.click(screen.getByRole('button', { name: /Mãos da sessão/ }))
    expect(screen.queryByText('BTN RFI')).not.toBeInTheDocument()
  })

  it('sessão antiga sem handLog mostra aviso de indisponível', () => {
    render(<SessionHandLog />)
    fireEvent.click(screen.getByRole('button', { name: /Mãos da sessão/ }))
    expect(screen.getByText(/disponível apenas para sessões gravadas/)).toBeInTheDocument()
  })

  it('a11y: sem violações do axe aberto', async () => {
    const { container } = render(<SessionHandLog handLog={[entry()]} />)
    fireEvent.click(screen.getByRole('button', { name: /Mãos da sessão/ }))
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
