import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Turnstile, turnstileEnabled } from './Turnstile'

describe('Turnstile', () => {
  it('sem VITE_TURNSTILE_KEY o widget fica desabilitado e nao renderiza', () => {
    expect(turnstileEnabled).toBe(false)
    const { container } = render(<Turnstile onToken={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('nao chama onToken quando desabilitado', () => {
    let calls = 0
    render(<Turnstile onToken={() => { calls++ }} />)
    expect(calls).toBe(0)
  })

  it('nao tem violacoes de acessibilidade (axe)', async () => {
    const { container } = render(<Turnstile onToken={() => {}} />)
    expect((await axe(container)).violations).toEqual([])
  })
})
