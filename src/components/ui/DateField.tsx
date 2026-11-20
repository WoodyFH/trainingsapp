import { CalendarDays } from 'lucide-react'
import { formatDate, todayIso, weekdayName } from '../../lib/date'

interface DateFieldProps {
  /** JJJJ-MM-TT */
  value: string
  onChange: (iso: string) => void
  /** Spätestes wählbares Datum (Standard: heute). */
  max?: string
  label?: string
}

/** Antippbares Datum. Das native Datumsfeld liegt unsichtbar darüber und öffnet die Auswahl des Geräts. */
export function DateField({ value, onChange, max = todayIso(), label = 'Datum der Einheit' }: DateFieldProps) {
  const isToday = value === todayIso()
  return (
    <label className="relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl bg-zinc-100 px-4 text-sm font-semibold text-ink">
      <CalendarDays className="size-4 text-zinc-500" aria-hidden />
      <span>{isToday ? 'Heute' : weekdayName(value)}, {formatDate(value)}</span>
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
