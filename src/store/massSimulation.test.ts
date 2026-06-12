import { describe, it, expect } from 'vitest'
import { appendFileSync } from 'node:fs'
import { useStore } from './useStore'
import { getRngCorrectAction, getTopFrequencyActions, getRngBands, generateSuits, ALL_HANDS } from '../utils/hands'
import type { HandData } from '../types'

// Oráculo independente: reimplementa a regra de faixas (Allin > Raise > Call > extra > Fold)
// sem usar getRngCorrectAction, para detectar bugs na própria função do app.
function oracleRng(d: HandData | undefined, rng: number, extraLabel?: string): string {
  if (!d) return 'Fold'
  const segs: [string, number][] = [
    ['Allin', d.allin ?? 0],
    ['Raise', d.raise ?? 0],
    ['Call', d.call ?? 0],
  ]
  if (extraLabel && (d.extra ?? 0) > 0) segs.push([extraLabel, d.extra ?? 0])
  let cursor = 0
  for (const [label, pct] of segs) {
    if (pct <= 0) continue
    if (rng > cursor && rng <= cursor + pct) return label
    cursor += pct
  }
  return 'Fold'
}

function oracleTopFreq(d: HandData | undefined, extraLabel?: string): string[] {
  if (!d) return ['Fold']
  const opts: [string, number][] = [
    ['Raise', d.raise ?? 0],
    ['Call', d.call ?? 0],
    ['Allin', d.allin ?? 0],
    ['Fold', d.fold ?? 100],
  ]
  if (extraLabel && (d.extra ?? 0) > 0) opts.push([extraLabel, d.extra ?? 0])
  const max = Math.max(...opts.map(o => o[1]))
  return opts.filter(o => o[1] === max).map(o => o[0])
}

function activeGridNow() {
  const s = useStore.getState()
  const sg = s.activeDrillStackGridIdx >= 0
    ? s.activeDrillRange!.stackGrids?.[s.activeDrillStackGridIdx]
    : undefined
  return sg?.grid ?? s.activeDrillRange!.grid
}

function sameSet(a: string[], b: string[]) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
}

