import { makeEmptyGrid } from './hands'
import type { HandData, Range } from '../types'

// Formato esparso: guarda apenas as mãos jogáveis (fold < 100). As demais são
// reconstruídas a partir de makeEmptyGrid. decodeSparse aceita tanto o formato
// esparso novo quanto o denso antigo (overlay reproduz o denso intacto), então a
// compatibilidade retroativa é automática.

export function encodeSparse(grid: Record<string, HandData>): Record<string, HandData> {
  const out: Record<string, HandData> = {}
  for (const [hand, cell] of Object.entries(grid)) {
    if ((cell?.fold ?? 100) < 100) out[hand] = cell
  }
  return out
}

export function decodeSparse(grid: Record<string, HandData> | undefined | null): Record<string, HandData> {
  return { ...makeEmptyGrid(), ...(grid ?? {}) }
}

export function encodeRange(r: Range): Range {
  return {
    ...r,
    grid: encodeSparse(r.grid),
    ...(r.stackGrids ? { stackGrids: r.stackGrids.map(sg => ({ ...sg, grid: encodeSparse(sg.grid) })) } : {}),
  }
}

export function decodeRange(r: Range): Range {
  return {
    ...r,
    grid: decodeSparse(r.grid),
    ...(r.stackGrids ? { stackGrids: r.stackGrids.map(sg => ({ ...sg, grid: decodeSparse(sg.grid) })) } : {}),
  }
}

export function encodeRanges(ranges: Range[]): Range[] {
  return ranges.map(encodeRange)
}

export function decodeRanges(ranges: Range[]): Range[] {
  return ranges.map(decodeRange)
}
