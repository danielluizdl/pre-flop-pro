import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { AccountPage } from './AccountPage'
import { useStore } from '../../store/useStore'
import type { CurrentUser } from '../../types'

const USER: CurrentUser = {
  id: 1, username: 'daniel123', name: 'Daniel', email: 'daniel@x.com', role: 'player', firstLogin: false, tier: 'evolution', turma: 'B',
}

function setup(overrides: Record<string, unknown> = {}) {
  useStore.setState({ currentUser: USER, ...overrides })
}

describe('AccountPage', () => {
  it('não renderiza nada sem usuário logado', () => {
    setup({ currentUser: null })
    const { container } = render(<AccountPage />)
    expect(container).toBeEmptyDOMElement()
  })

  it('pré-preenche nome, e-mail, tier e turma do usuário logado, e mostra o username somente leitura', () => {
    setup()
    render(<AccountPage />)
    expect(screen.getByText('daniel123')).toBeInTheDocument()
    expect((screen.getByLabelText('Nome:') as HTMLInputElement).value).toBe('Daniel')
    expect((screen.getByLabelText('E-mail:') as HTMLInputElement).value).toBe('daniel@x.com')
    expect(screen.getByRole('button', { name: 'Tier Evolution' })).toHaveClass('bg-brand-600')
    expect(screen.getByRole('button', { name: 'B' })).toHaveClass('bg-brand-600')
  })

  it('salvar chama updateMyAccount com os dados editados e mostra sucesso', async () => {
    const updateMyAccount = vi.fn().mockResolvedValue({ ok: true })
    setup({ updateMyAccount })
    render(<AccountPage />)
    fireEvent.change(screen.getByLabelText('Nome:'), { target: { value: 'Daniel Loureiro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateMyAccount).toHaveBeenCalledWith('Daniel Loureiro', 'daniel@x.com', 'evolution', 'B'))
    expect(await screen.findByText('Dados atualizados com sucesso.')).toBeInTheDocument()
  })

  it('bloqueia salvar com e-mail inválido, sem chamar updateMyAccount', async () => {
    const updateMyAccount = vi.fn()
    setup({ updateMyAccount })
    render(<AccountPage />)
    fireEvent.change(screen.getByLabelText('E-mail:'), { target: { value: 'nao-e-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(updateMyAccount).not.toHaveBeenCalled()
  })

  it('mostra o erro devolvido pelo servidor quando updateMyAccount falha', async () => {
    const updateMyAccount = vi.fn().mockResolvedValue({ ok: false, error: 'E-mail já cadastrado em outra conta' })
    setup({ updateMyAccount })
    render(<AccountPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('E-mail já cadastrado em outra conta')).toBeInTheDocument()
  })

  it('selecionar Main Team esconde a seleção de turma', () => {
    setup()
    render(<AccountPage />)
    expect(screen.getByText('Turma:')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Main Team' }))
    expect(screen.queryByText('Turma:')).not.toBeInTheDocument()
  })

  it('trocar senha chama changePassword com o novo valor', async () => {
    const changePassword = vi.fn().mockResolvedValue({ ok: true })
    setup({ changePassword })
    render(<AccountPage />)
    fireEvent.change(screen.getByLabelText('Nova senha:'), { target: { value: 'novaSenhaForte' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha:'), { target: { value: 'novaSenhaForte' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }))
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('novaSenhaForte'))
    expect(await screen.findByText('Dados atualizados com sucesso.')).toBeInTheDocument()
  })

  it('bloqueia trocar senha se as duas não coincidirem', async () => {
    const changePassword = vi.fn()
    setup({ changePassword })
    render(<AccountPage />)
    fireEvent.change(screen.getByLabelText('Nova senha:'), { target: { value: 'senhaUm123' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha:'), { target: { value: 'senhaDois123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }))
    expect(await screen.findByText('As senhas não coincidem')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('botão "Voltar" chama setPage("dashboard")', () => {
    const setPage = vi.fn()
    setup({ setPage })
    render(<AccountPage />)
    fireEvent.click(screen.getByRole('button', { name: '← Voltar' }))
    expect(setPage).toHaveBeenCalledWith('dashboard')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    setup()
    const { container } = render(<AccountPage />)
    expect((await axe(container)).violations).toEqual([])
  })

  describe('Sessões ativas', () => {
    function mockDevices(over: { revokeDevice?: () => Promise<{ ok: boolean }>; revokeOtherDevices?: () => Promise<{ ok: boolean }> } = {}) {
      setup({
        listDevices: async () => ({ ok: true, devices: [
          { id: 1, current: true, createdAt: 1700000000, expiresAt: 1800000000 },
          { id: 2, current: false, createdAt: 1700000000, expiresAt: 1800000000 },
        ] }),
        ...over,
      })
    }

    it('lista sessões e marca a sessão atual', async () => {
      mockDevices()
      render(<AccountPage />)
      expect(await screen.findByText('Sessão #1')).toBeInTheDocument()
      expect(screen.getByText('Esta sessão')).toBeInTheDocument()
    })

    it('encerra outra sessão chamando revokeDevice com o id', async () => {
      const revokeDevice = vi.fn(async () => ({ ok: true }))
      mockDevices({ revokeDevice })
      render(<AccountPage />)
      await screen.findByText('Sessão #1')
      fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }))
      expect(revokeDevice).toHaveBeenCalledWith(2)
    })

    it('"Encerrar as outras" chama revokeOtherDevices', async () => {
      const revokeOtherDevices = vi.fn(async () => ({ ok: true }))
      mockDevices({ revokeOtherDevices })
      render(<AccountPage />)
      await screen.findByText('Sessão #1')
      fireEvent.click(screen.getByRole('button', { name: /Encerrar as outras/ }))
      expect(revokeOtherDevices).toHaveBeenCalled()
    })

    it('erro ao listar sessões mostra mensagem com botão de tentar novamente', async () => {
      let ok = false
      setup({ listDevices: async () => (ok ? { ok: true, devices: [] } : { ok: false }) })
      render(<AccountPage />)
      const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
      expect(screen.getByText(/Não foi possível carregar as sessões/)).toBeInTheDocument()
      ok = true
      fireEvent.click(retry)
      expect(await screen.findByText('Nenhuma sessão ativa.')).toBeInTheDocument()
    })
  })
})
