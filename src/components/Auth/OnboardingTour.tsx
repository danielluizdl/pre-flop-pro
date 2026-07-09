import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useModalA11y } from '../../utils/useModalA11y'
import { scoreBuild } from '../../utils/buildScore'
import { t } from '../../i18n'
import type { Range, HandData } from '../../types'

const PANEL_MARGIN = 12
const PANEL_WIDTH_MAX = 340
const PANEL_EST_HEIGHT = 220
const MEASURE_TIMEOUT_MS = 2500
const MEASURE_INTERVAL_MS = 100

// Cada página com tutorial próprio (botão "Tutorial" na página + item "Rever
// tutorial" no perfil, que roda a sequência completa) mapeia pra um desses
// scopes. "novo-range" cobre as 3 telas do fluxo de criação (setup/editor/
// table-editor) como um só tutorial — são passos de uma única tarefa contínua.
export type TourScope = 'dashboard' | 'ranges' | 'novo-range' | 'drill' | 'exercise' | 'stats'

interface TourStep {
  target: string
  scope: TourScope
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
  const scope = useStore(s => s.onboardingScope) as TourScope | null
  const setPage = useStore(s => s.setPage)

  // Sessões de demonstração ao vivo no Drill/Range Check: só iniciam uma sessão
  // nova se não houver nenhuma em andamento (não pisa num treino real do
  // usuário) e marcam a ref pra o finish() só encerrar o que o próprio tour
  // criou.
  const startedDrillDemo = useRef(false)
  const startedBuildDemo = useRef(false)

  // Encerra a sessão de demo do Drill sem passar por stopDrill(): o passo do
  // resumo (startDrillSummaryDemo) preenche sessionStats/sessionHandPerf com
  // números falsos só pra tela não aparecer zerada — se isso passasse pelo
  // stopDrill() real, sessionStats.hands>0 salvaria essa sessão inventada no
  // trainingHistory de verdade do usuário. Reseta só os campos que a demo
  // pode ter sujado, sem tocar em localStorage/telemetria.
  function resetDrillDemoState() {
    useStore.setState({
      activeDrillRange: null, activeDrillStackRange: '', activeDrillStackGridIdx: -1, activeHand: '',
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
      sessionSeverity: { grave: 0, impreciso: 0 },
      handHistory: [], sessionHandPerf: {},
    })
  }

  // Passos do Drill anteriores à mesa (select/settings/filter) mexem no `step`
  // interno de DrillRangeSelect, que é estado local do componente — sem jeito
  // de navegar até ele só via store (setPage). Se um passo anterior a esses já
  // tiver deixado uma sessão de demo ativa (usuário foi até drill-active e
  // voltou), encerra ela antes, senão TrainerPage continua renderizando
  // DrillActive em vez de DrillRangeSelect e o alvo do passo não é encontrado.
  // Só usa o reset local (sem salvar) quando a sessão ativa foi criada pelo
  // próprio tour — uma sessão real do usuário que já estava em andamento
  // quando ele abriu "Rever tutorial" continua sendo encerrada de verdade.
  function resetDrillDemoIfActive() {
    useStore.setState({ onboardingForceDrillSummary: false })
    if (useStore.getState().activeDrillRange) {
      if (startedDrillDemo.current) resetDrillDemoState()
      else useStore.getState().stopDrill()
      startedDrillDemo.current = false
    }
  }

  function startDrillMultiDemo() {
    setPage('drill')
    resetDrillDemoIfActive()
    const s = useStore.getState()
    const grouped: Record<string, number[]> = {}
    for (const r of s.ranges) {
      for (const pos of r.positions) {
        if (!grouped[pos]) grouped[pos] = []
        grouped[pos].push(r.id)
      }
    }
    const openPositions = Object.keys(grouped).slice(0, 2)
    const ids = openPositions.map(p => grouped[p][0])
    useStore.setState({
      selectedDrillRangeIds: ids,
      onboardingDrillOverride: { step: 'select', openPositions },
    })
  }

  function startDrillSettingsDemo() {
    setPage('drill')
    resetDrillDemoIfActive()
    useStore.setState({ onboardingDrillOverride: { step: 'settings' } })
  }

