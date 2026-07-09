import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { PageTutorialButton } from './PageTutorialButton'
import { useStore } from '../../store/useStore'

describe('PageTutorialButton', () => {
  it('clicar chama startPageTutorial com o scope da página', () => {
    const startPageTutorial = vi.fn()
    useStore.setState({ startPageTutorial })
    render(<PageTutorialButton scope="drill" />)
    fireEvent.click(screen.getByRole('button', { name: 'Tutorial' }))
    expect(startPageTutorial).toHaveBeenCalledWith('drill')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<PageTutorialButton scope="stats" />)
    expect((await axe(container)).violations).toEqual([])
  })
})
