import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { OnboardingTour } from './OnboardingTour'
import { useStore } from '../../store/useStore'

function renderWithTargets(step: number) {
  useStore.setState({ onboardingStep: step })
  return render(
    <>
      <button data-tour="drill">Drill</button>
      <button data-tour="exercise">Range Check</button>
      <button data-tour="history">Histórico</button>
      <OnboardingTour />
    </>,
  )
}

describe('OnboardingTour', () => {
  it('mostra o passo 1 (Drill) com botão Próximo', () => {
    renderWithTargets(0)
    expect(screen.getByText('Aqui é o Drill')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeInTheDocument()
  })

  it('avança pro passo 2 (Range Check) ao clicar em Próximo', () => {
    renderWithTargets(0)
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(useStore.getState().onboardingStep).toBe(1)
  })

  it('no último passo o botão vira "Concluir" e encerra o tour ao clicar', () => {
    renderWithTargets(2)
    expect(screen.getByText('Aqui é o seu Histórico')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(useStore.getState().onboardingStep).toBeNull()
  })

  it('"Pular tour" encerra imediatamente em qualquer passo', () => {
    renderWithTargets(0)
    fireEvent.click(screen.getByRole('button', { name: 'Pular tour' }))
    expect(useStore.getState().onboardingStep).toBeNull()
  })

  it('Esc encerra o tour', () => {
    renderWithTargets(1)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(useStore.getState().onboardingStep).toBeNull()
  })

  it('clicar no fundo (fora do painel) encerra o tour', () => {
    const { container } = renderWithTargets(0)
    const backdrop = container.querySelector('[style*="z-index"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(useStore.getState().onboardingStep).toBeNull()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = renderWithTargets(0)
    expect((await axe(container)).violations).toEqual([])
  })
})
