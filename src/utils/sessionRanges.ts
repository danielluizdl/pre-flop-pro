import type { Range, TrainingSession } from '../types'

export interface SessionRangeRef {
  range: Range | null
  name: string
  id: number | null
}

// Resolve os ranges de uma sessão contra o catálogo atual: por id quando a
// sessão gravou rangeIds (sobrevive a rename), senão por nome (sessões
// antigas). Range apagado vira entrada com range=null — a UI mostra um
// placeholder em vez de sumir com a linha.
export function resolveSessionRanges(
  session: Pick<TrainingSession, 'rangeNames' | 'rangeIds'>,
  ranges: Range[],
): SessionRangeRef[] {
  return session.rangeNames.map((name, i) => {
    const id = session.rangeIds?.[i]
    const byId = id !== undefined ? ranges.find(r => r.id === id) : undefined
    const range = byId ?? ranges.find(r => r.name === name) ?? null
    return { range, name: range?.name ?? name, id: range?.id ?? id ?? null }
  })
}

export function sessionRangeKey(ref: SessionRangeRef): string {
  return ref.id !== null ? String(ref.id) : `n:${ref.name}`
}
