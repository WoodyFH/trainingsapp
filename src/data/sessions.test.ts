import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db } from '../db/db'
import { buildRow, saveRow, setCurrentUserId } from '../db/repo'
import type { GymExercise } from '../types/db'
import { loadLastLogs } from './queries'
import {
  deleteCardioLog,
  deleteSession,
  moveSessionDate,
  updateCardioLog,
  finishSession,
  getOrCreateSession,
  hasCardioValue,
  liveLogs,
  saveCardioLog,
  saveExerciseLog,
  undoExerciseLog,
  type LogInput,
  type SessionTarget,
} from './sessions'

const USER = '00000000-0000-4000-8000-000000000001'

async function makeExercise(name: string, sides: 1 | 2 = 1): Promise<GymExercise> {
  return saveRow(
    'exercises',
    buildRow('exercises', {
      name,
      short_name: null,
      load_type: 'weight',
      primary_muscles: ['biceps'],
      secondary_muscles: [],
      weight_step: 2,
      notes: null,
      sides,
      archived: false,
    }),
  )
}

const input = (over: Partial<LogInput> = {}): LogInput => ({
  sets: 3,
  reps: 10,
  weight_kg: 18,
  seconds: null,
  increase_next: false,
  note: null,
  ...over,
})

const target = (date: string, templateId: string | null = 't1'): SessionTarget => ({
  kind: templateId ? 'strength' : 'free',
  templateId,
  date,
})

beforeEach(async () => {
  await clearLocalData()
  setCurrentUserId(USER)
})

describe('Einheiten', () => {
  it('legt die Einheit erst beim ersten Eintrag an', async () => {
    const ex = await makeExercise('Curls')
    expect(await db.sessions.count()).toBe(0)
    await saveExerciseLog(target('2026-11-19'), ex, input())
    expect(await db.sessions.count()).toBe(1)
  })

  it('teilt sich bei gleichzeitigem Anlegen eine Einheit (Doppeltippen)', async () => {
    const [a, b] = await Promise.all([
      getOrCreateSession(target('2026-11-19')),
      getOrCreateSession(target('2026-11-19')),
    ])
    expect(a.id).toBe(b.id)
    expect(await db.sessions.count()).toBe(1)
  })

  it('trennt Einheiten nach Training und Tag', async () => {
    const a = await getOrCreateSession(target('2026-11-19', 't1'))
    const b = await getOrCreateSession(target('2026-11-19', 't2'))
    const c = await getOrCreateSession(target('2026-11-20', 't1'))
    expect(new Set([a.id, b.id, c.id]).size).toBe(3)
  })

  it('speichert pro Übung höchstens einen Eintrag und aktualisiert ihn bei Korrektur', async () => {
    const ex = await makeExercise('Curls', 2)
    await saveExerciseLog(target('2026-11-19'), ex, input({ weight_kg: 18 }))
    await saveExerciseLog(target('2026-11-19'), ex, input({ weight_kg: 20, increase_next: true }))
    const session = await getOrCreateSession(target('2026-11-19'))
    const logs = await liveLogs(session.id)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ weight_kg: 20, increase_next: true, sides: 2 })
  })

  it('übernimmt sides aus der Übung', async () => {
    const one = await makeExercise('Maschine', 1)
    const two = await makeExercise('Kurzhantel', 2)
    const l1 = await saveExerciseLog(target('2026-11-19'), one, input())
    const l2 = await saveExerciseLog(target('2026-11-19'), two, input())
    expect([l1.sides, l2.sides]).toEqual([1, 2])
    expect([l1.sort, l2.sort]).toEqual([0, 1])
  })

  it('entfernt eine unfertige Einheit, wenn der letzte Eintrag rückgängig gemacht wird', async () => {
    const ex = await makeExercise('Curls')
    const log = await saveExerciseLog(target('2026-11-19'), ex, input())
    await undoExerciseLog(log.id)
    const sessions = (await db.sessions.toArray()).filter((s) => !s.deleted_at)
    expect(sessions).toHaveLength(0)
    expect(await liveLogs(log.session_id)).toHaveLength(0)
  })

  it('behält eine beendete Einheit auch ohne Einträge', async () => {
    const ex = await makeExercise('Curls')
    const log = await saveExerciseLog(target('2026-11-19'), ex, input())
    await finishSession(log.session_id)
    await undoExerciseLog(log.id)
    expect((await db.sessions.get(log.session_id))?.deleted_at).toBeNull()
  })
})

describe('letzte Werte ("wie letztes Mal")', () => {
  it('liefert den jüngsten Eintrag vor dem Datum und ignoriert Zukunft und aktuelle Einheit', async () => {
    const ex = await makeExercise('Curls')
    await saveExerciseLog(target('2026-11-10'), ex, input({ weight_kg: 14 }))
    await saveExerciseLog(target('2026-11-15'), ex, input({ weight_kg: 16 }))
    const current = await saveExerciseLog(target('2026-11-19'), ex, input({ weight_kg: 18 }))
    await saveExerciseLog(target('2026-12-01'), ex, input({ weight_kg: 99 }))

    const last = await loadLastLogs([ex.id], '2026-11-19', current.session_id)
    expect(last.get(ex.id)?.log.weight_kg).toBe(16)
    expect(last.get(ex.id)?.date).toBe('2026-11-15')

    const none = await loadLastLogs([ex.id], '2026-11-01', undefined)
    expect(none.has(ex.id)).toBe(false)
  })

  it('überspringt gelöschte Einträge', async () => {
    const ex = await makeExercise('Curls')
    await saveExerciseLog(target('2026-11-10'), ex, input({ weight_kg: 14 }))
    const newer = await saveExerciseLog(target('2026-11-15'), ex, input({ weight_kg: 16 }))
    await undoExerciseLog(newer.id)
    const last = await loadLastLogs([ex.id], '2026-11-19', undefined)
    expect(last.get(ex.id)?.log.weight_kg).toBe(14)
  })
})

