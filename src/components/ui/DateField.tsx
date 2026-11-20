import { CalendarDays, ChevronDown } from 'lucide-react'
import { formatDate, todayIso, weekdayName } from '../../lib/date'

interface DateFieldProps {
  /** JJJJ-MM-TT */
  value: string
  onChange: (iso: string) => void
  /** Spätestes wählbares Datum (Standard: heute). */
  max?: string
  label?: string
}

/**
 * Antippbares Datum zum Nachtragen. Das native Datumsfeld liegt unsichtbar darüber und öffnet die Auswahl des Geräts.
 * Ist nicht der heutige Tag gewählt, wird das Feld hervorgehoben, damit ein Nachtrag nicht übersehen wird.
 */
export function DateField({ value, onChange, max = todayIso(), label = 'Datum der Einheit' }: DateFieldProps) {
  const isToday = value === todayIso()
  return (
    <label
      className={`relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-colors ${
        isToday ? 'bg-zinc-100 text-ink' : 'bg-amber-100 text-amber-900'
      }`}
    >
      <CalendarDays className={`size-4 ${isToday ? 'text-zinc-500' : 'text-amber-700'}`} aria-hidden />
      <span>
        {isToday ? 'Heute' : weekdayName(value)}, {formatDate(value)}
      </span>
      <ChevronDown className={`size-4 ${isToday ? 'text-zinc-400' : 'text-amber-700'}`} aria-hidden />
      <input
        type="date"
        value={value}
        max={max}
        aria-label={label}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value)
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  )
}
