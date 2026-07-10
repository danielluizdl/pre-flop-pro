import { useState } from 'react'
import { SUIT_ICONS } from '../../types'
import type { HandHistoryEntry } from '../../types'
import { t } from '../../i18n'

export function MiniCard({ rank, suit }: { rank: string; suit: string }) {
  const colorClass: Record<string, string> = {
    h: 'text-red-400', d: 'text-blue-400', s: 'text-warm-300', c: 'text-emerald-400',
  }
  return (
    <span className={`font-bold ${colorClass[suit] ?? 'text-warm-300'}`}>
      {rank}{SUIT_ICONS[suit]}
    </span>
  )
}

export function HandHistoryItem({ entry, onClick, showRange }: {
  entry: HandHistoryEntry
  onClick?: () => void
  showRange?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`p-2 rounded-lg border text-xs transition-all ${entry.correct ? 'border-emerald-700/40 bg-emerald-900/10' : 'border-red-700/40 bg-red-900/10'} ${onClick ? 'cursor-pointer hover:brightness-125' : ''}`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.correct ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <MiniCard rank={entry.hand[0]} suit={entry.suits[0]} />
        <MiniCard rank={entry.hand[1]} suit={entry.suits[1]} />
        <span className="ml-auto text-warm-500 tabular-nums">{entry.rng}</span>
      </div>
      <div className="pl-3.5">
        {entry.correct ? (
          <span className="text-emerald-400 font-semibold">{entry.actionTaken}</span>
        ) : (
          <>
            <span className="text-red-400">{entry.actionTaken}</span>
            <span className="text-warm-500"> → </span>
            <span className="text-emerald-400">{entry.correctAction}</span>
          </>
        )}
        {!!entry.raiseSize && <span className="text-warm-500"> ({entry.raiseSize})</span>}
      </div>
      {showRange && (
        <div className="pl-3.5 text-warm-500 truncate">
          {entry.rangeName}{entry.stackRange ? ` · ${entry.stackRange}` : ''}
        </div>
      )}
    </div>
  )
}

// Replay mão a mão de uma sessão salva no Histórico (TrainingSession.handLog).
export function SessionHandLog({ handLog }: { handLog?: HandHistoryEntry[] }) {
  const [open, setOpen] = useState(false)

  const hasLog = !!handLog && handLog.length > 0
  const showRange = hasLog && new Set(handLog!.map(e => e.rangeId)).size > 1

  return (
    <div className="border border-warm-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-warm-800 hover:bg-warm-750 transition-colors text-left"
      >
        <span className="font-bold text-warm-100 text-sm">
          {t.stats.handLog}
          {hasLog && <span className="text-warm-400 font-normal"> ({handLog!.length})</span>}
        </span>
        <span className={`text-warm-400 text-lg transition-transform duration-200 inline-block ${open ? 'rotate-180' : ''}`}>›</span>
      </button>
      {open && (
        <div className="border-t border-warm-700 bg-warm-900/40 p-3">
          {hasLog ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {handLog!.map(entry => (
                <HandHistoryItem key={entry.id} entry={entry} showRange={showRange} />
              ))}
            </div>
          ) : (
            <p className="text-warm-500 text-xs text-center py-3">{t.stats.handLogUnavailable}</p>
          )}
        </div>
      )}
    </div>
  )
}
