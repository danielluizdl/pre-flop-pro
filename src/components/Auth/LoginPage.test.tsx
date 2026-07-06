import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { LoginPage, capitalizeWords } from './LoginPage'
import { useStore } from '../../store/useStore'

afterEach(() => vi.restoreAllMocks())

function fillSignupBasics(overrides: Partial<{
  name: string; email: string; username: string; password: string; confirmPassword: string; inviteCode: string
}> = {}) {
  const v = { name: 'Daniel Silva', email: 'd@x.com', username: 'daniel1', password: 'senhaforte1', confirmPassword: 'senhaforte1', inviteCode: 'TIME', ...overrides }
  fireEvent.change(screen.getByLabelText('Nome e Sobrenome:'), { target: { value: v.name } })
  fireEvent.change(screen.getByLabelText('E-mail:'), { target: { value: v.email } })
  fireEvent.change(screen.getByLabelText('Usuário:'), { target: { value: v.username } })
  fireEvent.change(screen.getByLabelText('Senha:'), { target: { value: v.password } })
  fireEvent.change(screen.getByLabelText('Confirmar senha:'), { target: { value: v.confirmPassword } })
  fireEvent.change(screen.getByLabelText('Código de convite:'), { target: { value: v.inviteCode } })
  fireEvent.click(screen.getByRole('button', { name: 'Tier Fundamentals' }))
  fireEvent.click(screen.getByRole('button', { name: 'A' }))
}