  function startDrillFilterDemo() {
    setPage('drill')
    resetDrillDemoIfActive()
    useStore.setState({ onboardingDrillOverride: { step: 'filter' } })
  }

  function startDrillDemo() {
    setPage('drill')
    useStore.setState({ onboardingDrillOverride: null, onboardingForceDrillSummary: false })
    const s = useStore.getState()
    if (s.activeDrillRange) return
    const r = findStackRangeDemo(s.ranges) ?? s.ranges[0]
    if (!r) return
    useStore.setState({ selectedDrillRangeIds: [r.id], drillExcludedHands: [] })
    useStore.getState().startDrillSession()
    useStore.getState().nextDrillHand()
    startedDrillDemo.current = true
  }

  // Passo do resumo pós-treino: o painel do tour cobre a tela inteira (clique
  // é capturado pelo overlay pra confirmar saída), então não dá pra clicar em
  // "Encerrar e ver resumo" de verdade — força a troca via
  // onboardingForceDrillSummary, que TrainerPage lê direto (showSummary é
  // estado local do componente, fora do alcance do tour). Garante que existe
  // uma sessão de demo (mesmo range/mãos zeradas dos passos anteriores) pra
  // "Por range" do resumo ter o que listar mesmo se o usuário pular direto
  // pra esse passo. Se essa sessão foi criada pelo próprio tour e ainda não
  // tem mão respondida, preenche sessionStats/sessionHandPerf com números
  // fixos (nunca passa por checkDrillAnswer) só pra a tela de resumo não
  // aparecer com tudo zerado — resetDrillDemoState (não stopDrill) desfaz
  // isso ao sair, então esses números nunca chegam no trainingHistory real.
  function startDrillSummaryDemo() {
    setPage('drill')
    if (!useStore.getState().activeDrillRange) startDrillDemo()
    const s = useStore.getState()
    if (startedDrillDemo.current && s.activeDrillRange && s.sessionStats.hands === 0) {
      useStore.setState({
        sessionStats: { hands: 3, correct: 2, errors: 1, consults: 0 },
        sessionSeverity: { grave: 1, impreciso: 0 },
        sessionHandPerf: { [String(s.activeDrillRange.id)]: { [s.activeHand || 'AA']: { c: 2, t: 3 } } },
      })
    }
    useStore.setState({ onboardingForceDrillSummary: true })
  }

  function clearBuildDemo() {
    useStore.setState({ buildRounds: [], buildRoundIdx: 0, buildResults: [], buildLastResult: null, buildConfirmed: false, buildAttempt: 1 })
  }

  // Reinicia a demo do Range Check do zero (round 0, gabarito ainda não
  // respondido) — cada passo exercise-* parte desse estado conhecido e avança
  // só o quanto precisar, então funciona igual indo pra frente ou voltando
  // "Voltar" entre eles (sem depender de qual passo rodou por último). Se já
  // existe uma sessão real do usuário (não criada pelo tour), não mexe nela —
  // mesmo princípio de nunca pisar num treino real, só que aqui checado antes
  // de qualquer reset, já que Range Check grava nota no histórico de verdade.
  function resetExerciseDemo(): boolean {
    if (useStore.getState().buildRounds.length > 0 && !startedBuildDemo.current) return false
    clearBuildDemo()
    const s = useStore.getState()
    const r = findStackRangeDemo(s.ranges) ?? s.ranges[0]
    if (!r) return false
    useStore.setState({ buildSelectedRangeIds: [r.id] })
    if (!useStore.getState().startBuildSession()) return false
    useStore.getState().confirmBuildSession()
    startedBuildDemo.current = true
    return true
  }

  // Preenche a rodada atual copiando o próprio gabarito (nota 100) e grava só
  // buildResults/buildLastResult localmente — nunca passa pela ação real
  // submitBuildRound, que gravaria no histórico local do Range Check e
  // disparia telemetria pra um round que o usuário não jogou de verdade.
  function submitDemoRound() {
    const s = useStore.getState()
    const round = s.buildRounds[s.buildRoundIdx]
    if (!round || s.buildLastResult) return
    const userGrid: Record<string, HandData> = JSON.parse(JSON.stringify(round.grid))
    const { score, perHand } = scoreBuild(round.grid, userGrid)
    useStore.setState({
      buildResults: [...s.buildResults, { roundIdx: s.buildRoundIdx, label: round.label, score, attempt: s.buildAttempt, userGrid, perHand }],
      buildLastResult: { score, perHand, userGrid },
    })
  }

