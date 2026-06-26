import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { AdminPanel } from './AdminPanel'
import { useStore } from '../../store/useStore'

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ ranges: [], adminToken: null, adminLastError: undefined})
})

describe('AdminPanel', () => {
  it('modo nao-controlado mostra os botoes Publicar e Sair, sem modal', () => {
    render(<AdminPanel />)
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Publicar Ranges' })).not.toBeInTheDocument()
  })

  it('modo controlado aberto exibe o modal com campo de senha', () => {
    render(<AdminPanel open onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Publicar Ranges' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('publica chamando adminSaveRanges e mostra confirmacao', async () => {
    const adminSaveRanges = vi.fn().mockResolvedValue('ok')
    useStore.setState({ adminSaveRanges })
    render(<AdminPanel open onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'segredo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(adminSaveRanges).toHaveBeenCalledWith('segredo')
    expect(await screen.findByText(/Publicado\./)).toBeInTheDocument()
  })

  it('senha incorreta exibe mensagem de erro', async () => {
    const adminSaveRanges = vi.fn().mockResolvedValue('wrong_password')
    useStore.setState({ adminSaveRanges })
    render(<AdminPanel open onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'xxx' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText('Senha incorreta.')).toBeInTheDocument()
  })

  it('o botao Publicar fica desabilitado sem senha', () => {
    render(<AdminPanel open onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled()
  })

  it('nao tem violacoes de acessibilidade no modal (axe)', async () => {
    const { container } = render(<AdminPanel open onClose={() => {}} />)
    expect((await axe(container)).violations).toEqual([])
  })
})
