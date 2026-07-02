import type { TrainingSession, Range } from '../types'

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

// Gera o CSV da sessão a partir do handPerf gravado (agregado por mão).
// Chaves: rangeId, `rangeId|||stack` ou rangeName (sessões antigas). As chaves
// com stack têm precedência sobre a agregada do mesmo range (evita duplicar).
export function buildSessionCsv(session: TrainingSession, ranges: Range[]): string {
  const header = 'range,stack,mao,tentativas,acertos,precisao'
  const perf = session.handPerf
  if (!perf) return header

  const keys = Object.keys(perf)
  const withStack = new Set(
    keys.filter(k => k.includes('|||')).map(k => k.split('|||')[0])
  )

  const rows: string[] = []
  for (const key of keys) {
    const [base, stack = ''] = key.split('|||')
    if (!stack && withStack.has(base)) continue
    const asId = Number(base)
    const rangeName = Number.isFinite(asId)
      ? (ranges.find(r => r.id === asId)?.name ?? base)
      : base
    const hands = perf[key]
    for (const hand of Object.keys(hands).sort()) {
      const { c, t } = hands[hand]
      const acc = t > 0 ? Math.round((c / t) * 100) : 0
      rows.push([csvField(rangeName), csvField(stack), hand, String(t), String(c), `${acc}%`].join(','))
    }
  }
  return [header, ...rows].join('\n')
}

export function sessionCsvFilename(session: TrainingSession): string {
  return `sessao-${new Date(session.timestamp).toISOString().slice(0, 10)}.csv`
}