  function startExerciseDemo() {
    setPage('exercise')
    resetExerciseDemo()
  }

  function startExerciseResultDemo() {
    setPage('exercise')
    if (!resetExerciseDemo()) return
    submitDemoRound()
  }

  function startExerciseSummaryDemo() {
    setPage('exercise')
    if (!resetExerciseDemo()) return
    while (useStore.getState().buildRoundIdx < useStore.getState().buildRounds.length) {
      submitDemoRound()
      useStore.getState().nextBuildRound()
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

  // Passo de Ações & Frequências: além de carregar o range real, "pinta" KK
  // com 50% Call / 50% Raise (ajustando o pincel pro mesmo valor) — um
  // exemplo redondo e fácil de explicar pra mostrar mistura de frequências,
  // não uma ação 100%. Reaproveitado pelo passo da matriz logo em seguida
  // (loadActionsFreqDemo de novo é idempotente), pra o KK continuar pintado
  // quando a grade aparece.
  function loadActionsFreqDemo() {
    loadStackRangeDemo()
    const s = useStore.getState()
    useStore.setState({
      brush: { ...s.brush, call: 50, raise: 50, allin: 0, extra: 0 },
      rangeData: { ...s.rangeData, grid: { ...s.rangeData.grid, KK: { fold: 0, call: 50, raise: 50, allin: 0 } } },
    })
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
    { target: 'dashboard-hero', scope: 'dashboard', run: () => setPage('dashboard'), title: t.tour.dashboardTitle, body: t.tour.dashboardBody },
    { target: 'ranges-new', scope: 'ranges', run: () => setPage('ranges'), title: t.tour.rangesTitle, body: t.tour.rangesBody },
    { target: 'setup-tablesize', scope: 'novo-range', run: () => setPage('range-setup'), title: t.tour.setupTitle, body: t.tour.setupBody },
    { target: 'setup-straddle', scope: 'novo-range', run: () => setPage('range-setup'), title: t.tour.setupStraddleTitle, body: t.tour.setupStraddleBody },
    { target: 'setup-ante', scope: 'novo-range', run: () => setPage('range-setup'), title: t.tour.setupAnteTitle, body: t.tour.setupAnteBody },
    { target: 'editor-position', scope: 'novo-range', run: loadStackRangeDemo, title: t.tour.editorPositionTitle, body: t.tour.editorPositionBody },
    { target: 'editor-name', scope: 'novo-range', run: loadStackRangeDemo, title: t.tour.editorNameTitle, body: t.tour.editorNameBody },
    { target: 'editor-stackfield', scope: 'novo-range', run: loadStackRangeDemo, title: t.tour.editorStackFieldTitle, body: t.tour.editorStackFieldBody },
    { target: 'editor-actionsfreq', scope: 'novo-range', run: loadActionsFreqDemo, title: t.tour.editorActionsFreqTitle, body: t.tour.editorActionsFreqBody },
    { target: 'editor-matrix', scope: 'novo-range', run: loadActionsFreqDemo, title: t.tour.editorMatrixTitle, body: t.tour.editorMatrixBody },
    { target: 'editor-stackrange', scope: 'novo-range', run: loadStackRangeDemo, title: t.tour.editorStackRangeTitle, body: t.tour.editorStackRangeBody },
    { target: 'editor-prereq', scope: 'novo-range', run: loadStackRangeDemo, title: t.tour.editorPrereqTitle, body: t.tour.editorPrereqBody },
    { target: 'table-editor-roles', scope: 'novo-range', run: loadTableDemo, title: t.tour.tableEditorRolesTitle, body: t.tour.tableEditorRolesBody },
    { target: 'table-editor-raisefuture', scope: 'novo-range', run: loadTableDemo, title: t.tour.tableEditorRaiseFutureTitle, body: t.tour.tableEditorRaiseFutureBody },
    { target: 'table-editor-table', scope: 'novo-range', run: loadTableDemo, title: t.tour.tableEditorTitle, body: t.tour.tableEditorBody },
    { target: 'table-editor-scenarios', scope: 'novo-range', run: loadTableDemo, title: t.tour.tableEditorScenariosTitle, body: t.tour.tableEditorScenariosBody },
    { target: 'table-editor-finalize', scope: 'novo-range', run: loadTableDemo, title: t.tour.tableEditorFinalizeTitle, body: t.tour.tableEditorFinalizeBody },
    { target: 'drill-select', scope: 'drill', run: startDrillMultiDemo, title: t.tour.drillTitle, body: t.tour.drillBody },
    { target: 'drill-settings', scope: 'drill', run: startDrillSettingsDemo, title: t.tour.drillSettingsTitle, body: t.tour.drillSettingsBody },
    { target: 'drill-handfilter', scope: 'drill', run: startDrillFilterDemo, title: t.tour.drillHandFilterTitle, body: t.tour.drillHandFilterBody },
    { target: 'drill-active', scope: 'drill', run: startDrillDemo, title: t.tour.drillActiveTitle, body: t.tour.drillActiveBody },
    { target: 'drill-viewrange', scope: 'drill', run: startDrillDemo, title: t.tour.drillViewRangeTitle, body: t.tour.drillViewRangeBody },
    { target: 'drill-scoreboard', scope: 'drill', run: startDrillDemo, title: t.tour.drillScoreboardTitle, body: t.tour.drillScoreboardBody },
    { target: 'drill-history', scope: 'drill', run: startDrillDemo, title: t.tour.drillHistoryTitle, body: t.tour.drillHistoryBody },
    { target: 'drill-summary', scope: 'drill', run: startDrillSummaryDemo, title: t.tour.drillSummaryTitle, body: t.tour.drillSummaryBody },
    { target: 'exercise-select', scope: 'exercise', run: () => setPage('exercise'), title: t.tour.exerciseTitle, body: t.tour.exerciseBody },
    { target: 'exercise-active', scope: 'exercise', run: startExerciseDemo, title: t.tour.exerciseActiveTitle, body: t.tour.exerciseActiveBody },
    { target: 'exercise-result', scope: 'exercise', run: startExerciseResultDemo, title: t.tour.exerciseResultTitle, body: t.tour.exerciseResultBody },
    { target: 'exercise-summary', scope: 'exercise', run: startExerciseSummaryDemo, title: t.tour.exerciseSummaryTitle, body: t.tour.exerciseSummaryBody },
    { target: 'stats-header', scope: 'stats', run: () => setPage('history'), title: t.tour.historyTitle, body: t.tour.historyBody },
  ]
  // onboardingScope=null → tour completo (signup / "Rever tutorial" no
  // perfil); com um scope, filtra só os passos daquela página — usado pelo
  // botão de tutorial de cada página, que sempre recomeça do passo 0 dentro
  // do subconjunto filtrado.
  const activeSteps = scope ? steps.filter(s => s.scope === scope) : steps
  const total = activeSteps.length
  const step = activeSteps[Math.min(stepIndex, total - 1)]

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
        // Alvos abaixo da dobra (ex: botão Finalizar numa lista longa de
        // cenários) ficam fora da viewport se não rolarmos até eles antes de
        // medir — sem isso, o spotlight nunca aparece nesses passos.
        el.scrollIntoView({ block: 'center', inline: 'nearest' })
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

  // Passo "faixas salvas": troca sozinho entre as faixas de stack a cada
  // 1.8s (chip 0 já foi mostrado pelo run() do passo, então começa do 1) —
  // demonstra visualmente que cada faixa tem sua própria matriz pintada.
  useEffect(() => {
    if (step.target !== 'editor-stackrange') return
    let idx = 1
    const id = setInterval(() => {
      const s = useStore.getState()
      if (s.sessionGrids.length === 0) return
      const sg = s.sessionGrids[idx % s.sessionGrids.length]
      useStore.setState({ rangeData: { ...s.rangeData, name: sg.name, stackRange: sg.stackRange, grid: sg.grid } })
      idx++
    }, 1800)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  function finish() {
    // resetDrillDemoState (não stopDrill): mesmo motivo do clearBuildDemo
    // abaixo — a demo nunca deve gravar os números fake no trainingHistory
    // real do Drill.
    if (startedDrillDemo.current) resetDrillDemoState()
    // clearBuildDemo (não stopBuildSession): a demo nunca deve gravar as
    // notas fake no histórico real do Range Check.
    if (startedBuildDemo.current) clearBuildDemo()
    useStore.setState({ onboardingStep: null, onboardingScope: null, onboardingDrillOverride: null, onboardingForceDrillSummary: false })
  }
  function next() {
    if (stepIndex + 1 >= total) finish()
    else useStore.setState({ onboardingStep: stepIndex + 1 })
  }
  function back() {
    if (stepIndex > 0) useStore.setState({ onboardingStep: stepIndex - 1 })
  }

  // Sair do tour (clique fora, Pular ou Esc) nunca encerra na hora — sempre
  // pede confirmação, pra não perder o lugar por um clique acidental fora do
  // painel. Só "Sim, sair" chama finish() de verdade e volta pro Dashboard.
  const [confirmingExit, setConfirmingExit] = useState(false)
  function requestExit() {
    setConfirmingExit(true)
  }
  function confirmExit() {
    setConfirmingExit(false)
    // Tutorial de página (scope): o usuário provavelmente já estava exatamente
    // onde queria estar, então sair não deve arrastá-lo pro Dashboard — só o
    // tour completo (scope null) volta pra lá ao ser interrompido.
    const wasScoped = scope !== null
    finish()
    if (!wasScoped) setPage('dashboard')
  }

  const dialogRef = useModalA11y<HTMLDivElement>(true, requestExit)
  const confirmDialogRef = useModalA11y<HTMLDivElement>(confirmingExit, () => setConfirmingExit(false))

  // PANEL_EST_HEIGHT é só o chute inicial pro primeiro paint — passos com
  // corpo de texto longo (ex: "Raise futuro") são mais altos que isso e
  // estouravam a borda inferior da tela. Mede a altura real do painel já
  // renderizado a cada commit e usa ela daqui pra frente.
  const [panelHeight, setPanelHeight] = useState(PANEL_EST_HEIGHT)
  useLayoutEffect(() => {
    if (dialogRef.current) setPanelHeight(dialogRef.current.offsetHeight)
  })

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
    const clampedTop = Math.min(Math.max(rect.top, PANEL_MARGIN), window.innerHeight - panelHeight - PANEL_MARGIN)
    if (spaceRight >= panelWidth) {
      panelLeft = rect.right + 14
      panelTop = clampedTop
    } else if (spaceLeft >= panelWidth) {
      panelLeft = rect.left - 14 - panelWidth
      panelTop = clampedTop
    } else {
      panelTop = rect.bottom + 14
      if (panelTop + panelHeight > window.innerHeight - PANEL_MARGIN) {
        panelTop = Math.max(window.innerHeight - panelHeight - PANEL_MARGIN, PANEL_MARGIN)
      }
      const rawLeft = rect.left + rect.width / 2 - panelWidth / 2
      panelLeft = Math.min(Math.max(rawLeft, PANEL_MARGIN), window.innerWidth - panelWidth - PANEL_MARGIN)
    }
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 60 }} onClick={requestExit}>
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
            onClick={requestExit}
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
      {confirmingExit && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(3,7,18,0.75)' }}
          onClick={e => { e.stopPropagation(); setConfirmingExit(false) }}
        >
          <div
            ref={confirmDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tour-exit-title"
            onClick={e => e.stopPropagation()}
            className="bg-warm-900 border border-warm-700 rounded-2xl p-5 max-w-xs w-full space-y-3 shadow-2xl"
          >
            <p id="tour-exit-title" className="text-sm font-bold text-warm-100">{t.tour.exitConfirmTitle}</p>
            <p className="text-xs text-warm-300 leading-relaxed">{t.tour.exitConfirmBody}</p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmingExit(false)}
                className="px-3.5 py-2 rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 text-sm font-semibold transition-colors"
              >
                {t.tour.exitConfirmNo}
              </button>
              <button
                onClick={confirmExit}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
              >
                {t.tour.exitConfirmYes}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
