import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatDate, formatNumber, formatShortDate, startOfWeek, toIsoDate, todayIso, weekdayName } from './date'

describe('date', () => {
  it('formatiert TT.MM.JJJJ und TT.MM.', () => {
    expect(formatDate('2026-11-19')).toBe('19.11.2026')
    expect(formatShortDate('2026-11-19')).toBe('19.11.')
  })

  it('verwendet die lokale Zeit für heute', () => {
    expect(todayIso(new Date(2026, 10, 19, 23, 59))).toBe('2026-11-19')
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('rechnet über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(daysBetween('2026-11-12', '2026-11-19')).toBe(7)
  })

  it('beginnt die Woche am Montag', () => {
    expect(startOfWeek('2026-11-19')).toBe('2026-11-16') // Donnerstag
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16') // Montag
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16') // Sonntag
    expect(weekdayName('2026-11-19')).toBe('Donnerstag')
  })

  it('formatiert Zahlen deutsch', () => {
    expect(formatNumber(82.5)).toBe('82,5')
    expect(formatNumber(1080, 0)).toBe('1.080')
  })
})
