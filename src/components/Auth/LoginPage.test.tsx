import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { LoginPage } from './LoginPage'
import { useStore } from '../../store/useStore'

afterEach(() => vi.restoreAllMocks())

describe('LoginPage', () => {
  it('renderiza o login com usuário, senha e botão Entrar', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText('Usuário:')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('alterna para cadastro mostrando os campos extras', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByLabelText('Nome Completo:')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail:')).toBeInTheDocument()
    expect(screen.getByLabelText('Código do time:')).toBeInTheDocument()
  })

  it('login chama authLogin com usuário e senha', () => {
    const authLogin = vi.fn().mockResolvedValue({ ok: true })
    useStore.setState({ authLogin })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Usuário:'), { target: { value: 'admin001' } })
    fireEvent.change(screen.getByLabelText('Senha:'), { target: { value: 'segredo123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(authLogin).toHaveBeenCalledWith('admin001', 'segredo123', null)
  })

  it('valida senha curta no cadastro', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fireEvent.change(screen.getByLabelText('Nome Completo:'), { target: { value: 'Daniel' } })
    fireEvent.change(screen.getByLabelText('E-mail:'), { target: { value: 'd@x.com' } })
    fireEvent.change(screen.getByLabelText('Usuário:'), { target: { value: 'daniel1' } })
    fireEvent.change(screen.getByLabelText('Senha:'), { target: { value: 'curta' } })
    fireEvent.change(screen.getByLabelText('Código do time:'), { target: { value: 'TIME' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByText('Senha deve ter ao menos 8 caracteres')).toBeInTheDocument()
  })

  it('abre o fluxo de esqueci a senha e volta ao login', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    expect(screen.getByText(/Peça ao coach do seu time/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<LoginPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
