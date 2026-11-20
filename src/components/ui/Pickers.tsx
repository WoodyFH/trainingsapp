import { Check } from 'lucide-react'
import { getIcon, ICON_NAMES } from '../../lib/icons'
import { TRAINING_COLORS } from '../../lib/trainingColors'

/** Farben zur Auswahl: die fünf Trainingsfarben plus weitere. */
export const COLOR_CHOICES: { hex: string; name: string }[] = [
  { hex: TRAINING_COLORS.training1, name: 'Koralle' },
  { hex: TRAINING_COLORS.training2, name: 'Kobaltblau' },
  { hex: TRAINING_COLORS.training3, name: 'Limettengrün' },
  { hex: TRAINING_COLORS.cardio, name: 'Violett' },
  { hex: TRAINING_COLORS.free, name: 'Bernstein' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#14B8A6', name: 'Türkis' },
  { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#64748B', name: 'Schiefer' },
]

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Farbe" className="grid grid-cols-5 gap-2">
      {COLOR_CHOICES.map((c) => {
        const active = c.hex.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.name}
            onClick={() => onChange(c.hex)}
            className="flex aspect-square items-center justify-center rounded-2xl text-white transition active:scale-95"
            style={{ background: c.hex }}
          >
            {active && <Check className="size-5" strokeWidth={3} aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

export function IconPicker({ value, onChange, color }: { value: string; onChange: (name: string) => void; color: string }) {
  return (
    <div role="radiogroup" aria-label="Symbol" className="grid grid-cols-6 gap-2">
      {ICON_NAMES.map((n) => {
        const Icon = getIcon(n)
        const active = n === value
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={n}
            onClick={() => onChange(n)}
            className="flex aspect-square items-center justify-center rounded-2xl transition active:scale-95"
            style={active ? { background: color, color: '#fff' } : { background: '#F4F4F5', color: '#71717A' }}
          >
            <Icon className="size-5" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
