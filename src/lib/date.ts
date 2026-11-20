/** Datumshelfer. Kalendertage sind Texte im Format JJJJ-MM-TT (lokale Zeit, ohne Zeitzonen-Verschiebung). */

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now)
}

/** TT.MM.JJJJ */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** TT.MM. */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}.${m}.`
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

/** Montag der Woche, in der `iso` liegt (die Woche beginnt am Montag). */
export function startOfWeek(iso: string): string {
  const d = parseIsoDate(iso)
  const offset = (d.getDay() + 6) % 7 // Montag = 0 … Sonntag = 6
  d.setDate(d.getDate() - offset)
  return toIsoDate(d)
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()
  return Math.round(ms / 86_400_000)
}

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

export function weekdayName(iso: string): string {
  return WEEKDAYS[parseIsoDate(iso).getDay()] ?? ''
}

/** Zahl im deutschen Format ohne überflüssige Nachkommastellen (82,5). */
export function formatNumber(value: number, maxDigits = 1): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: maxDigits }).format(value)
}

/** Verschiebt ein Datum um ganze Monate; der Tag wird auf das Monatsende begrenzt (31.05. − 3 Monate = 28.02.). */
export function addMonths(iso: string, months: number): string {
  const d = parseIsoDate(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return toIsoDate(d)
}

/** Erster Tag des Monats, in dem `iso` liegt. */
export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** "Nov 26" */
export function formatMonthShort(iso: string): string {
  const [y, m] = iso.split('-')
  return `${MONTHS_SHORT[Number(m) - 1] ?? ''} ${(y ?? '').slice(2)}`
}