describe('Cardio', () => {
  const values = { duration_min: 30, kcal: null, avg_hr: null, distance: null, note: null }

  it('verlangt mindestens einen Wert', async () => {
    expect(hasCardioValue({ duration_min: null, kcal: null, avg_hr: null, distance: null, note: 'x' })).toBe(false)
    expect(hasCardioValue({ duration_min: 0, kcal: null, avg_hr: null, distance: null, note: null })).toBe(false)
    expect(hasCardioValue(values)).toBe(true)
    await expect(
      saveCardioLog('2026-11-19', 'type', { duration_min: null, kcal: null, avg_hr: null, distance: null, note: null }),
    ).rejects.toThrow()
  })

  it('erlaubt mehrere Einträge am Tag in einer Cardio-Einheit, auch neben Krafttraining', async () => {
    const ex = await makeExercise('Curls')
    await saveExerciseLog(target('2026-11-19'), ex, input())
    const a = await saveCardioLog('2026-11-19', 'run', values)
    const b = await saveCardioLog('2026-11-19', 'row', { ...values, duration_min: 15 })
    expect(a.session_id).toBe(b.session_id)
    const kinds = (await db.sessions.toArray()).map((s) => s.kind).sort()
    expect(kinds).toEqual(['cardio', 'strength'])
  })

  it('entfernt die Cardio-Einheit, wenn der letzte Eintrag gelöscht wird', async () => {
    const a = await saveCardioLog('2026-11-19', 'run', values)
    const b = await saveCardioLog('2026-11-19', 'row', values)
    await deleteCardioLog(a.id)
    expect((await db.sessions.get(a.session_id))?.deleted_at).toBeNull()
    await deleteCardioLog(b.id)
    expect((await db.sessions.get(a.session_id))?.deleted_at).not.toBeNull()
  })
})

describe('Verlauf bearbeiten', () => {
  it('löscht eine Einheit samt Einträgen', async () => {
    const ex = await makeExercise('Curls')
    const a = await saveExerciseLog(target('2026-11-19'), ex, input())
    await saveExerciseLog(target('2026-11-20'), ex, input())
    await deleteSession(a.session_id)

    expect((await db.sessions.get(a.session_id))?.deleted_at).not.toBeNull()
    expect((await db.exerciseLogs.get(a.id))?.deleted_at).not.toBeNull()
    expect((await db.sessions.toArray()).filter((s) => !s.deleted_at)).toHaveLength(1)
    await deleteSession(a.session_id) // wiederholbar
  })

  it('löscht eine Cardio-Einheit samt Einträgen', async () => {
    const values = { duration_min: 30, kcal: null, avg_hr: null, distance: null, note: null }
    const log = await saveCardioLog('2026-11-19', 'run', values)
    await deleteSession(log.session_id)
    expect((await db.cardioLogs.get(log.id))?.deleted_at).not.toBeNull()
  })

  it('verschiebt eine Einheit auf ein freies Datum und meldet einen Konflikt bei gleichartiger Einheit', async () => {
    const ex = await makeExercise('Curls')
    const a = await saveExerciseLog(target('2026-11-19'), ex, input())
    const b = await saveExerciseLog(target('2026-11-20'), ex, input())

    expect(await moveSessionDate(a.session_id, '2026-11-18')).toBe('ok')
    expect((await db.sessions.get(a.session_id))?.date).toBe('2026-11-18')

    expect(await moveSessionDate(a.session_id, '2026-11-20')).toBe('conflict')
    expect((await db.sessions.get(a.session_id))?.date).toBe('2026-11-18')
    expect((await db.sessions.get(b.session_id))?.date).toBe('2026-11-20')

    // anderes Training am selben Tag ist kein Konflikt
    const c = await saveExerciseLog(target('2026-11-21', 't2'), ex, input())
    expect(await moveSessionDate(c.session_id, '2026-11-20')).toBe('ok')
  })

  it('ändert Werte eines Cardio-Eintrags und verlangt weiterhin einen Wert', async () => {
    const values = { duration_min: 30, kcal: null, avg_hr: null, distance: null, note: null }
    const log = await saveCardioLog('2026-11-19', 'run', values)
    await updateCardioLog(log.id, { ...values, duration_min: 45, kcal: 400 })
    expect(await db.cardioLogs.get(log.id)).toMatchObject({ duration_min: 45, kcal: 400 })
    await expect(updateCardioLog(log.id, { ...values, duration_min: null })).rejects.toThrow()
  })
})
