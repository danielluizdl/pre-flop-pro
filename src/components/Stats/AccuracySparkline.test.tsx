import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { AccuracySparkline } from './AccuracySparkline'
import type { TrainingSession } from '../../types'

function session(over: Partial<TrainingSession>): TrainingSession {
  return {
    id: 1,
    timestamp: 1_700_000_000_000,
    rangeNames: ['BTN open'],
    tableSize: 6,
    hands: 10,
    correct: 8,
    errors: 2,
    consults: 0,
    durationSeconds: 120,
    ...over,
  }
}

describe('AccuracySparkline', () => {
  it('não renderiza nada com menos de 2 sessões com mãos', () => {
    const { container } = render(<AccuracySparkline sessions={[session({ id: 1 })]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('ignora sessões sem mãos ao contar o mínimo', () => {
    const { container } = render(
      <AccuracySparkline sessions={[session({ id: 1 }), session({ id: 2, hands: 0, correct: 0 })]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza o gráfico e a referência de 80% com 2+ sessões', () => {
    const sessions = [
      session({ id: 1, hands: 10, correct: 9 }),
      session({ id: 2, hands: 10, correct: 5 }),
      session({ id: 3, hands: 10, correct: 7 }),
    ]
    const { container } = render(<AccuracySparkline sessions={sessions} />)
    expect(screen.getByText('Evolução da precisão')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(container.querySelectorAll('circle')).toHaveLength(3)
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const sessions = [
      session({ id: 1, hands: 10, correct: 9 }),
      session({ id: 2, hands: 10, correct: 5 }),
    ]
    const { container } = render(<AccuracySparkline sessions={sessions} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
