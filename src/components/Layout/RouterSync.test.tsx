import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { RouterSync } from './RouterSync'
import { useStore } from '../../store/useStore'

function LocationProbe({ onPath }: { onPath: (p: string) => void }) {
  const loc = useLocation()
  onPath(loc.pathname)
  return null
}

function renderAt(initialPath: string, onPath: (p: string) => void) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <RouterSync />
      <LocationProbe onPath={onPath} />
    </MemoryRouter>,
  )
}

describe('RouterSync', () => {
  it('mapeia rota desconhecida para dashboard', () => {
    useStore.setState({ page: 'dashboard' })
    renderAt('/inexistente', () => {})
    expect(useStore.getState().page).toBe('dashboard')
  })

  it('redireciona pagina transiente acessada direto para /ranges', () => {
    useStore.setState({ page: 'dashboard' })
    let path = ''
    renderAt('/editor', p => { path = p })
    expect(useStore.getState().page).toBe('ranges')
    expect(path).toBe('/ranges')
  })

  it('espelha mudanca de page no store para a URL', () => {
    useStore.setState({ page: 'dashboard' })
    let path = ''
    renderAt('/dashboard', p => { path = p })
    act(() => { useStore.setState({ page: 'history' }) })
    expect(path).toBe('/historico')
  })

  it('mapeia rota conhecida estavel sem alterar o store', () => {
    useStore.setState({ page: 'ranges' })
    let path = ''
    renderAt('/ranges', p => { path = p })
    expect(useStore.getState().page).toBe('ranges')
    expect(path).toBe('/ranges')
  })

  it('nao renderiza nada visivel', () => {
    useStore.setState({ page: 'dashboard' })
    const { container } = renderAt('/dashboard', () => {})
    expect(container).toBeEmptyDOMElement()
  })
})
