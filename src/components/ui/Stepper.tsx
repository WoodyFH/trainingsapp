import { Minus, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { formatNumber } from '../../lib/date'
import { NumberWheel } from './NumberWheel'
import { Sheet } from './Sheet'

interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  /** Zahl antippen öffnet eine scrollbare Zahlenauswahl statt des Tastaturfelds. */
  wheel?: boolean
  /** Größter Wert in der Zahlenauswahl (Standard: max). Größere Werte lassen sich weiter per Tastatur eintippen. */
  wheelMax?: number
}

const round = (v: number) => Math.round(v * 100) / 100
const show = (v: number) => formatNumber(v, 2)

/**
 * Stepper mit großen −/+-Buttons (≥ 44 px). Die Zahl ist antippbar: entweder direkte Eingabe oder,
 * mit `wheel`, eine scrollbare Zahlenauswahl (mit Umschalter zur Tastatureingabe).
 */
export function Stepper({ label, value, onChange, step = 1, min = 0, max = 9999, unit, wheel = false, wheelMax }: StepperProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const clamp = (v: number) => round(Math.min(max, Math.max(min, v)))
  const set = (v: number) => {
    setDraft(null)
    onChange(clamp(v))
    if ('vibrate' in navigator) navigator.vibrate?.(8)
  }
  const typed = (text: string) => {
    setDraft(text)
    const v = Number.parseFloat(text.replace(',', '.'))
    if (!Number.isNaN(v)) onChange(clamp(v))
  }
  const close = () => {
    setWheelOpen(false)
    setTyping(false)
    setDraft(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="label-caps">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label} verringern`}
          onClick={() => set(value - step)}
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 transition active:scale-95 active:bg-zinc-200"
        >
          <Minus className="size-5" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          {wheel ? (
            <button
              id={id}
              type="button"
              aria-haspopup="dialog"
              aria-label={`${label}: ${show(value)}${unit ? ` ${unit}` : ''}, Auswahl öffnen`}
              onClick={() => setWheelOpen(true)}
              className="w-full min-w-0 rounded-xl bg-transparent text-center text-3xl font-bold tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
            >
              {show(value)}
            </button>
          ) : (
            <input
              id={id}
              type="text"
              inputMode="decimal"
              value={draft ?? value}
              onChange={(e) => typed(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => setDraft(null)}
              className="w-full min-w-0 rounded-xl bg-transparent text-center text-3xl font-bold tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
            />
          )}
          {unit && <span className="shrink-0 text-sm font-medium text-zinc-400">{unit}</span>}
        </div>
        <button
          type="button"
          aria-label={`${label} erhöhen`}
          onClick={() => set(value + step)}
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 transition active:scale-95 active:bg-zinc-200"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>

      {wheel && (
        <Sheet open={wheelOpen} onClose={close} title={label}>
          <div className="flex flex-col gap-4">
            {typing ? (
              <div className="flex items-baseline justify-center gap-2 py-6">
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  aria-label={`${label} eintippen`}
                  value={draft ?? value}
                  onChange={(e) => typed(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-40 rounded-2xl bg-zinc-100 py-3 text-center text-4xl font-bold tabular-nums text-ink outline-none focus:ring-2 focus:ring-zinc-300"
                />
                {unit && <span className="text-base font-medium text-zinc-400">{unit}</span>}
              </div>
            ) : (
              <NumberWheel
                label={label}
                value={value}
                onChange={(v) => {
                  onChange(clamp(v))
                  if ('vibrate' in navigator) navigator.vibrate?.(4)
                }}
                min={min}
                max={Math.min(max, wheelMax ?? max)}
                step={step}
                unit={unit}
                format={show}
              />
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setDraft(null)
                  setTyping((t) => !t)
                }}
                className="h-12 rounded-2xl bg-zinc-100 px-5 font-semibold text-zinc-600"
              >
                {typing ? 'Auswahl' : 'Eintippen'}
              </button>
              <button type="button" onClick={close} className="h-12 flex-1 rounded-2xl bg-zinc-900 font-bold text-white">
                Fertig
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