describe('simulação em massa com os ranges reais publicados', () => {
  it('não há ids duplicados no conjunto seedado', () => {
    const ranges = useStore.getState().ranges
    const counts = new Map<number, string[]>()
    ranges.forEach(r => counts.set(r.id, [...(counts.get(r.id) ?? []), r.name]))
    const dups = [...counts.entries()].filter(([, names]) => names.length > 1)
    expect(dups, `ids duplicados: ${JSON.stringify(dups)}`).toEqual([])
  })

  it('EXAUSTIVO: todos os ranges x grids x 169 mãos x bordas de faixa — app == oráculo nos dois modos', () => {
    const ranges = useStore.getState().ranges
    const problems: string[] = []
    let cells = 0
    let probes = 0

    ranges.forEach(r => {
      const grids = r.stackGrids?.length
        ? r.stackGrids.map((sg, i) => ({ tag: `sg[${i}] ${sg.stackRange}`, grid: sg.grid }))
        : [{ tag: 'grid', grid: r.grid }]
      const extraLabel = r.customAction?.label

      grids.forEach(({ tag, grid }) => {
        ALL_HANDS.forEach(hand => {
          const d = grid[hand]
          cells++

          // Modo frequência: conjunto de ações principais
          const appTop = getTopFrequencyActions(d, extraLabel)
          const oraTop = oracleTopFreq(d, extraLabel)
          if (!sameSet(appTop, oraTop)) {
            problems.push(`FREQ [${r.name}#${r.id} ${tag}] ${hand} cell=${JSON.stringify(d)} app=${JSON.stringify(appTop)} ora=${JSON.stringify(oraTop)}`)
          }

          // Sintoma relatado: puro fold jamais pode ter resposta != Fold
          if (d && (d.fold ?? 0) >= 100) {
            if (!appTop.includes('Fold') || appTop.length !== 1) {
              problems.push(`PURO FOLD (freq) [${r.name}#${r.id} ${tag}] ${hand} app=${JSON.stringify(appTop)}`)
            }
            for (const rng of [1, 50, 100]) {
              const a = getRngCorrectAction(d, rng, extraLabel)
              if (a !== 'Fold') problems.push(`PURO FOLD (rng=${rng}) [${r.name}#${r.id} ${tag}] ${hand} app="${a}"`)
            }
          }

          // Modo RNG: testa as bordas exatas de cada faixa + extremos
          const bands = getRngBands(d, extraLabel)
          const probesSet = new Set<number>([1, 100])
          bands.forEach(b => { probesSet.add(b.lo); probesSet.add(b.hi); if (b.hi < 100) probesSet.add(b.hi + 1) })
          probesSet.forEach(rng => {
            if (rng < 1 || rng > 100) return
            probes++
            const app = getRngCorrectAction(d, rng, extraLabel)
            const ora = oracleRng(d, rng, extraLabel)
            if (app !== ora) {
              problems.push(`RNG [${r.name}#${r.id} ${tag}] ${hand} rng=${rng} cell=${JSON.stringify(d)} app="${app}" ora="${ora}"`)
            }
            const band = bands.find(b => rng >= b.lo && rng <= b.hi)
            if (band?.label !== app) {
              problems.push(`FAIXA EXIBIDA [${r.name}#${r.id} ${tag}] ${hand} rng=${rng} faixa="${band?.label}" resposta="${app}"`)
            }
          })
        })
      })
    })

    appendFileSync('_sim_stats.txt', `exaustivo: ${cells} células, ${probes} sondagens de RNG\n`)
    expect(problems, problems.slice(0, 20).join('\n')).toEqual([])
  }, 120000)

  it('STORE por range: cada range jogado isolado, RNG ligado e desligado — cadeia sorteio→check íntegra + cobertura de stackGrids', () => {
    const ranges = useStore.getState().ranges
    const problems: string[] = []
    const sgCoverage = new Map<string, Set<number>>()
    let played = 0

    for (const r of ranges) {
      for (const useRng of [true, false]) {
        useStore.setState({
          selectedDrillRangeIds: [r.id],
          drillExcludedHands: [],
          useRngForFrequency: useRng,
          acceptAnyFreq: false,
          sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
          handHistory: [],
          sessionHandPerf: {},
        })

        for (let i = 0; i < 60; i++) {
          if (!useStore.getState().nextDrillHand()) {
            problems.push(`[${r.name}#${r.id}] nextDrillHand retornou false (sem candidatos)`)
            break
          }
          played++
          const s = useStore.getState()
          if (s.activeDrillRange!.id !== r.id) {
            problems.push(`[${r.name}#${r.id}] drill sorteou range errado: #${s.activeDrillRange!.id}`)
            continue
          }
          if (s.activeDrillStackGridIdx >= 0) {
            if (!sgCoverage.has(String(r.id))) sgCoverage.set(String(r.id), new Set())
            sgCoverage.get(String(r.id))!.add(s.activeDrillStackGridIdx)
          }
          const grid = activeGridNow()
          const d = grid[s.activeHand]
          const extraLabel = s.activeDrillRange!.customAction?.label

          if (useRng) {
            const expected = oracleRng(d, s.currentRng, extraLabel)
            if (s.correctActionForCurrentHand !== expected) {
              problems.push(`RNG [${r.name}#${r.id} sg=${s.activeDrillStackGridIdx}] ${s.activeHand} rng=${s.currentRng} app="${s.correctActionForCurrentHand}" ora="${expected}" cell=${JSON.stringify(d)}`)
            }
            if (!useStore.getState().checkDrillAnswer(expected).correct) {
              problems.push(`CHECK RECUSOU [${r.name}#${r.id}] ${s.activeHand} "${expected}"`)
            }
          } else {
            const expected = oracleTopFreq(d, extraLabel)
            if (!sameSet(s.correctActionsForCurrentHand, expected)) {
              problems.push(`FREQ [${r.name}#${r.id} sg=${s.activeDrillStackGridIdx}] ${s.activeHand} app=${JSON.stringify(s.correctActionsForCurrentHand)} ora=${JSON.stringify(expected)} cell=${JSON.stringify(d)}`)
            }
            if (!useStore.getState().checkDrillAnswer(expected[0]).correct) {
              problems.push(`CHECK RECUSOU (freq) [${r.name}#${r.id}] ${s.activeHand} "${expected[0]}"`)
            }
          }
        }
      }
    }

    // stackGrids que nenhum cenário consegue alcançar (não é erro de resposta, mas é range intreinável)
    const unreachable: string[] = []
    ranges.forEach(r => {
      if (!r.stackGrids?.length) return
      const hit = sgCoverage.get(String(r.id)) ?? new Set()
      r.stackGrids.forEach((sg, i) => {
        if (!hit.has(i)) unreachable.push(`[${r.name}#${r.id}] stackGrid[${i}] "${sg.stackRange}" nunca sorteado`)
      })
    })
    if (unreachable.length > 0) appendFileSync('_sim_stats.txt', 'AVISO — stackGrids não exercitados:\n' + unreachable.join('\n') + '\n')

    appendFileSync('_sim_stats.txt', `store por range: ${played} mãos jogadas\n`)
    expect(problems, problems.slice(0, 20).join('\n')).toEqual([])
  }, 240000)

  it('STORE misto: todos os ranges selecionados juntos, 800 mãos RNG ligado', () => {
    const ranges = useStore.getState().ranges
    useStore.setState({
      selectedDrillRangeIds: ranges.map(r => r.id),
      drillExcludedHands: [],
      useRngForFrequency: true,
      acceptAnyFreq: false,
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
      handHistory: [],
      sessionHandPerf: {},
    })
    const problems: string[] = []
    for (let i = 0; i < 800; i++) {
      if (!useStore.getState().nextDrillHand()) break
      const s = useStore.getState()
      const d = activeGridNow()[s.activeHand]
      const expected = oracleRng(d, s.currentRng, s.activeDrillRange!.customAction?.label)
      if (s.correctActionForCurrentHand !== expected) {
        problems.push(`[${s.activeDrillRange!.name}#${s.activeDrillRange!.id}] ${s.activeHand} rng=${s.currentRng} app="${s.correctActionForCurrentHand}" ora="${expected}"`)
      }
      if (!useStore.getState().checkDrillAnswer(expected).correct) {
        problems.push(`CHECK RECUSOU [${s.activeDrillRange!.name}] ${s.activeHand} "${expected}"`)
      }
    }
    expect(problems, problems.slice(0, 20).join('\n')).toEqual([])
  }, 240000)

  it('combos exibidos: suited sempre mesmo naipe, offsuit e pares sempre naipes diferentes', () => {
    const problems: string[] = []
    ALL_HANDS.forEach(hand => {
      for (let i = 0; i < 50; i++) {
        const [s1, s2] = generateSuits(hand)
        const suited = hand.length === 3 && hand[2] === 's'
        if (suited && s1 !== s2) problems.push(`${hand}: naipes ${s1}${s2} deveriam ser iguais`)
        if (!suited && s1 === s2) problems.push(`${hand}: naipes ${s1}${s2} deveriam ser diferentes`)
      }
    })
    expect(problems, problems.slice(0, 10).join('\n')).toEqual([])
  }, 60000)
})
