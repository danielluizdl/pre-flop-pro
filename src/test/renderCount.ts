// Instrumento de contagem de render usado SÓ pelos testes de performance.
// O incremento é guardado por `import.meta.env` → no build de produção vira
// no-op; e os componentes não exportam mais contadores. `getRenderCount`/
// `resetRenderCount` são usados apenas nos testes (tree-shaken da produção).
const counts: Record<string, number> = {}

export function countRender(key: string): void {
  if (import.meta.env.MODE !== 'production') {
    counts[key] = (counts[key] ?? 0) + 1
  }
}

export function getRenderCount(key: string): number {
  return counts[key] ?? 0
}

export function resetRenderCount(key: string): void {
  counts[key] = 0
}
