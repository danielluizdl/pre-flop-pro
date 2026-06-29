import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addBreadcrumb } from '../utils/sentry'
import { useStore } from './useStore'

vi.mock('../utils/sentry', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  captureError: vi.fn(),
}))

describe('store breadcrumbs (#15 FASE 3)', () => {
  beforeEach(() => {
    vi.mocked(addBreadcrumb).mockClear()
    localStorage.clear()
  })

  it('setPage emite migalha de navegação', () => {
    useStore.getState().setPage('drill')
    expect(addBreadcrumb).toHaveBeenCalledWith('nav', 'page → drill')
  })

  it('exportData emite migalha com contagens', () => {
    useStore.getState().exportData()
    expect(addBreadcrumb).toHaveBeenCalledWith(
      'data',
      'export',
      expect.objectContaining({ ranges: expect.any(Number), sessions: expect.any(Number) }),
    )
  })

  it('resetLocalData emite migalha', () => {
    useStore.getState().resetLocalData()
    expect(addBreadcrumb).toHaveBeenCalledWith('data', 'reset local')
  })

  it('deleteRange emite migalha', () => {
    useStore.getState().deleteRange(-1)
    expect(addBreadcrumb).toHaveBeenCalledWith('range', 'delete', { admin: false })
  })

  it('finalizeRange emite migalha de salvamento', () => {
    useStore.setState({ selectedEditorPositions: [], sessionGrids: [] })
    useStore.getState().finalizeRange()
    expect(addBreadcrumb).toHaveBeenCalledWith(
      'range',
      expect.stringContaining('saved'),
      expect.objectContaining({ total: expect.any(Number) }),
    )
  })
})
