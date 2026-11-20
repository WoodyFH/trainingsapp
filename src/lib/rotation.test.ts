import { describe, expect, it } from 'vitest'
import { lastRotationSession, nextTemplateId, sortRotation } from './rotation'

const T = [
  { id: 't3', rotation_order: 3 },
  { id: 't1', rotation_order: 1 },
  { id: 't2', rotation_order: 2 },
]

describe('nextTemplateId (als Nächstes fällig)', () => {
  it('geht 1 → 2 → 3 → 1', () => {
    expect(nextTemplateId(T, 't1')).toBe('t2')
    expect(nextTemplateId(T, 't2')).toBe('t3')
    expect(nextTemplateId(T, 't3')).toBe('t1')
  })

  it('beginnt ohne Historie mit dem ersten Training', () => {
    expect(nextTemplateId(T, null)).toBe('t1')
  })

  it('beginnt von vorn, wenn das letzte Training nicht mehr in der Rotation ist', () => {
    expect(nextTemplateId(T, 'altes-training')).toBe('t1')
  })

  it('liefert null bei leerer Rotation', () => {
    expect(nextTemplateId([], 't1')).toBeNull()
  })

  it('sortiert nach rotation_order, Einträge ohne Position ans Ende', () => {
    expect(sortRotation([...T, { id: 'x', rotation_order: null }]).map((t) => t.id)).toEqual(['t1', 't2', 't3', 'x'])
  })
})

describe('lastRotationSession', () => {
  const ids = new Set(['t1', 't2', 't3'])
  const s = (template_id: string | null, date: string, created_at = '2026-01-01T00:00:00Z') => ({
    template_id,
    date,
    created_at,
  })

  it('nimmt die jüngste Einheit der Rotation und ignoriert freie und fremde Einheiten', () => {
    const sessions = [s('t1', '2026-11-16'), s('t2', '2026-11-17'), s('t3', '2026-11-19'), s(null, '2026-11-20'), s('x', '2026-11-21')]
    expect(lastRotationSession(sessions, ids)?.template_id).toBe('t3')
  })

  it('löst Gleichstand am selben Tag über den Anlagezeitpunkt', () => {
    const sessions = [s('t1', '2026-11-19', '2026-11-19T08:00:00Z'), s('t2', '2026-11-19', '2026-11-19T18:00:00Z')]
    expect(lastRotationSession(sessions, ids)?.template_id).toBe('t2')
  })

  it('liefert null ohne passende Einheit', () => {
    expect(lastRotationSession([s(null, '2026-11-19')], ids)).toBeNull()
  })

  it('ergibt nach dem Import (letztes Training 3) als Nächstes Training 1', () => {
    const last = lastRotationSession([s('t1', '2026-11-16'), s('t2', '2026-11-17'), s('t3', '2026-11-19')], ids)
    expect(nextTemplateId(T, last?.template_id ?? null)).toBe('t1')
  })
})
