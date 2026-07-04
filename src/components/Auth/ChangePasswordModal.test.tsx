import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { ChangePasswordModal } from './ChangePasswordModal'
import { useStore } from '../../store/useStore'

afterEach(() => vi.restoreAllMocks())

describe('ChangePasswordModal', () => {
  it('renderiza os campos de nova senha', () => {
    render(<ChangePasswordModal />)
    expect(screen.getByText('Defina sua senha')).toBeInTheDocument()
    expect(screen.getByLabelText('Nova senha:')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar senha:')).toBeInTheDocument()
  })

  it('valida senha curta', () => {
    render(<ChangePasswordModal />)
    fireEvent.change(screen.getByLabelText('Nova senha:'), { target: { value: 'curta' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha:'), { target: { value: 'curta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }))
    expect(screen.getByText('Senha deve ter ao menos 8 caracteres')).toBeInTheDocument()
  })

  it('valida senhas que não coincidem', () => {
    render(<ChangePasswordModal />)
    fireEvent.change(screen.getByLabelText('Nova senha:'), { target: { value: 'senha1234' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha:'), { target: { value: 'senha9999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }))
    expect(screen.getByText('As senhas não coincidem')).toBeInTheDocument()
  })

  it('chama changePassword quando válido', () => {
    const changePassword = vi.fn().mockResolvedValue({ ok: true })
    useStore.setState({ changePassword })
    render(<ChangePasswordModal />)
    fireEvent.change(screen.getByLabelText('Nova senha:'), { target: { value: 'senha1234' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha:'), { target: { value: 'senha1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }))
    expect(changePassword).toHaveBeenCalledWith('senha1234')
  })

  it('Enter no campo de confirmação submete', async () => {
    const changePassword = vi.fn().mockResolvedValue({ ok: true })
    useStore.setState({ changePassword })
    render(<ChangePasswordModal />)
    fireEvent.change(screen.getByLabelText('Nova senha:'), { target: { value: 'senha1234' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha:'), { target: { value: 'senha1234' } })
    fireEvent.keyDown(screen.getByLabelText('Confirmar senha:'), { key: 'Enter' })
    expect(changePassword).toHaveBeenCalledWith('senha1234')
  })

  it('erro do servidor é exibido', async () => {
    const changePassword = vi.fn().mockResolvedValue({ ok: false, error: 'Falhou no servidor' })
    useStore.setState({ changePassword })
    render(<ChangePasswordModal />)
    fireEvent.change(screen.getByLabelText('Nova senha:'), { target: { value: 'senha1234' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha:'), { target: { value: 'senha1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }))
    expect(await screen.findByText('Falhou no servidor')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<ChangePasswordModal />)
    expect((await axe(container)).violations).toEqual([])
  })
})
