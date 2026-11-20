import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { summarizeSession, type SessionSummary } from '../../data/summary'
import { formatDate, formatNumber } from '../../lib/date'
import { Sheet } from '../ui/Sheet'

interface FinishSummaryProps {
  open: boolean
  onClose: () => void
  sessionId: string | undefined
  bodyweightKg: number
  title: string
  color: string
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-zinc-50 p-4">
      <span className="label-caps">{label}</span>
      <span className="text-2xl font-extrabold tabular-nums text-ink">{value}</span>
    </div>
  )
}

export function FinishSummary({ open, onClose, sessionId, bodyweightKg, title, color }: FinishSummaryProps) {
  const [summary, setSummary] = useState<SessionSummary | null>(null)

  useEffect(() => {
    if (!open || !sessionId) return
    let cancelled = false
    void summarizeSession(sessionId, bodyweightKg).then((s) => {
      if (!cancelled) setSummary(s)
    })
    return () => {
      cancelled = true
    }
  }, [open, sessionId, bodyweightKg])

  const delta = summary?.deltaPercent ?? null
  const DeltaIcon = delta === null || Math.abs(delta) < 0.5 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <Sheet open={open} onClose={onClose} title="Training beendet">
      {!summary ? (
        <p className="m-0 py-6 text-center text-sm text-zinc-500">Zusammenfassung wird berechnet …</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-sm text-zinc-500">{title}</p>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Übungen" value={String(summary.exerciseCount)} />
            <Metric label="Volumen" value={`${formatNumber(summary.volume, 0)} kg`} />
            {summary.holdSeconds > 0 && <Metric label="Haltezeit" value={`${formatNumber(summary.holdSeconds, 0)} s`} />}
          </div>

          <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: `${color}1F` }}>
            <DeltaIcon className="size-6 shrink-0" style={{ color }} aria-hidden />
            <p className="m-0 text-sm text-ink">
              {delta === null || summary.previousDate === null ? (
                'Kein Vergleich möglich, es gibt noch keine frühere Einheit mit Volumen.'
              ) : (
                <>
                  <strong>
                    {delta > 0 ? '+' : ''}
                    {formatNumber(delta, 1)} %
                  </strong>{' '}
                  Volumen gegenüber dem letzten Mal ({formatDate(summary.previousDate)},{' '}
                  {formatNumber(summary.previousVolume ?? 0, 0)} kg).
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl font-bold text-white transition active:scale-[0.98]"
            style={{ background: color }}
          >
            Fertig
          </button>
        </div>
      )}
    </Sheet>
  )
}
