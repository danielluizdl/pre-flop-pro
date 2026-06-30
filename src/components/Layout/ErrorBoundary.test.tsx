import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { captureError } from '../../utils/sentry'
import { downloadText } from '../../utils/download'
import { useStore } from '../../store/useStore'
import { ErrorBoundary } from './ErrorBoundary'

vi.mock('../../utils/sentry', () => ({ captureError: vi.fn() }))
vi.mock('../../utils/download', () => ({ downloadText: vi.fn(), backupFilename: () => 'backup.json' }))

function Boom(): never {
  throw new Error('explodiu')
}

describe('ErrorBoundary', () => {
  it('renderiza os filhos quando não há erro', () => {
    render(<ErrorBoundary><div>conteúdo ok</div></ErrorBoundary>)
    expect(screen.getByText('conteúdo ok')).toBeInTheDocument()
  })

  it('mostra o fallback quando um filho lança erro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar backup/ })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('variante "section" mostra fallback compacto, sem tela cheia', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary variant="section"><Boom /></ErrorBoundary>)
    expect(screen.getByText('Esta seção falhou ao carregar')).toBeInTheDocument()
    expect(screen.queryByText('Algo deu errado')).not.toBeInTheDocument()
    spy.mockRestore()
  })

  it('limpa o erro quando resetKey muda (navegação recupera a área)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <ErrorBoundary variant="section" resetKey="drill"><Boom /></ErrorBoundary>,
    )
    expect(screen.getByText('Esta seção falhou ao carregar')).toBeInTheDocument()
    rerender(
      <ErrorBoundary variant="section" resetKey="dashboard"><div>página nova ok</div></ErrorBoundary>,
    )
    expect(screen.getByText('página nova ok')).toBeInTheDocument()
    expect(screen.queryByText('Esta seção falhou ao carregar')).not.toBeInTheDocument()
    spy.mockRestore()
  })

  it('reporta o erro ao Sentry com a variante (page por padrão)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(captureError).mockClear()
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ variant: 'page' }),
    )
    spy.mockRestore()
  })

  it('reporta variant "section" quando a área isolada cai', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(captureError).mockClear()
    render(<ErrorBoundary variant="section"><Boom /></ErrorBoundary>)
    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ variant: 'section' }),
    )
    spy.mockRestore()
  })

  describe('exportar backup e resetar', () => {
    const reloadMock = vi.fn()

    beforeEach(() => {
      vi.mocked(downloadText).mockClear()
      reloadMock.mockClear()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
      })
      useStore.setState({
        exportData: () => '{"backup":true}',
        resetLocalData: vi.fn(),
      })
    })

    it('baixa o backup e, com dupla confirmação, reseta e recarrega', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const reset = useStore.getState().resetLocalData
      render(<ErrorBoundary><Boom /></ErrorBoundary>)
      fireEvent.click(screen.getByRole('button', { name: /Exportar backup/ }))
      expect(downloadText).toHaveBeenCalledWith('backup.json', '{"backup":true}')
      expect(confirmSpy).toHaveBeenCalledTimes(2)
      expect(reset).toHaveBeenCalled()
      expect(reloadMock).toHaveBeenCalled()
      confirmSpy.mockRestore()
      spy.mockRestore()
    })

    it('não reseta se a primeira confirmação for negada', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const reset = useStore.getState().resetLocalData
      render(<ErrorBoundary><Boom /></ErrorBoundary>)
      fireEvent.click(screen.getByRole('button', { name: /Exportar backup/ }))
      expect(downloadText).toHaveBeenCalled()
      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(reset).not.toHaveBeenCalled()
      expect(reloadMock).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
      spy.mockRestore()
    })

    it('se o backup falhar, ainda segue para a confirmação (catch)', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(downloadText).mockImplementation(() => { throw new Error('sem disco') })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<ErrorBoundary><Boom /></ErrorBoundary>)
      fireEvent.click(screen.getByRole('button', { name: /Exportar backup/ }))
      expect(confirmSpy).toHaveBeenCalled()
      confirmSpy.mockRestore()
      spy.mockRestore()
    })
  })

  it('não tem violações de acessibilidade no fallback (axe)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect((await axe(container)).violations).toEqual([])
    spy.mockRestore()
  })
})
