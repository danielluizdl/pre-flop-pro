import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renderiza decorativo (aria-hidden) com a classe extra', () => {
    const { container } = render(<Skeleton className="h-4 w-10" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el.className).toContain('h-4')
    expect(el.className).toContain('animate-pulse')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<div role="status" aria-busy="true" aria-label="Carregando"><Skeleton className="h-4 w-full" /></div>)
    expect((await axe(container)).violations).toEqual([])
  })
})
