import { addDays, addMonths, daysBetween } from '../lib/date'

/** Zeitraumfilter der Statistik: 4 Wochen, 3 Monate, 12 Monate, alles. */

export type PeriodKey = '4w' | '3m' | '12m' | 'all'

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '4w', label: '4 Wochen' },
  { key: '3m', label: '3 Monate' },
  { key: '12m', label: '12 Monate' },
  { key: 'all', label: 'Alles' },
]

export interface DateRange {
  /** Erster Tag (inklusive); null = ab Beginn der Aufzeichnung. */
  from: string | null
  /** Letzter Tag (inklusive), immer heute. */
  to: string
  /** Vorheriger Zeitraum gleicher Länge direkt davor; null bei "Alles". */
  prevFrom: string | null
  prevTo: string | null
}

export function rangeFor(period: PeriodKey, today: string): DateRange {
  let from: string | null
  if (period === '4w') from = addDays(today, -27)
  else if (period === '3m') from = addDays(addMonths(today, -3), 1)
  else if (period === '12m') from = addDays(addMonths(today, -12), 1)
  else from = null

  if (from === null) return { from: null, to: today, prevFrom: null, prevTo: null }
  const length = daysBetween(from, today) + 1
  const prevTo = addDays(from, -1)
  return { from, to: today, prevFrom: addDays(prevTo, -(length - 1)), prevTo }
}

export function inRange(date: string, from: string | null, to: string): boolean {
  return (from === null || date >= from) && date <= to
}

/** Standard-Darstellung der Volumen-Balken je Zeitraum. */
export const DEFAULT_GRANULARITY: Record<PeriodKey, 'session' | 'week' | 'month'> = {
  '4w': 'session',
  '3m': 'week',
  '12m': 'month',
  all: 'month',
}
