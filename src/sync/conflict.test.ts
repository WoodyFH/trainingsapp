import { describe, expect, it } from 'vitest'
import { lastWriteWins, maxServerTimestamp, shouldApplyRemote } from './conflict'

const T1 = '2026-11-19T10:00:00.000Z'
const T2 = '2026-11-19T10:00:05.000Z'

describe('shouldApplyRemote (letzte Änderung gewinnt)', () => {
  it('übernimmt, wenn es lokal keine Zeile gibt', () => {
    expect(shouldApplyRemote(undefined, { updated_at: T1 }, false)).toBe(true)
  })

  it('übernimmt einen neueren Remote-Stand', () => {
    expect(shouldApplyRemote({ updated_at: T1 }, { updated_at: T2 }, false)).toBe(true)
  })

  it('übernimmt einen neueren Remote-Stand auch bei wartender lokaler Änderung', () => {
    expect(shouldApplyRemote({ updated_at: T1 }, { updated_at: T2 }, true)).toBe(true)
  })

  it('behält die lokale Zeile, wenn sie neuer ist', () => {
    expect(shouldApplyRemote({ updated_at: T2 }, { updated_at: T1 }, false)).toBe(false)
    expect(shouldApplyRemote({ updated_at: T2 }, { updated_at: T1 }, true)).toBe(false)
  })

  it('bei Gleichstand gewinnt eine noch nicht hochgeladene lokale Änderung', () => {
    expect(shouldApplyRemote({ updated_at: T1 }, { updated_at: T1 }, true)).toBe(false)
    expect(shouldApplyRemote({ updated_at: T1 }, { updated_at: T1 }, false)).toBe(true)
  })

  it('behandelt ungültige Zeitstempel wie sehr alte Stände', () => {
    expect(shouldApplyRemote({ updated_at: 'kaputt' }, { updated_at: T1 }, false)).toBe(true)
  })
})

describe('lastWriteWins', () => {
  it('wählt den jüngeren Stand, bei Gleichstand den ersten', () => {
    const a = { updated_at: T1, v: 'a' }
    const b = { updated_at: T2, v: 'b' }
    expect(lastWriteWins(a, b).v).toBe('b')
    expect(lastWriteWins(b, a).v).toBe('b')
    expect(lastWriteWins(a, { ...a, v: 'c' }).v).toBe('a')
  })
})

describe('maxServerTimestamp', () => {
  it('liefert den größten Zeitstempel oder den Ausgangswert', () => {
    expect(maxServerTimestamp([], T1)).toBe(T1)
    expect(maxServerTimestamp([{ server_updated_at: T2 }, { server_updated_at: T1 }, {}], T1)).toBe(T2)
    expect(maxServerTimestamp([{ server_updated_at: null }], T2)).toBe(T2)
  })
})
