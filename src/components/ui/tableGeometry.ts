import type { Slot } from '../../types'

// ─── EDITE AQUI: posição das fichas de aposta (t=vertical%, l=horizontal%) ──
// Índice 0 = hero (slot de baixo), sentido horário.
// Mesa 8-max: hero, BB, STR, UTG, MP, HJ, CO, BTN
export const CHIP_ANCHORS_8MAX: Slot[] = [
  { t: 80, l: 50 },  // 0 — hero (SB/BB/STR dependendo do cenário)
  { t: 77, l: 24 },  // 1
  { t: 52, l: 14 },  // 2
  { t: 30, l: 24 },  // 3
  { t: 24, l: 50 },  // 4
  { t: 30, l: 76 },  // 5
  { t: 52, l: 80 },  // 6
  { t: 80, l: 76 },  // 7
]

export const CHIP_ANCHORS_6MAX: Slot[] = [
  { t: 78, l: 50 },  // 0 — hero
  { t: 55, l: 20 },  // 1
  { t: 22, l: 20 },  // 2
  { t: 22, l: 80 },  // 3 — corrigir se precisar
  { t: 55, l: 80 },  // 4
  { t: 22, l: 50 },  // 5
]

// ─── EDITE AQUI: posição do botão dealer (t=vertical%, l=horizontal%) ────────
// Índice 0 = visual slot do BTN quando hero está embaixo, sentido horário.
export const DEALER_ANCHORS_8MAX: Slot[] = [
  { t: 94, l: 42 },  // 0
  { t: 90, l: 26 },  // 1
  { t: 70, l: 8 },  // 2
  { t: 28, l: 9 },  // 3
  { t: 7, l: 36 },  // 4
  { t: 9, l: 71 },  // 5
  { t: 37, l: 94 },  // 6
  { t: 77, l: 88 },  // 7
]

export const DEALER_ANCHORS_6MAX: Slot[] = [
  { t: 88, l: 44 },  // 0
  { t: 55, l: 13 },  // 1
  { t: 18, l: 19 },  // 2
  { t: 16, l: 55 },  // 3
  { t: 45, l: 87 },  // 4
  { t: 82, l: 81 },  // 5
]

export function chipAnchor(slot: Slot, visualIdx: number, tableSize: 6 | 8): { l: number; t: number } {
  const anchors = tableSize === 8 ? CHIP_ANCHORS_8MAX : CHIP_ANCHORS_6MAX
  return anchors[visualIdx] ?? slot
}

export function dealerAnchor(slot: Slot, visualIdx: number, tableSize: 6 | 8): { l: number; t: number } {
  const anchors = tableSize === 8 ? DEALER_ANCHORS_8MAX : DEALER_ANCHORS_6MAX
  return anchors[visualIdx] ?? slot
}
