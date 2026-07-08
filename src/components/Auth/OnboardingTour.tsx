import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useModalA11y } from '../../utils/useModalA11y'
import { t } from '../../i18n'
import type { Range } from '../../types'

const PANEL_MARGIN = 12
const PANEL_WIDTH_MAX = 340
const PANEL_EST_HEIGHT = 220
const MEASURE_TIMEOUT_MS = 2500
const MEASURE_INTERVAL_MS = 100

interface TourStep {
  target: string
  run: () => void
  title: string
  body: string
}

// Range real usado como exemplo nos passos de faixa de stack / pré-requisito /
// mesa preenchida: "BTN vs 3B OOP" tem as 3 coisas ao mesmo tempo (3 faixas de
// stack, prereq em "RFI BTN", cenário real Open vs 3-Bet) — um único exemplo
// coerente em vez de 3 fragmentos inventados. Se o catálogo mudar e esse id
// sumir, cai pra qualquer range que sirva pro que aquele passo específico
// precisa (nunca quebra, só perde a narrativa unificada).
const STACKRANGE_PREREQ_DEMO_ID = 1778104119544

function findStackRangeDemo(ranges: Range[]): Range | undefined {
  return ranges.find(r => r.id === STACKRANGE_PREREQ_DEMO_ID)
    ?? ranges.find(r => (r.stackGrids?.length ?? 0) > 1 && r.prereqRangeId !== undefined)
    ?? ranges.find(r => (r.stackGrids?.length ?? 0) > 1)
    ?? ranges.find(r => r.prereqRangeId !== undefined)
}

