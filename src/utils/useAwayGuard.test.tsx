import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useAwayGuard } from './useAwayGuard'

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
}

function fireVisibilityChange() {
  fireEvent(document, new Event('visibilitychange'))
}

function Harness({ onExpire }: { onExpire: () => void }) {
  const { prompting, remainingMs, dismiss, getAwayMs } = useAwayGuard({
    awayThresholdMs: 1000,
    promptTimeoutMs: 2000,
    onExpire,
  })
  return (
    <div>
      <span data-testid="prompting">{String(prompting)}</span>
      <span data-testid="remaining">{remainingMs}</span>
      <span data-testid="awayms">{getAwayMs()}</span>
      <button onClick={dismiss}>continuar</button>
    </div>
  )
}

describe('useAwayGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setHidden(false)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ausência abaixo do limiar não abre o prompt', () => {
    render(<Harness onExpire={() => {}} />)
    setHidden(true)
    fireVisibilityChange()
    act(() => { vi.advanceTimersByTime(500) })
    setHidden(false)
    fireVisibilityChange()
    expect(screen.getByTestId('prompting').textContent).toBe('false')
  })

  it('ausência acima do limiar abre o prompt com o countdown cheio e acumula awayMs', () => {
    render(<Harness onExpire={() => {}} />)
    setHidden(true)
    fireVisibilityChange()
    act(() => { vi.advanceTimersByTime(1500) })
    setHidden(false)
    fireVisibilityChange()
    expect(screen.getByTestId('prompting').textContent).toBe('true')
    expect(screen.getByTestId('remaining').textContent).toBe('2000')
    expect(Number(screen.getByTestId('awayms').textContent)).toBeGreaterThanOrEqual(1500)
  })

  it('"Continuar" fecha o prompt sem chamar onExpire', () => {
    const onExpire = vi.fn()
    render(<Harness onExpire={onExpire} />)
    setHidden(true)
    fireVisibilityChange()
    act(() => { vi.advanceTimersByTime(1500) })
    setHidden(false)
    fireVisibilityChange()
    fireEvent.click(screen.getByRole('button', { name: 'continuar' }))
    expect(screen.getByTestId('prompting').textContent).toBe('false')
    act(() => { vi.advanceTimersByTime(3000) })
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('sem resposta até o fim do prazo, chama onExpire automaticamente', () => {
    const onExpire = vi.fn()
    render(<Harness onExpire={onExpire} />)
    setHidden(true)
    fireVisibilityChange()
    act(() => { vi.advanceTimersByTime(1500) })
    setHidden(false)
    fireVisibilityChange()
    act(() => { vi.advanceTimersByTime(2100) })
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('prompting').textContent).toBe('false')
  })

  it('blur/focus da janela também detecta ausência (fora da troca de aba)', () => {
    render(<Harness onExpire={() => {}} />)
    fireEvent(window, new Event('blur'))
    act(() => { vi.advanceTimersByTime(1500) })
    fireEvent(window, new Event('focus'))
    expect(screen.getByTestId('prompting').textContent).toBe('true')
  })
})
