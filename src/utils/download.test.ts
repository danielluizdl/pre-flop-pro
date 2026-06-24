import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadText, backupFilename } from './download'

describe('backupFilename', () => {
  it('usa o prefixo do app e a data ISO (YYYY-MM-DD)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T16:08:00Z'))
    expect(backupFilename()).toBe('pre-flop-pro-backup-2026-06-21.json')
    vi.useRealTimers()
  })

  it('sempre termina em .json', () => {
    expect(backupFilename().endsWith('.json')).toBe(true)
  })
})

describe('downloadText', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:fake-url')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cria um anchor com o filename, dispara click e limpa o DOM', () => {
    const click = vi.fn()
    const appendChild = vi.spyOn(document.body, 'appendChild')
    const removeChild = vi.spyOn(document.body, 'removeChild')
    const created: HTMLAnchorElement[] = []
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement
      if (tag === 'a') {
        el.click = click
        created.push(el)
      }
      return el
    })

    downloadText('arquivo.json', '{"a":1}')

    expect(created).toHaveLength(1)
    expect(created[0].download).toBe('arquivo.json')
    expect(created[0].href).toBe('blob:fake-url')
    expect(click).toHaveBeenCalledOnce()
    expect(appendChild).toHaveBeenCalledWith(created[0])
    expect(removeChild).toHaveBeenCalledWith(created[0])
  })

  it('revoga a object URL criada após o download', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadText('x.json', 'conteudo')
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
