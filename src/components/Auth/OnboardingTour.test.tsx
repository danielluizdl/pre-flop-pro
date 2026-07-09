import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'jest-axe'
import { AppLayout } from '../Layout/AppLayout'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import type { Range } from '../../types'

// Esse arquivo monta o AppLayout inteiro e encadeia várias atualizações de
// store dentro de um único run() (ex: loadStackRangeDemo) — sob paralelismo
// pesado de teste (suíte completa), o timeout padrão de 1000ms do waitFor
// já se mostrou insuficiente por pura contenção de CPU (não é bug real: com
// `vitest run --no-file-parallelism` a suíte inteira passa 100% das vezes).
configure({ asyncUtilTimeout: 4000 })

// Espelha o range real usado pelo tour em produção ("BTN vs 3B OOP"): mesmo id
// (pra bater com o STACKRANGE_PREREQ_DEMO_ID hardcoded no componente), 3 faixas
// de stack, prereq e um cenário real (BTN Open vs SB 3-Bet).
const PREREQ_RANGE: Range = {
  id: 500, name: 'RFI BTN', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8,
}

const STACKRANGE_DEMO: Range = {
  id: 1778104119544,
  name: 'BTN vs 3B OOP',
  positions: ['BTN'],
  grid: makeEmptyGrid(),
  tableSize: 8,
  prereqRangeId: 500,
  stackGrids: [
    { stackRange: '<=250bb', grid: { ...makeEmptyGrid(), AA: { fold: 0, call: 0, raise: 100, allin: 0 } } },
    { stackRange: '251-300bb', grid: makeEmptyGrid() },
    { stackRange: '>300bb', grid: makeEmptyGrid() },
  ],
  scenarios: [
    {
      id: 1,
      pot: '37.0',
      ante: 0.5,
      summary: 'SB 3bet (24bb) → BTN Open (6bb)',
      heroRaiseSize: 65,
      data: {
        sb: { role: '3bet', bet: 24, isHero: false, stack: 200 },
        bb: { role: 'fold', bet: 1, isHero: false, stack: 200 },
        str: { role: 'fold', bet: 2, isHero: false, stack: 200 },
        utg: { role: 'fold', bet: 0, isHero: false, stack: 200 },
        utg1: { role: 'fold', bet: 0, isHero: false, stack: 200 },
        mp: { role: 'fold', bet: 0, isHero: false, stack: 200 },
        co: { role: 'fold', bet: 0, isHero: false, stack: 200 },
        btn: { role: 'open', bet: 6, isHero: true, stack: 200 },
      },
    },
  ],
}

const SIMPLE_RANGE: Range = {
  id: 1, name: 'BTN RFI', positions: ['BTN'], grid: { ...makeEmptyGrid(), AA: { fold: 0, call: 0, raise: 100, allin: 0 } },
  scenarios: [], tableSize: 6,
}

function renderTour(onboardingStep = 0, extra: Record<string, unknown> = {}) {
  useStore.setState({
    userMode: 'visitor', page: 'dashboard', storageBlocked: false, justSignedUp: false, onboardingStep,
    currentUser: { id: 1, username: 'novo', name: 'Novo', email: '', role: 'player', firstLogin: false },
    ranges: [], trainingHistory: [], selectedDrillRangeIds: [], buildSelectedRangeIds: [],
    activeDrillRange: null, buildRounds: [], buildConfirmed: false, tempScenarios: [], currentScenario: {},
    ...extra,
  })
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppLayout />
    </MemoryRouter>,
  )
}

