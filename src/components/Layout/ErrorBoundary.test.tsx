import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('explodiu')
}

describe('ErrorBoundary', () => {
  it('renderiza os filhos quando não há erro', () => {
    render(<ErrorBoundary><div>conteúdo ok</div></ErrorBoundary>)
    expect(screen.getByText('conteúdo ok')).toBeInTheDocument()
  })

  it('mostra o fallback quando um filho lança erro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar backup/ })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('não tem violações de acessibilidade no fallback (axe)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect((await axe(container)).violations).toEqual([])
    spy.mockRestore()
  })
})
