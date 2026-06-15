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
  const firstRun = useRef(true)

  // URL -> store (back/forward, F5, deep-link)
  useEffect(() => {
    const target = pageForPath(location.pathname)
    if (firstRun.current) {
      firstRun.current = false
      if (TRANSIENT_PAGES.has(target)) {
        useStore.setState({ page: 'ranges' })
        navigate('/ranges', { replace: true })
        return
      }
    }
    if (target !== useStore.getState().page) useStore.setState({ page: target })
  }, [location.pathname])

  // store -> URL (navegacao via setPage)
  useEffect(() => {
    const path = PAGE_TO_PATH[page]
    if (path && path !== location.pathname) navigate(path)
  }, [page])

  return null
}
