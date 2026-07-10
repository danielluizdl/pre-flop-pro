import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { usePagedList, ShowMoreButton } from './PagedList'

function Demo({ total, pageSize }: { total: number; pageSize?: number }) {
  const items = Array.from({ length: total }, (_, i) => i)
  const paged = usePagedList(items, pageSize)
  return (
    <div>
      <ul>{paged.visible.map(i => <li key={i}>item-{i}</li>)}</ul>
      <ShowMoreButton remaining={paged.remaining} onClick={paged.showMore} />
    </div>
  )
}

describe('usePagedList + ShowMoreButton', () => {
  it('mostra só a primeira página e o restante no botão', () => {
    render(<Demo total={45} pageSize={20} />)
    expect(screen.getAllByText(/^item-/)).toHaveLength(20)
    expect(screen.getByRole('button', { name: 'Mostrar mais (25)' })).toBeInTheDocument()
  })

  it('clicar carrega mais uma página e o botão some quando acaba', () => {
    render(<Demo total={45} pageSize={20} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais (25)' }))
    expect(screen.getAllByText(/^item-/)).toHaveLength(40)
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais (5)' }))
    expect(screen.getAllByText(/^item-/)).toHaveLength(45)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('lista menor que a página não mostra o botão', () => {
    render(<Demo total={3} pageSize={20} />)
    expect(screen.getAllByText(/^item-/)).toHaveLength(3)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
