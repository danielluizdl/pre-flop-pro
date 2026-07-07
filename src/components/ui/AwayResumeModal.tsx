import { useModalA11y } from '../../utils/useModalA11y'
import { t } from '../../i18n'

function formatMMSS(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function AwayResumeModal({ remainingMs, onContinue }: { remainingMs: number; onContinue: () => void }) {
  const dialogRef = useModalA11y<HTMLDivElement>(true)

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="away-resume-title"
        className="bg-warm-900 border border-warm-700 rounded-2xl p-5 max-w-sm w-full space-y-3"
      >
        <h3 id="away-resume-title" className="text-base font-bold text-warm-100">{t.awayGuard.title}</h3>
        <p className="text-sm text-warm-300">{t.awayGuard.body}</p>
        <p className="text-2xl font-extrabold tabular-nums text-center text-brand-400">{formatMMSS(remainingMs)}</p>
        <div className="flex justify-end pt-1">
          <button
            onClick={onContinue}
            className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
          >
            {t.awayGuard.continueBtn}
          </button>
        </div>
      </div>
    </div>
  )
}
