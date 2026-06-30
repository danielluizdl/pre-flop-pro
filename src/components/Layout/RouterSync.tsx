import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import type { Page } from '../../types'

const PAGE_TO_PATH: Record<Page, string> = {
  dashboard: '/dashboard',
  ranges: '/ranges',
  drill: '/drill',
  history: '/historico',
  admin: '/coach',
  'range-setup': '/range-setup',
  editor: '/editor',
  'table-editor': '/table-editor',
  'category-detail': '/categoria',
}

const PATH_TO_PAGE: Record<string, Page> = Object.fromEntries(
  Object.entries(PAGE_TO_PATH).map(([page, path]) => [path, page as Page])
) as Record<string, Page>

// Paginas que dependem de estado em memoria (fluxo de criacao de range,
// categoria): tem rota mas nao garantem deep-link. Acesso direto cai em /ranges.
const TRANSIENT_PAGES = new Set<Page>(['range-setup', 'editor', 'table-editor', 'category-detail'])

function pageForPath(pathname: string): Page {
  return PATH_TO_PAGE[pathname] ?? 'dashboard'
}

export function RouterSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const page = useStore(s => s.page)
  // Ultima rota que NOS sincronizamos (qualquer direcao). Ignora a navegacao
  // reciproca que disparamos, quebrando o ping-pong URL<->store que o React 19
  // expoe (efeitos de sync que se re-disparam em loop com react-router 6).
  const lastSynced = useRef('')

  // URL -> store (back/forward, F5, deep-link)
  useEffect(() => {
    if (location.pathname === lastSynced.current) return
    lastSynced.current = location.pathname
    const target = pageForPath(location.pathname)
    const current = useStore.getState().page
    // Pagina transiente acessada direto (store nao esta nela: deep-link/F5) cai em /ranges.
    if (TRANSIENT_PAGES.has(target) && target !== current) {
      if (current !== 'ranges') useStore.setState({ page: 'ranges' })
      lastSynced.current = '/ranges'
      navigate('/ranges', { replace: true })
      return
    }
    if (target !== current) useStore.setState({ page: target })
  }, [location.pathname])

  // store -> URL (navegacao via setPage)
  // Le o page atual do store (nao o valor fechado no render) para evitar que o
  // estado inicial 'dashboard' sobrescreva a URL no F5 antes que o effect de
  // URL->store termine de sincronizar.
  useEffect(() => {
    const currentPage = useStore.getState().page
    const path = PAGE_TO_PATH[currentPage]
    if (path && path !== location.pathname && path !== lastSynced.current) {
      lastSynced.current = path
      navigate(path)
    }
  }, [page])

  return null
}
