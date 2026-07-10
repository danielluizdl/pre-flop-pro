import { useState } from 'react'
import { t } from '../../i18n'

// Paginação incremental das listas de sessões do Histórico — renderizar
// centenas de cards de uma vez pesa o primeiro paint da página.
export function usePagedList<T>(items: T[], pageSize = 20) {
  const [count, setCount] = useState(pageSize)
  return {
    visible: items.slice(0, count),
    remaining: Math.max(0, items.length - count),
    showMore: () => setCount(c => c + pageSize),
  }
}

export function ShowMoreButton({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  if (remaining <= 0) return null
  return (
    <button
      onClick={onClick}
      className="w-full py-2.5 border border-warm-600 bg-warm-800 text-warm-300 rounded-xl text-sm font-semibold hover:bg-warm-700 transition-colors"
    >
      {t.stats.showMore(remaining)}
    </button>
  )
}
