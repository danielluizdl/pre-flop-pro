import type { HandData, Range } from '../types'
import { ALL_HANDS, stackMatchesRange } from './hands'

function sumHand(d: HandData): number {
  return (d.fold ?? 0) + (d.call ?? 0) + (d.raise ?? 0) + (d.allin ?? 0) + (d.extra ?? 0)
}

function checkGrid(grid: Record<string, HandData>, label: string, hasCustomAction: boolean, problems: string[]) {
  ALL_HANDS.forEach(h => {
    const d = grid[h]
    if (!d) return
    const total = sumHand(d)
    if (Math.abs(total - 100) > 0.01) {
      problems.push(`${label}: mão ${h} soma ${total.toFixed(2)} (esperado 100)`)
    }
    if ((d.extra ?? 0) > 0 && !hasCustomAction) {
      problems.push(`${label}: mão ${h} tem extra ${d.extra} mas o range não define customAction`)
    }
  })
}

export function validateRanges(ranges: Range[]): string[] {
  const problems: string[] = []
  const ids = new Set(ranges.map(r => r.id))

  const nameCounts = new Map<string, number>()
  ranges.forEach(r => nameCounts.set(r.name, (nameCounts.get(r.name) ?? 0) + 1))
  nameCounts.forEach((count, name) => {
    if (count > 1) problems.push(`Nome duplicado: "${name}" usado por ${count} ranges`)
  })

  ranges.forEach(r => {
    const tag = `Range "${r.name}" (#${r.id})`
    const hasCustomAction = !!r.customAction

    if (r.stackGrids && r.stackGrids.length > 0) {
      r.stackGrids.forEach((sg, i) => {
        checkGrid(sg.grid, `${tag} stackGrid[${i}] "${sg.stackRange}"`, hasCustomAction, problems)
      })
    } else {
      checkGrid(r.grid, `${tag} grid`, hasCustomAction, problems)
    }

    if (r.prereqRangeId !== undefined && !ids.has(r.prereqRangeId)) {
      problems.push(`${tag}: prereqRangeId ${r.prereqRangeId} não existe no conjunto`)
    }

    ;(r.scenarios ?? []).forEach((scen, si) => {
      const positions = Object.values(scen.data ?? {})
      const heroes = positions.filter(p => p.isHero)
      if (heroes.length !== 1) {
        problems.push(`${tag} cenário ${si + 1}: ${heroes.length} heróis (esperado exatamente 1)`)
      }

      if (r.stackGrids && r.stackGrids.length > 0) {
        const heroStack = heroes[0]?.stack ?? 0
        const matches = r.stackGrids.filter(sg => stackMatchesRange(heroStack, sg.stackRange)).length
        if (matches === 0) {
          problems.push(`${tag} cenário ${si + 1}: hero stack ${heroStack}bb não casa com nenhum stackGrid (cenário morto)`)
        } else if (matches > 1) {
          problems.push(`${tag} cenário ${si + 1}: hero stack ${heroStack}bb casa com ${matches} stackGrids (ambíguo)`)
        }
      }
    })
  })

  return problems
}
