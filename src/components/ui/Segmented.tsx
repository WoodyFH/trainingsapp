import type { ReactNode } from 'react'

interface SegmentedProps<T extends string | number> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode; hint?: string }[]
  label: string
  /** Akzentfarbe des gewählten Eintrags (Standard: dunkel). */
  color?: string
}

/** Auswahl aus wenigen Optionen (Radiogruppe), z. B. Lasttyp oder Seiten. */
export function Segmented<T extends string | number>({ value, onChange, options, label, color }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`h-11 flex-1 whitespace-nowrap rounded-2xl px-4 text-sm font-semibold transition ${
              active ? 'text-white' : 'bg-zinc-100 text-zinc-600'
            }`}
            style={active ? { background: color ?? '#18181B' } : undefined}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