describe('OnboardingTour', () => {
  it('mostra o passo 1 (Dashboard) com o contador 1/30', () => {
    renderTour()
    expect(screen.getByText('Bem-vindo ao Pre-Flop Pro!')).toBeInTheDocument()
    expect(screen.getByText('1/30')).toBeInTheDocument()
  })

  it('"Próximo" navega de verdade pra próxima página (Meus Ranges)', async () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByRole('heading', { name: 'Meus Ranges' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('ranges')
    expect(useStore.getState().onboardingStep).toBe(1)
  })

  it('passo do formato da mesa mostra a tela "Novo Range"', async () => {
    renderTour(2)
    expect(await screen.findByRole('heading', { name: 'Novo Range' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('range-setup')
  })

  it('passo do straddle continua em "Novo Range" e explica o padrão de 2bb', async () => {
    renderTour(3)
    await screen.findByRole('heading', { name: 'Novo Range' })
    expect(screen.getByText('Terá straddle?')).toBeInTheDocument()
    expect(screen.getByText(/padrão de 2bb/)).toBeInTheDocument()
    expect(useStore.getState().page).toBe('range-setup')
  })

  it('passo do ante continua em "Novo Range" e explica o padrão de 0,5bb', async () => {
    renderTour(4)
    await screen.findByRole('heading', { name: 'Novo Range' })
    expect(screen.getByText(/0,5bb/)).toBeInTheDocument()
    expect(useStore.getState().page).toBe('range-setup')
  })

  it('passo da posição do herói carrega o range real e destaca a posição BTN', async () => {
    renderTour(5, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    expect(await screen.findByRole('heading', { name: 'Editar Range' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('editor')
    await waitFor(() => expect(useStore.getState().selectedEditorPositions).toEqual(['BTN']))
  })

  it('passo do nome mostra o nome real do range carregado', async () => {
    renderTour(6, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    await screen.findByRole('heading', { name: 'Editar Range' })
    await waitFor(() => expect(useStore.getState().rangeData.name).toBe('BTN vs 3B OOP'))
  })

  it('passo do campo de stack mostra a faixa carregada e o botão de ajuda', async () => {
    renderTour(7, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    await screen.findByRole('heading', { name: 'Editar Range' })
    expect(await screen.findByText('Escrevendo a faixa de stack')).toBeInTheDocument()
    await waitFor(() => expect((screen.getByPlaceholderText('Ex: <= 250, ou 250-300') as HTMLInputElement).value).toBe('<=250bb'))
    expect(screen.getByRole('button', { name: 'Ajuda sobre o formato do stack' })).toBeInTheDocument()
  })

  it('passo de ações & frequências ajusta o pincel e pinta KK 50/50', async () => {
    renderTour(8, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    await screen.findByRole('heading', { name: 'Editar Range' })
    // "Ações & Frequências" é tanto o título do passo do tour quanto o
    // cabeçalho do próprio painel na página — usa getAllByText.
    await waitFor(() => expect(screen.getAllByText('Ações & Frequências').length).toBeGreaterThanOrEqual(2))
    await waitFor(() => {
      expect(useStore.getState().brush.call).toBe(50)
      expect(useStore.getState().brush.raise).toBe(50)
      expect(useStore.getState().rangeData.grid.KK).toEqual({ fold: 0, call: 50, raise: 50, allin: 0 })
    })
  })

  it('passo da matriz mostra o range real já pintado, incluindo o KK 50/50', async () => {
    renderTour(9, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    await screen.findByRole('heading', { name: 'Editar Range' })
    expect(await screen.findByText('Pintando as mãos')).toBeInTheDocument()
    await waitFor(() => {
      expect(useStore.getState().rangeData.grid.AA.raise).toBe(100)
      expect(useStore.getState().rangeData.grid.KK.call).toBe(50)
    })
  })

  it('passo de faixas salvas mostra as 3 faixas e troca sozinho entre elas', async () => {
    renderTour(10, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    await screen.findByRole('heading', { name: 'Editar Range' })
    await waitFor(() => expect(useStore.getState().sessionGrids).toHaveLength(3))
    // '<=250bb' também é um dos botões de atalho do campo Stack Efetivo —
    // usa getAllByText pra não colidir com o chip da faixa salva.
    expect(screen.getAllByText('<=250bb').length).toBeGreaterThan(0)
    expect(screen.getByText('251-300bb')).toBeInTheDocument()
    expect(screen.getByText('>300bb')).toBeInTheDocument()
    await waitFor(() => expect(useStore.getState().rangeData.stackRange).toBe('<=250bb'))
    await waitFor(() => expect(useStore.getState().rangeData.stackRange).toBe('251-300bb'))
  })

  it('passo de pré-requisito mostra o range-pré-requisito real já selecionado', async () => {
    renderTour(11, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    // Carrega um range EXISTENTE pra edição (loadRangeForEdit), por isso o
    // título é "Editar Range", não "Criar Range".
    await screen.findByRole('heading', { name: 'Editar Range' })
    await waitFor(() => expect(useStore.getState().rangeData.prereqRangeId).toBe(500))
    expect(screen.getByText('RFI BTN')).toBeInTheDocument()
  })

  it('passo de escolher a ação mostra o cenário real (BTN Open, SB 3-Bet)', async () => {
    renderTour(12, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    await screen.findByRole('heading', { name: 'Configurar Cenários' })
    await waitFor(() => expect((screen.getByLabelText('Ação de BTN') as HTMLSelectElement).value).toBe('open'))
    expect((screen.getByLabelText('Ação de SB') as HTMLSelectElement).value).toBe('3bet')
  })

  it('passo de raise futuro mostra o tamanho real do 4-bet do herói', async () => {
    renderTour(13, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    await screen.findByRole('heading', { name: 'Configurar Cenários' })
    await waitFor(() => expect((screen.getByLabelText('Tamanho do raise futuro') as HTMLInputElement).value).toBe('65'))
  })

  it('passo da mesa e passo de cenários continuam mostrando o mesmo cenário real', async () => {
    renderTour(14, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    await screen.findByRole('heading', { name: 'Configurar Cenários' })
    await waitFor(() => expect((screen.getByLabelText('Ação de BTN') as HTMLSelectElement).value).toBe('open'))
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByText('Salvando cenários')).toBeInTheDocument()
    await waitFor(() => expect((screen.getByLabelText('Ação de BTN') as HTMLSelectElement).value).toBe('open'))
  })

  it('novo passo destaca o botão de finalizar e salvar o range', async () => {
    renderTour(16, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    expect(await screen.findByText('Finalizando e salvando o range')).toBeInTheDocument()
    await waitFor(() => expect((screen.getByLabelText('Ação de BTN') as HTMLSelectElement).value).toBe('open'))
    expect(screen.getByRole('button', { name: '✅ Finalizar e Salvar Range' })).toBeInTheDocument()
  })

  it('voltar do passo de escolher ação (índice 12) pro passo da matriz (índice 9) navega de volta pro RangeEditorPage', async () => {
    renderTour(12, { ranges: [STACKRANGE_DEMO, PREREQ_RANGE] })
    await screen.findByRole('heading', { name: 'Configurar Cenários' })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    // Todo passo do Editor (posição/nome/stack/ações/matriz/faixas/prereq)
    // carrega o mesmo range real — por isso a página mostra "Editar Range" o
    // tempo todo nessa seção, sem transição pra "Criar Range".
    expect(await screen.findByRole('heading', { name: 'Editar Range' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('editor')
  })

  it('passo de seleção do Drill marca ranges de 2 posições diferentes automaticamente', async () => {
    const rangeBtn: Range = { id: 101, name: 'BTN RFI demo', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }
    const rangeSb: Range = { id: 102, name: 'SB vs 3-bet demo', positions: ['SB'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }
    renderTour(17, { ranges: [rangeBtn, rangeSb] })
    await screen.findByText('Drill: escolha o que treinar')
    await waitFor(() => expect(useStore.getState().selectedDrillRangeIds.slice().sort((a, b) => a - b)).toEqual([101, 102]))
    expect(await screen.findByText('BTN RFI demo')).toBeInTheDocument()
    expect(screen.getByText('SB vs 3-bet demo')).toBeInTheDocument()
  })

  it('passo "como você quer jogar" mostra a tela de configurações do Drill', async () => {
    renderTour(18, { ranges: [STACKRANGE_DEMO] })
    expect(await screen.findByRole('heading', { name: 'Configurações de treino' })).toBeInTheDocument()
    expect(screen.getByText('Como você quer jogar')).toBeInTheDocument()
  })

  it('passo de filtro de mãos mostra a grade de exclusão do Drill', async () => {
    renderTour(19, { ranges: [STACKRANGE_DEMO] })
    expect(await screen.findByRole('heading', { name: 'Filtro de Mãos' })).toBeInTheDocument()
    expect(screen.getByText('Filtrando quais mãos entram')).toBeInTheDocument()
  })

  it('passo do Drill ao vivo inicia uma sessão de demonstração com uma mão real', async () => {
    renderTour(20, { ranges: [STACKRANGE_DEMO] })
    await waitFor(() => {
      expect(useStore.getState().activeDrillRange?.id).toBe(1778104119544)
      expect(useStore.getState().activeHand).toBeTruthy()
    })
    expect(await screen.findByRole('button', { name: /FOLD/ }, { timeout: 5000 })).toBeInTheDocument()
  })

  it('passo do Drill ao vivo não reinicia uma sessão real já em andamento', async () => {
    renderTour(20, {
      ranges: [STACKRANGE_DEMO],
      activeDrillRange: STACKRANGE_DEMO,
      activeHand: 'KK',
      activeDrillStackGridIdx: -1,
      activeDrillStackRange: '',
      currentHandSuits: ['h', 's'],
      currentScenario: {},
      currentRng: 50,
      currentHeroRaiseSize: 0,
      sessionStats: { hands: 3, correct: 2, errors: 1, consults: 0 },
    })
    await screen.findByRole('button', { name: /FOLD/ })
    expect(useStore.getState().activeHand).toBe('KK')
    expect(useStore.getState().sessionStats.hands).toBe(3)
  })

  it('atalho de teclado do Drill não responde a mão de demonstração durante o tour', async () => {
    renderTour(20, { ranges: [STACKRANGE_DEMO], sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, handHistory: [] })
    await waitFor(() => expect(useStore.getState().activeHand).toBeTruthy())
    fireEvent.keyDown(window, { key: 'f' })
    expect(useStore.getState().sessionStats.hands).toBe(0)
    expect(useStore.getState().handHistory).toHaveLength(0)
  })

  it('clicar num botão de ação do Drill não conta a mão de demonstração como resposta real', async () => {
    renderTour(20, { ranges: [STACKRANGE_DEMO], sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, handHistory: [] })
    const foldBtn = await screen.findByRole('button', { name: /FOLD/ }, { timeout: 5000 })
    fireEvent.click(foldBtn)
    expect(useStore.getState().sessionStats.hands).toBe(0)
    expect(useStore.getState().handHistory).toHaveLength(0)
  })

  it('passo do nome do range destaca o nome grande no topo da mesa', async () => {
    renderTour(21, { ranges: [STACKRANGE_DEMO] })
    await waitFor(() => expect(useStore.getState().activeDrillRange?.id).toBe(1778104119544))
    expect(screen.getByText('O range da vez, em destaque')).toBeInTheDocument()
    expect(await screen.findByText('BTN vs 3B OOP')).toBeInTheDocument()
  })

  it('passo do quadrante mostra os contadores da sessão ao lado da mesa (fora do quadro da mesa)', async () => {
    renderTour(22, { ranges: [STACKRANGE_DEMO] })
    await waitFor(() => expect(useStore.getState().activeDrillRange?.id).toBe(1778104119544))
    expect(screen.getByText('O quadrante de acertos e erros')).toBeInTheDocument()
    expect(await screen.findByText('Mãos')).toBeInTheDocument()
    expect(screen.getByText('Acertos')).toBeInTheDocument()
  })

  it('passo do histórico destaca a lista de mãos respondidas ao lado da mesa', async () => {
    renderTour(23, { ranges: [STACKRANGE_DEMO] })
    await waitFor(() => expect(useStore.getState().activeDrillRange?.id).toBe(1778104119544))
    expect(screen.getByText('Histórico ao lado')).toBeInTheDocument()
    expect(await screen.findByText('Sem mãos ainda')).toBeInTheDocument()
  })

  it('passo do resumo força a tela de resumo pós-treino, sem perder a sessão de demonstração', async () => {
    renderTour(24, { ranges: [STACKRANGE_DEMO] })
    expect(await screen.findByRole('heading', { name: 'Resumo do Treino' })).toBeInTheDocument()
    expect(screen.getByText('O resumo ao encerrar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← Voltar ao treino' })).toBeInTheDocument()
    expect(useStore.getState().activeDrillRange?.id).toBe(1778104119544)
  })

  it('"Voltar" do passo de resumo pro histórico volta a mostrar o Drill ativo, sem ficar preso no resumo', async () => {
    renderTour(24, { ranges: [STACKRANGE_DEMO] })
    await screen.findByRole('heading', { name: 'Resumo do Treino' })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(await screen.findByText('Histórico ao lado')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Resumo do Treino' })).not.toBeInTheDocument()
    expect(useStore.getState().activeDrillRange?.id).toBe(1778104119544)
  })

  it('passo do Range Check ao vivo inicia uma rodada de demonstração pra pintar', async () => {
    renderTour(25, { ranges: [SIMPLE_RANGE] })
    await screen.findByText('Range Check: escolha o que reproduzir')
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    await waitFor(() => expect(useStore.getState().buildRounds).toHaveLength(1))
    expect(await screen.findByText('Combos por ação')).toBeInTheDocument()
  })

  it('passo do resultado da rodada preenche o gabarito da demo e mostra nota 100', async () => {
    renderTour(27, { ranges: [SIMPLE_RANGE] })
    await waitFor(() => expect(useStore.getState().buildLastResult).not.toBeNull())
    expect(screen.getByText('A nota de cada rodada')).toBeInTheDocument()
    expect(await screen.findByText('100/100')).toBeInTheDocument()
  })

  it('passo do resumo do exercício preenche as 3 rodadas do range multi-stack e mostra o resumo final', async () => {
    renderTour(28, { ranges: [STACKRANGE_DEMO] })
    await waitFor(() => expect(useStore.getState().buildResults).toHaveLength(3))
    expect(useStore.getState().buildRoundIdx).toBe(3)
    expect(screen.getByRole('heading', { name: 'Resumo do Exercício' })).toBeInTheDocument()
    expect(screen.getByText('O resultado no final do exercício')).toBeInTheDocument()
    expect(screen.getAllByText('100/100').length).toBeGreaterThan(0)
  })

  it('passo do resultado do exercício não mexe numa sessão real do usuário já em andamento', async () => {
    const realRound = { rangeId: 999, rangeName: 'Sessão real', stackRange: '', label: 'Sessão real', grid: makeEmptyGrid() }
    renderTour(27, {
      ranges: [SIMPLE_RANGE],
      buildRounds: [realRound], buildRoundIdx: 0, buildConfirmed: true, buildResults: [], buildLastResult: null,
    })
    await screen.findByText('A nota de cada rodada')
    expect(useStore.getState().buildLastResult).toBeNull()
    expect(useStore.getState().buildRounds).toEqual([realRound])
  })

  it('encerrar o tour depois do resumo do exercício não grava a sessão de demonstração no histórico real do Range Check', async () => {
    renderTour(28, { ranges: [STACKRANGE_DEMO], buildHistory: [] })
    await waitFor(() => expect(useStore.getState().buildResults).toHaveLength(3))
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim, sair' }))
    expect(useStore.getState().buildRounds).toHaveLength(0)
    expect(useStore.getState().buildHistory).toHaveLength(0)
  })

  it('último passo (Histórico) mostra "Concluir" e encerra o tour ao clicar', async () => {
    renderTour(29)
    expect(await screen.findByText('Seu histórico')).toBeInTheDocument()
    expect(screen.getByText('30/30')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(useStore.getState().onboardingStep).toBeNull()
  })

  it('confirmar saída depois do passo de Drill ao vivo para a sessão de demonstração que ele criou', async () => {
    renderTour(20, { ranges: [STACKRANGE_DEMO] })
    await screen.findByRole('button', { name: /FOLD/ })
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim, sair' }))
    expect(useStore.getState().activeDrillRange).toBeNull()
  })

  it('não mostra "Voltar" no primeiro passo', () => {
    renderTour(0)
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
  })

  it('"Voltar" retorna ao passo anterior e roda o run() dele de novo', async () => {
    renderTour(1)
    expect(await screen.findByRole('heading', { name: 'Meus Ranges' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(useStore.getState().onboardingStep).toBe(0)
    expect(useStore.getState().page).toBe('dashboard')
    expect(screen.getByText('1/30')).toBeInTheDocument()
  })

  it('"Pular tutorial" pede confirmação em vez de encerrar na hora', () => {
    renderTour(2)
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }))
    expect(screen.getByText('Sair do tutorial?')).toBeInTheDocument()
    expect(useStore.getState().onboardingStep).toBe(2)
  })

  it('cancelar a confirmação de saída mantém o tour no mesmo passo', () => {
    renderTour(2)
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar tutorial' }))
    expect(screen.queryByText('Sair do tutorial?')).not.toBeInTheDocument()
    expect(useStore.getState().onboardingStep).toBe(2)
  })

  it('confirmar a saída encerra o tour e volta pro Dashboard', () => {
    renderTour(3)
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim, sair' }))
    expect(useStore.getState().onboardingStep).toBeNull()
    expect(useStore.getState().page).toBe('dashboard')
  })

  it('clicar fora do painel do tour também pede confirmação, sem encerrar na hora', () => {
    renderTour(2)
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(screen.getByText('Sair do tutorial?')).toBeInTheDocument()
    expect(useStore.getState().onboardingStep).toBe(2)
  })

  it('Esc pede confirmação em vez de encerrar o tour na hora', () => {
    renderTour(1)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByText('Sair do tutorial?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sim, sair' }))
    expect(useStore.getState().onboardingStep).toBeNull()
  })

  it('mostra a observação sobre reabrir o tutorial no perfil', () => {
    renderTour()
    expect(screen.getByText(/Perfil → Rever tutorial/)).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = renderTour()
    expect((await axe(container)).violations).toEqual([])
  })
})