describe('capitalizeWords', () => {
  it('deixa a primeira letra de cada palavra maiúscula', () => {
    expect(capitalizeWords('daniel silva')).toBe('Daniel Silva')
    expect(capitalizeWords('MARIA DA SILVA')).toBe('MARIA DA SILVA')
    expect(capitalizeWords('joão')).toBe('João')
  })
})

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
    expect(screen.getByLabelText('Nome e Sobrenome:')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail:')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar senha:')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de convite:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tier Fundamentals' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Main Team' })).toBeInTheDocument()
  })

  it('nome e sobrenome capitaliza automaticamente enquanto digita', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fireEvent.change(screen.getByLabelText('Nome e Sobrenome:'), { target: { value: 'daniel silva' } })
    expect(screen.getByLabelText('Nome e Sobrenome:')).toHaveValue('Daniel Silva')
  })

  it('selecionar um tier (fora Main Team) revela a seleção de turma A-D; Main Team não revela', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.queryByText('Turma:')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tier Evolution' }))
    expect(screen.getByText('Turma:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Main Team' }))
    expect(screen.queryByText('Turma:')).not.toBeInTheDocument()
  })

  it('olho da senha alterna entre ocultar e mostrar o conteúdo digitado', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    const pass = screen.getByLabelText('Senha:')
    fireEvent.change(pass, { target: { value: 'senhaforte1' } })
    expect(pass).toHaveAttribute('type', 'password')
    // dois campos de senha (senha + confirmar) têm o mesmo aria-label de olho; o da senha vem primeiro no DOM
    fireEvent.click(screen.getAllByRole('button', { name: 'Mostrar senha' })[0])
    expect(pass).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getAllByRole('button', { name: 'Ocultar senha' })[0])
    expect(pass).toHaveAttribute('type', 'password')
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

  it('valida senha curta no cadastro (mínimo 6)', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fillSignupBasics({ password: 'curta', confirmPassword: 'curta' })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByText('Senha deve ter ao menos 6 caracteres')).toBeInTheDocument()
  })

  it('bloqueia quando senha e confirmação não coincidem', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fillSignupBasics({ password: 'senhaforte1', confirmPassword: 'senhaforte2' })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByText('As senhas não coincidem — corrija antes de continuar.')).toBeInTheDocument()
  })

  it('abre o fluxo de esqueci a senha e volta ao login', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    expect(screen.getByText(/Peça ao coach do seu time/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('login com falha exibe a mensagem de erro retornada', async () => {
    const authLogin = vi.fn().mockResolvedValue({ ok: false, error: 'credenciais inválidas' })
    useStore.setState({ authLogin })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Usuário:'), { target: { value: 'admin001' } })
    fireEvent.change(screen.getByLabelText('Senha:'), { target: { value: 'segredo123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('credenciais inválidas')).toBeInTheDocument()
  })

  it('valida usuário curto no cadastro', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fillSignupBasics({ username: 'curto' })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByText('Usuário deve ter ao menos 6 caracteres')).toBeInTheDocument()
  })

  it('valida e-mail inválido no cadastro', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fillSignupBasics({ email: 'sem-arroba' })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByText('Informe um e-mail válido')).toBeInTheDocument()
  })

  it('Enter no campo de senha dispara o login', () => {
    const authLogin = vi.fn().mockResolvedValue({ ok: true })
    useStore.setState({ authLogin })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Usuário:'), { target: { value: 'admin001' } })
    const pass = screen.getByLabelText('Senha:')
    fireEvent.change(pass, { target: { value: 'segredo123' } })
    fireEvent.keyDown(pass, { key: 'Enter' })
    expect(authLogin).toHaveBeenCalledWith('admin001', 'segredo123', null)
  })

  it('no cadastro, "Já tenho conta" volta ao login', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByLabelText('Nome e Sobrenome:')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Já tenho conta/ }))
    expect(screen.queryByLabelText('Nome e Sobrenome:')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('cadastro válido (tier fora Main Team) chama authSignup com tier/turma', async () => {
    const authSignup = vi.fn().mockResolvedValue({ ok: true })
    useStore.setState({ authSignup })
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fillSignupBasics()
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(authSignup).toHaveBeenCalledWith('daniel1', 'senhaforte1', 'TIME', 'Daniel Silva', 'd@x.com', 'fundamentals', 'A', null)
  })

  it('cadastro com Main Team envia turma null', async () => {
    const authSignup = vi.fn().mockResolvedValue({ ok: true })
    useStore.setState({ authSignup })
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fireEvent.change(screen.getByLabelText('Nome e Sobrenome:'), { target: { value: 'Daniel Silva' } })
    fireEvent.change(screen.getByLabelText('E-mail:'), { target: { value: 'd@x.com' } })
    fireEvent.change(screen.getByLabelText('Usuário:'), { target: { value: 'daniel1' } })
    fireEvent.change(screen.getByLabelText('Senha:'), { target: { value: 'senhaforte1' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha:'), { target: { value: 'senhaforte1' } })
    fireEvent.change(screen.getByLabelText('Código de convite:'), { target: { value: 'TIME' } })
    fireEvent.click(screen.getByRole('button', { name: 'Main Team' }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(authSignup).toHaveBeenCalledWith('daniel1', 'senhaforte1', 'TIME', 'Daniel Silva', 'd@x.com', 'main', null, null)
  })

  it('cadastro com falha exibe a mensagem de erro retornada', async () => {
    const authSignup = vi.fn().mockResolvedValue({ ok: false, error: 'código de convite inválido' })
    useStore.setState({ authSignup })
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fillSignupBasics({ inviteCode: 'ERRADO' })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('código de convite inválido')).toBeInTheDocument()
  })

  it('Enter nos campos do cadastro dispara authSignup', () => {
    const authSignup = vi.fn().mockResolvedValue({ ok: true })
    useStore.setState({ authSignup })
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fillSignupBasics()
    const code = screen.getByLabelText('Código de convite:')
    fireEvent.keyDown(code, { key: 'Enter' })
    expect(authSignup).toHaveBeenCalledWith('daniel1', 'senhaforte1', 'TIME', 'Daniel Silva', 'd@x.com', 'fundamentals', 'A', null)
  })

  it('Enter em Nome/E-mail/Usuário/Senhas do cadastro também submete', () => {
    const authSignup = vi.fn().mockResolvedValue({ ok: true })
    useStore.setState({ authSignup })
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fillSignupBasics()
    fireEvent.keyDown(screen.getByLabelText('Nome e Sobrenome:'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByLabelText('E-mail:'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByLabelText('Usuário:'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByLabelText('Confirmar senha:'), { key: 'Enter' })
    expect(authSignup).toHaveBeenCalledWith('daniel1', 'senhaforte1', 'TIME', 'Daniel Silva', 'd@x.com', 'fundamentals', 'A', null)
  })

  it('não submete sem os campos obrigatórios (guarda canSubmit)', () => {
    const authLogin = vi.fn().mockResolvedValue({ ok: true })
    useStore.setState({ authLogin })
    render(<LoginPage />)
    const pass = screen.getByLabelText('Senha:')
    fireEvent.keyDown(pass, { key: 'Enter' })
    expect(authLogin).not.toHaveBeenCalled()
  })

  it('não submete o cadastro sem selecionar tier/turma (botão fica desabilitado)', () => {
    const authSignup = vi.fn().mockResolvedValue({ ok: true })
    useStore.setState({ authSignup })
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fireEvent.change(screen.getByLabelText('Nome e Sobrenome:'), { target: { value: 'Daniel Silva' } })
    fireEvent.change(screen.getByLabelText('E-mail:'), { target: { value: 'd@x.com' } })
    fireEvent.change(screen.getByLabelText('Usuário:'), { target: { value: 'daniel1' } })
    fireEvent.change(screen.getByLabelText('Senha:'), { target: { value: 'senhaforte1' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha:'), { target: { value: 'senhaforte1' } })
    fireEvent.change(screen.getByLabelText('Código de convite:'), { target: { value: 'TIME' } })
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled()
    expect(authSignup).not.toHaveBeenCalled()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<LoginPage />)
    expect((await axe(container)).violations).toEqual([])
  })

  it('cadastro sem violações de acessibilidade com tier/turma revelados (axe)', async () => {
    const { container } = render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tier Fundamentals' }))
    expect((await axe(container)).violations).toEqual([])
  })
})
