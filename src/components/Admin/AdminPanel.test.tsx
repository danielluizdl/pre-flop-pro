import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { AdminPanel } from './AdminPanel'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import { t } from '../../i18n'
import type { Range } from '../../types'

const INVALID_RANGE: Range = {
  id: 1, name: 'Incompleto', positions: ['BTN'], tableSize: 8, scenarios: [],
  grid: { ...makeEmptyGrid(), AA: { fold: 50, call: 0, raise: 0, allin: 0 } },
}

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
    expect(screen.getByRole('dialog', { name: 'Publicar Ranges' })).toBeInTheDocument()
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

  it('token expirado e erro generico exibem mensagens proprias', async () => {
    const adminSaveRanges = vi.fn().mockResolvedValue('token_expired')
    useStore.setState({ adminSaveRanges })
    const { unmount } = render(<AdminPanel open onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText(/Sessão expirada/)).toBeInTheDocument()
    unmount()

    const fail = vi.fn().mockResolvedValue('server_error')
    useStore.setState({ adminSaveRanges: fail, adminLastError: 'Falha 500' })
    render(<AdminPanel open onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText('Falha 500')).toBeInTheDocument()
  })

  it('range invalido bloqueia o publish ate marcar "Publicar mesmo assim"', () => {
    const adminSaveRanges = vi.fn().mockResolvedValue('ok')
    useStore.setState({ ranges: [INVALID_RANGE], adminSaveRanges })
    render(<AdminPanel open onClose={() => {}} />)
    expect(screen.getByText(/problema.* de validação encontrado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Corrija a validação' })).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'x' } })
    fireEvent.click(screen.getByLabelText('Publicar mesmo assim'))
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeEnabled()
  })

  it('descarta hash legado (JSON inteiro) guardado na chave de publish', () => {
    localStorage.setItem('pfp-last-published-hash', JSON.stringify([{ id: 1 }]))
    render(<AdminPanel open onClose={() => {}} />)
    expect(localStorage.getItem('pfp-last-published-hash')).toBeNull()
  })

  it('publish com sucesso guarda o hash e o botao vira "Ja publicado"', async () => {
    const adminSaveRanges = vi.fn().mockResolvedValue('ok')
    useStore.setState({ adminSaveRanges })
    render(<AdminPanel open onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'segredo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText(/Publicado\./)).toBeInTheDocument()
    expect(localStorage.getItem('pfp-last-published-hash')).not.toBeNull()
  })

  it('invalid_token e missing_token exibem as mensagens do Worker', async () => {
    const adminSaveRanges = vi.fn().mockResolvedValue('invalid_token')
    useStore.setState({ adminSaveRanges })
    render(<AdminPanel open onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText(/GITHUB_TOKEN expirado/)).toBeInTheDocument()

    adminSaveRanges.mockResolvedValue('missing_token')
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'y' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText(/GITHUB_TOKEN não configurado/)).toBeInTheDocument()
  })

  it('modo nao-controlado: clicar Publicar abre o modal interno', () => {
    render(<AdminPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(screen.getByRole('dialog', { name: 'Publicar Ranges' })).toBeInTheDocument()
  })

  it('Enter no campo de senha dispara o publish', async () => {
    const adminSaveRanges = vi.fn().mockResolvedValue('ok')
    useStore.setState({ adminSaveRanges })
    render(<AdminPanel open onClose={() => {}} />)
    const input = screen.getByPlaceholderText('••••••••')
    fireEvent.change(input, { target: { value: 'segredo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(adminSaveRanges).toHaveBeenCalledWith('segredo')
  })

  it('modo controlado: fechar pelo ✕ chama onClose externo', () => {
    const onClose = vi.fn()
    render(<AdminPanel open onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: t.common.close }))
    expect(onClose).toHaveBeenCalled()
  })

  it('modo nao-controlado: fechar o modal interno pelo ✕ o remove', () => {
    render(<AdminPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(screen.getByRole('dialog', { name: 'Publicar Ranges' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: t.common.close }))
    expect(screen.queryByRole('dialog', { name: 'Publicar Ranges' })).not.toBeInTheDocument()
  })

  it('Enter com range invalido nao publica (bloqueado por validacao)', () => {
    const adminSaveRanges = vi.fn().mockResolvedValue('ok')
    useStore.setState({ ranges: [INVALID_RANGE], adminSaveRanges })
    render(<AdminPanel open onClose={() => {}} />)
    const input = screen.getByPlaceholderText('••••••••')
    fireEvent.change(input, { target: { value: 'segredo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(adminSaveRanges).not.toHaveBeenCalled()
  })

  it('nao tem violacoes de acessibilidade no modal (axe)', async () => {
    const { container } = render(<AdminPanel open onClose={() => {}} />)
    expect((await axe(container)).violations).toEqual([])
  })
})
