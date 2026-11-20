import { Minus, Plus } from 'lucide-react'
import { useId, useState } from 'react'

interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
}

const round = (v: number) => Math.round(v * 100) / 100

/** Stepper mit großen −/+-Buttons (≥ 44 px); die Zahl ist antippbar für direkte Eingabe. */
export function Stepper({ label, value, onChange, step = 1, min = 0, max = 9999, unit }: StepperProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const set = (v: number) => {
    setDraft(null)
    onChange(round(Math.min(max, Math.max(min, v))))
    if ('vibrate' in navigator) navigator.vibrate?.(8)
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
          <input
            id={id}
            type="text"
            inputMode="decimal"
            value={draft ?? value}
            onChange={(e) => {
              setDraft(e.target.value)
              const v = Number.parseFloat(e.target.value.replace(',', '.'))
              if (!Number.isNaN(v)) onChange(round(Math.min(max, Math.max(min, v))))
            }}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => setDraft(null)}
            className="w-full min-w-0 rounded-xl bg-transparent text-center text-3xl font-bold tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
          />
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
    </div>
  )
}
