import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { AwayResumeModal } from './AwayResumeModal'

describe('AwayResumeModal', () => {
  it('mostra o título e o countdown formatado mm:ss', () => {
    render(<AwayResumeModal remainingMs={125_000} onContinue={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('2:05')).toBeInTheDocument()
  })

  it('chama onContinue ao clicar no botão', () => {
    const onContinue = vi.fn()
    render(<AwayResumeModal remainingMs={60_000} onContinue={onContinue} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('Esc não fecha o modal (ausência prolongada não deve ter saída acidental)', () => {
    const onContinue = vi.fn()
    render(<AwayResumeModal remainingMs={60_000} onContinue={onContinue} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onContinue).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<AwayResumeModal remainingMs={60_000} onContinue={() => {}} />)
    expect((await axe(container)).violations).toEqual([])
  })
})
