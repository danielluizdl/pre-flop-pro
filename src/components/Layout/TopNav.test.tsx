import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TopNav } from './TopNav'
import { useStore } from '../../store/useStore'
import { setLangDict } from '../../i18n'

function setup() {
  useStore.setState({ page: 'dashboard', userMode: null, currentUser: null, darkMode: false })
}

afterEach(() => { setLangDict('pt'); useStore.setState({ lang: 'pt' }) })

describe('TopNav', () => {
  it('renderiza a navegação, o botão de novo range e o perfil', () => {
    setup()
    render(<TopNav />)
    expect(screen.getByRole('button', { name: 'Drill' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Novo Range/ })).toBeInTheDocument()
    expect(screen.getByText('Visitante')).toBeInTheDocument()
  })

  it('mantém nomes acessíveis mesmo com rótulos ocultos no mobile', () => {
    setup()
    render(<TopNav />)
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Histórico' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo Range' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menu de conta' })).toBeInTheDocument()
  })

  it('clicar num item de navegação muda a página', () => {
    setup()
    const setPage = vi.fn()
    useStore.setState({ setPage })
    render(<TopNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Drill' }))
    expect(setPage).toHaveBeenCalledWith('drill')
    fireEvent.click(screen.getByRole('button', { name: /Novo Range/ }))
    expect(setPage).toHaveBeenCalledWith('range-setup')
  })

  it('alterna o modo escuro', () => {
    setup()
    const toggleDarkMode = vi.fn()
    useStore.setState({ toggleDarkMode })
    render(<TopNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Modo escuro' }))
    expect(toggleDarkMode).toHaveBeenCalled()
  })

  it('abre o menu de perfil e "Sair" faz logout', () => {
    setup()
    const authLogout = vi.fn()
    useStore.setState({ authLogout, currentUser: { id: 1, username: 'daniel', name: 'Daniel', email: '', role: 'player', firstLogin: false, tier: '', turma: null } })
    render(<TopNav />)
    expect(screen.queryByRole('button', { name: /Sair/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('daniel'))
    fireEvent.click(screen.getByRole('button', { name: /Sair/ }))
    expect(authLogout).toHaveBeenCalled()
  })

  it('menu do perfil mostra o idioma vigente e cicla ao clicar', () => {
    setup()
    useStore.setState({ currentUser: { id: 1, username: 'daniel', name: 'Daniel', email: '', role: 'player', firstLogin: false, tier: '', turma: null }, lang: 'pt' })
    render(<TopNav />)
    fireEvent.click(screen.getByText('daniel'))
    expect(screen.getByText('PT')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Idioma/ }))
    expect(useStore.getState().lang).toBe('en')
  })

  it('menu do perfil: "Rever tutorial" inicia o onboarding e fecha o menu', () => {
    setup()
    useStore.setState({
      currentUser: { id: 1, username: 'daniel', name: 'Daniel', email: '', role: 'player', firstLogin: false, tier: '', turma: null },
      onboardingStep: null,
    })
    render(<TopNav />)
    fireEvent.click(screen.getByText('daniel'))
    fireEvent.click(screen.getByRole('button', { name: 'Rever tutorial' }))
    expect(useStore.getState().onboardingStep).toBe(0)
    expect(screen.queryByRole('button', { name: /Sair/ })).not.toBeInTheDocument()
  })

  it('"Rever tutorial" sempre roda a sequência completa, mesmo vindo de um tutorial de página (scope) anterior', () => {
    setup()
    useStore.setState({
      currentUser: { id: 1, username: 'daniel', name: 'Daniel', email: '', role: 'player', firstLogin: false, tier: '', turma: null },
      onboardingStep: null,
      onboardingScope: 'drill',
    })
    render(<TopNav />)
    fireEvent.click(screen.getByText('daniel'))
    fireEvent.click(screen.getByRole('button', { name: 'Rever tutorial' }))
    expect(useStore.getState().onboardingStep).toBe(0)
    expect(useStore.getState().onboardingScope).toBeNull()
  })

  it('menu do perfil: "Editar conta" navega pra página de conta e fecha o menu', () => {
    setup()
    const setPage = vi.fn()
    useStore.setState({
      setPage,
      currentUser: { id: 1, username: 'daniel', name: 'Daniel', email: '', role: 'player', firstLogin: false, tier: '', turma: null },
    })
    render(<TopNav />)
    fireEvent.click(screen.getByText('daniel'))
    fireEvent.click(screen.getByRole('button', { name: 'Editar conta' }))
    expect(setPage).toHaveBeenCalledWith('account')
    expect(screen.queryByRole('button', { name: /Sair/ })).not.toBeInTheDocument()
  })

  it('mostra "Painel Coach" só para coach e navega para admin', () => {
    setup()
    const setPage = vi.fn()
    useStore.setState({ setPage, currentUser: { id: 1, username: 'coach', name: 'Coach', email: '', role: 'coach', firstLogin: false, tier: '', turma: null } })
    render(<TopNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Painel Coach' }))
    expect(setPage).toHaveBeenCalledWith('admin')
  })

  it('clicar fora fecha o menu de perfil', () => {
    setup()
    useStore.setState({ currentUser: { id: 1, username: 'daniel', name: 'Daniel', email: '', role: 'player', firstLogin: false, tier: '', turma: null } })
    render(<TopNav />)
    fireEvent.click(screen.getByText('daniel'))
    expect(screen.getByRole('button', { name: /Sair/ })).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('button', { name: /Sair/ })).not.toBeInTheDocument()
  })

  it('admin: botão "Publicar ranges" abre o modal de publicação', () => {
    setup()
    useStore.setState({ userMode: 'admin', ranges: [] })
    render(<TopNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Publicar ranges' }))
    expect(screen.getByRole('dialog', { name: 'Publicar Ranges' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    setup()
    const { container } = render(<TopNav />)
    expect((await axe(container)).violations).toEqual([])
  })
})
