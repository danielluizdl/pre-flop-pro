import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useModalA11y } from './useModalA11y'

function Modal({ open = true, onClose }: { open?: boolean; onClose?: () => void }) {
  const ref = useModalA11y<HTMLDivElement>(open, onClose)
  return (
    <div ref={ref} role="dialog" aria-label="teste">
      <button>primeiro</button>
      <button>meio</button>
      <button>último</button>
    </div>
  )
}

describe('useModalA11y', () => {
  it('move o foco inicial para o primeiro elemento focável', () => {
    render(<Modal onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'primeiro' })).toHaveFocus()
  })

  it('Esc chama onClose quando fornecido', () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('modal obrigatório (sem onClose) ignora o Esc', () => {
    render(<Modal />)
    // não deve lançar nem fechar nada
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Tab no último elemento volta o foco para o primeiro (trap)', () => {
    render(<Modal onClose={() => {}} />)
    const last = screen.getByRole('button', { name: 'último' })
    last.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'primeiro' })).toHaveFocus()
  })

  it('Shift+Tab no primeiro elemento vai para o último (trap)', () => {
    render(<Modal onClose={() => {}} />)
    const first = screen.getByRole('button', { name: 'primeiro' })
    first.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'último' })).toHaveFocus()
  })
})