export function OnboardingTour() {
  const stepIndex = useStore(s => s.onboardingStep) ?? 0
  const setPage = useStore(s => s.setPage)

  // Sessões de demonstração ao vivo no Drill/Range Check: só iniciam uma sessão
  // nova se não houver nenhuma em andamento (não pisa num treino real do
  // usuário) e marcam a ref pra o finish() só encerrar o que o próprio tour
  // criou.
  const startedDrillDemo = useRef(false)
  const startedBuildDemo = useRef(false)

  function startDrillDemo() {
    setPage('drill')
    const s = useStore.getState()
    if (s.activeDrillRange) return
    const r = findStackRangeDemo(s.ranges) ?? s.ranges[0]
    if (!r) return
    useStore.setState({ selectedDrillRangeIds: [r.id], drillExcludedHands: [] })
    useStore.getState().startDrillSession()
    useStore.getState().nextDrillHand()
    startedDrillDemo.current = true
  }

  function startExerciseDemo() {
    setPage('exercise')
    const s = useStore.getState()
    if (s.buildRounds.length > 0) return
    const r = findStackRangeDemo(s.ranges) ?? s.ranges[0]
    if (!r) return
    useStore.setState({ buildSelectedRangeIds: [r.id] })
    if (useStore.getState().startBuildSession()) {
      useStore.getState().confirmBuildSession()
      startedBuildDemo.current = true
    }
  }

  // Passos do Editor (posição / nome / matriz / faixas de stack / pré-requisito):
  // em vez de um rascunho em branco, carrega o MESMO range real existente
  // (loadRangeForEdit já popula sessionGrids com as faixas salvas + prereqRangeId
  // quando houver, e seta page:'editor' sozinho) e simula o clique na primeira
  // faixa salva — mesmo efeito de loadSessionForEdit(0) no componente, só que
  // disparado pelo tour — pra a matriz mostrar esse range JÁ pintado de
  // verdade, não uma grade vazia. Um único fio narrativo: o mesmo range que
  // aparece aqui é o que o tour depois treina no Drill e no Range Check.
  function loadStackRangeDemo() {
    const r = findStackRangeDemo(useStore.getState().ranges)
    if (!r) { setPage('editor'); return }
    useStore.getState().loadRangeForEdit(r.id)
    const s = useStore.getState()
    const sg = s.sessionGrids[0]
    if (sg) {
      useStore.setState({
        rangeData: { ...s.rangeData, name: sg.name, stackRange: sg.stackRange, grid: sg.grid },
        selectedEditorPositions: [...sg.positions],
      })
    }
  }

  // Passos da mesa/cenário: reaproveita o primeiro cenário real bufferizado
  // pelo loadStackRangeDemo (tempScenarios vem de r.scenarios) em vez do
  // scaffold em branco do initTableConfig — mostra a mesa com ações de verdade.
  // Chama loadStackRangeDemo() de novo se tempScenarios ainda estiver vazio
  // (ex: usuário chega direto nesse passo sem ter passado pelos anteriores),
  // pro passo garantir sozinho seu próprio estado.
  function loadTableDemo() {
    if (useStore.getState().tempScenarios.length === 0) loadStackRangeDemo()
    const s = useStore.getState()
    if (s.tempScenarios.length > 0) useStore.getState().loadScenarioFromBuffer(0)
    else if (Object.keys(s.currentScenario).length === 0) useStore.getState().initTableConfig()
    setPage('table-editor')
  }

  const steps: TourStep[] = [
    { target: 'dashboard-hero', run: () => setPage('dashboard'), title: t.tour.dashboardTitle, body: t.tour.dashboardBody },
    { target: 'ranges-new', run: () => setPage('ranges'), title: t.tour.rangesTitle, body: t.tour.rangesBody },
    { target: 'setup-tablesize', run: () => setPage('range-setup'), title: t.tour.setupTitle, body: t.tour.setupBody },
    { target: 'setup-straddle', run: () => setPage('range-setup'), title: t.tour.setupStraddleTitle, body: t.tour.setupStraddleBody },
    { target: 'setup-ante', run: () => setPage('range-setup'), title: t.tour.setupAnteTitle, body: t.tour.setupAnteBody },
    { target: 'editor-position', run: loadStackRangeDemo, title: t.tour.editorPositionTitle, body: t.tour.editorPositionBody },
    { target: 'editor-name', run: loadStackRangeDemo, title: t.tour.editorNameTitle, body: t.tour.editorNameBody },
    { target: 'editor-matrix', run: loadStackRangeDemo, title: t.tour.editorMatrixTitle, body: t.tour.editorMatrixBody },
    { target: 'editor-stackrange', run: loadStackRangeDemo, title: t.tour.editorStackRangeTitle, body: t.tour.editorStackRangeBody },
    { target: 'editor-prereq', run: loadStackRangeDemo, title: t.tour.editorPrereqTitle, body: t.tour.editorPrereqBody },
    { target: 'table-editor-roles', run: loadTableDemo, title: t.tour.tableEditorRolesTitle, body: t.tour.tableEditorRolesBody },
    { target: 'table-editor-table', run: loadTableDemo, title: t.tour.tableEditorTitle, body: t.tour.tableEditorBody },
    { target: 'table-editor-scenarios', run: loadTableDemo, title: t.tour.tableEditorScenariosTitle, body: t.tour.tableEditorScenariosBody },
    { target: 'drill-select', run: () => setPage('drill'), title: t.tour.drillTitle, body: t.tour.drillBody },
    { target: 'drill-active', run: startDrillDemo, title: t.tour.drillActiveTitle, body: t.tour.drillActiveBody },
    { target: 'exercise-select', run: () => setPage('exercise'), title: t.tour.exerciseTitle, body: t.tour.exerciseBody },
    { target: 'exercise-active', run: startExerciseDemo, title: t.tour.exerciseActiveTitle, body: t.tour.exerciseActiveBody },
    { target: 'stats-header', run: () => setPage('history'), title: t.tour.historyTitle, body: t.tour.historyBody },
  ]
  const total = steps.length
  const step = steps[Math.min(stepIndex, total - 1)]

  const [rect, setRect] = useState<DOMRect | null>(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    step.run()
    setRect(null)
    setFallback(false)

    let elapsed = 0
    const timer = setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (el) {
        setRect(el.getBoundingClientRect())
        clearInterval(timer)
        return
      }
      elapsed += MEASURE_INTERVAL_MS
      if (elapsed >= MEASURE_TIMEOUT_MS) {
        setFallback(true)
        clearInterval(timer)
      }
    }, MEASURE_INTERVAL_MS)

    function onViewportChange() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)

    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  function finish() {
    if (startedDrillDemo.current) useStore.getState().stopDrill()
    if (startedBuildDemo.current) useStore.getState().stopBuildSession()
    useStore.setState({ onboardingStep: null })
  }
  function next() {
    if (stepIndex + 1 >= total) finish()
    else useStore.setState({ onboardingStep: stepIndex + 1 })
  }
  function back() {
    if (stepIndex > 0) useStore.setState({ onboardingStep: stepIndex - 1 })
  }

  const dialogRef = useModalA11y<HTMLDivElement>(true, finish)

  const panelWidth = Math.min(PANEL_WIDTH_MAX, window.innerWidth - PANEL_MARGIN * 2)
  let panelTop = 88
  let panelLeft = Math.max(PANEL_MARGIN, (window.innerWidth - panelWidth) / 2)
  if (rect) {
    // Prefere encostar o painel do lado (direita, depois esquerda) do alvo —
    // formulários verticais (ex: RangeSetupPage) têm a próxima pergunta logo
    // abaixo, e um painel "embaixo" tapa exatamente o que vem a seguir.
    // Só cai para cima/baixo do alvo quando não há espaço lateral (ex: matriz
    // 13×13, mesa de poker — alvos que já ocupam a largura disponível).
    const spaceRight = window.innerWidth - rect.right - PANEL_MARGIN
    const spaceLeft = rect.left - PANEL_MARGIN
    const clampedTop = Math.min(Math.max(rect.top, PANEL_MARGIN), window.innerHeight - PANEL_EST_HEIGHT - PANEL_MARGIN)
    if (spaceRight >= panelWidth) {
      panelLeft = rect.right + 14
      panelTop = clampedTop
    } else if (spaceLeft >= panelWidth) {
      panelLeft = rect.left - 14 - panelWidth
      panelTop = clampedTop
    } else {
      panelTop = rect.bottom + 14
      if (panelTop + PANEL_EST_HEIGHT > window.innerHeight - PANEL_MARGIN) {
        panelTop = Math.max(window.innerHeight - PANEL_EST_HEIGHT - PANEL_MARGIN, PANEL_MARGIN)
      }
      const rawLeft = rect.left + rect.width / 2 - panelWidth / 2
      panelLeft = Math.min(Math.max(rawLeft, PANEL_MARGIN), window.innerWidth - panelWidth - PANEL_MARGIN)
    }
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 60 }} onClick={finish}>
      {rect && !fallback && (
        <div
          aria-hidden="true"
          className="fixed rounded-xl transition-all duration-300"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgba(3,7,18,0.78)',
            pointerEvents: 'none',
          }}
        />
      )}
      {!rect && (
        <div aria-hidden="true" className="fixed inset-0" style={{ background: 'rgba(3,7,18,0.6)' }} />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        onClick={e => e.stopPropagation()}
        className="fixed bg-warm-900 border border-warm-700 rounded-2xl p-4 shadow-2xl transition-all duration-300"
        style={{ top: panelTop, left: panelLeft, width: panelWidth }}
      >
        <p id="tour-title" className="text-sm font-bold text-warm-100 mb-1">{step.title}</p>
        <p className="text-xs text-warm-300 leading-relaxed mb-3">{step.body}</p>
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={finish}
            className="text-[0.7rem] text-warm-500 hover:text-warm-300 transition-colors whitespace-nowrap"
          >
            {t.tour.skip}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[0.65rem] text-warm-500 tabular-nums">{stepIndex + 1}/{total}</span>
            {stepIndex > 0 && (
              <button
                onClick={back}
                className="px-3 py-1.5 rounded-lg bg-warm-800 hover:bg-warm-700 text-warm-100 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                {t.tour.back}
              </button>
            )}
            <button
              onClick={next}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              {stepIndex + 1 >= total ? t.tour.finish : t.tour.next}
            </button>
          </div>
        </div>
        <p className="text-[0.62rem] text-warm-600 mt-2 leading-snug">{t.tour.replayNote}</p>
      </div>
    </div>
  )
}
