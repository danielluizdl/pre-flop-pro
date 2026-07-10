import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ElapsedClock, formatElapsed } from './ElapsedClock'

afterEach(() => { vi.useRealTimers() })

describe('formatElapsed', () => {
  it('formata mm:ss abaixo de 1 hora', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(5)).toBe('00:05')
    expect(formatElapsed(65)).toBe('01:05')
    expect(formatElapsed(3599)).toBe('59:59')
  })

  it('formata h:mm:ss a partir de 1 hora', () => {
    expect(formatElapsed(3600)).toBe('1:00:00')
    expect(formatElapsed(3661)).toBe('1:01:01')
    expect(formatElapsed(36000 + 125)).toBe('10:02:05')
  })

  it('clampa negativos e frações', () => {
    expect(formatElapsed(-10)).toBe('00:00')
    expect(formatElapsed(61.9)).toBe('01:01')
  })
})

describe('ElapsedClock', () => {
  it('não renderiza nada sem startMs', () => {
    const { container } = render(<ElapsedClock startMs={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('mostra o tempo decorrido e avança a cada segundo', () => {
    vi.useFakeTimers()
    const start = Date.now()
    render(<ElapsedClock startMs={start} />)
    expect(screen.getByLabelText('Tempo de sessão')).toHaveTextContent('00:00')
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByLabelText('Tempo de sessão')).toHaveTextContent('00:03')
    act(() => { vi.advanceTimersByTime(60000) })
    expect(screen.getByLabelText('Tempo de sessão')).toHaveTextContent('01:03')
  })

  it('limpa o setInterval no unmount', () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = render(<ElapsedClock startMs={Date.now()} />)
    unmount()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})
