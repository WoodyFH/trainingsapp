import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { saveExerciseLog } from '../data/sessions'
import { clearLocalData, db } from '../db/db'
import { setCurrentUserId } from '../db/repo'
import { ensureSeeded, seedExerciseId } from '../seed/seed'
import { applyImport, countImportedSessions, deleteImportedData, findAppSessionConflicts, loadImportContext } from './importWriter'
import { buildImportPlan } from './importMapping'
import type { ParseResult } from './importParser'

const USER = '00000000-0000-4000-8000-000000000001'

function parsed(days: { date: string; names: string[]; remark?: string }[]): ParseResult {
  return {
    groups: [],
    datedRows: days.length,
    emptyDateRows: 0,
    remarksFound: days.filter((d) => d.remark).length,
    warnings: [],
    days: days.map((d, i) => ({
      date: d.date,
      row: i + 3,
      remark: d.remark ?? null,
      entries: d.names.map((excelName) => ({ excelName, sets: 3, reps: 10, kg: 20, seconds: null, unreadable: [] })),
    })),
  }
}

const DAYS = [
  { date: '2026-11-16', names: ['Biz. Curls', 'Dips', 'Brust 2A', 'Rücken'], remark: 'gut' },
  { date: '2026-11-17', names: ['Bauch A4', 'Beine 2A', 'Gesäss 1'] },
]

beforeEach(async () => {
  await clearLocalData()
  setCurrentUserId(USER)
  await ensureSeeded(USER)
})

describe('Import schreiben', () => {
  it('findet die drei Trainings der App und das Körpergewicht', async () => {
    const ctx = await loadImportContext(USER)
    expect(Object.keys(ctx.templateIds).sort()).toEqual(['1', '2', '3'])
    expect(ctx.bodyweightKg).toBe(75)
  })

  it('schreibt Einheiten und Einträge mit source = import und merkt sie für den Upload vor', async () => {
    const ctx = await loadImportContext(USER)
    const plan = buildImportPlan(parsed(DAYS), ctx)
    const outboxBefore = await db.outbox.count()
    const result = await applyImport(plan, USER)

    expect(result).toMatchObject({ sessions: 2, logs: 7, restoredExercises: [] })
    const sessions = await db.sessions.toArray()
    expect(sessions.every((s) => s.source === 'import')).toBe(true)
    expect(sessions.find((s) => s.date === '2026-11-16')).toMatchObject({ kind: 'strength', note: 'gut' })
    expect(await db.exerciseLogs.count()).toBe(7)
    expect(await db.outbox.count()).toBe(outboxBefore + 2 + 7)
  })

  it('ist wiederholbar: ein zweiter Import erzeugt keine Dubletten', async () => {
    const ctx = await loadImportContext(USER)
    const plan = buildImportPlan(parsed(DAYS), ctx)
    await applyImport(plan, USER)
    await applyImport(plan, USER)
    expect(await db.sessions.count()).toBe(2)
    expect(await db.exerciseLogs.count()).toBe(7)
  })

  it('legt gelöschte Startübungen archiviert wieder an', async () => {
    const id = seedExerciseId(USER, 'bizepsmaschine')
    await db.exercises.update(id, { deleted_at: '2026-01-01T00:00:00.000Z' })
    const ctx = await loadImportContext(USER)
    const plan = buildImportPlan(parsed([{ date: '2024-01-10', names: ['Arme 1', 'Brust 2A', 'Rücken'] }]), ctx)
    const result = await applyImport(plan, USER)
    expect(result.restoredExercises).toEqual(['Bizepsmaschine'])
    expect(await db.exercises.get(id)).toMatchObject({ deleted_at: null, archived: true })
  })

  it('weist auf vorhandene App-Einheiten am selben Tag hin', async () => {
    const ex = await db.exercises.get(seedExerciseId(USER, 'biz_curls'))
    await saveExerciseLog({ kind: 'free', templateId: null, date: '2026-11-16' }, ex!, {
      sets: 3,
      reps: 10,
      weight_kg: 10,
      seconds: null,
      increase_next: false,
      note: null,
    })
    const plan = buildImportPlan(parsed(DAYS), await loadImportContext(USER))
    const warnings = await findAppSessionConflicts(plan)
    expect(warnings.map((w) => w.date)).toEqual(['2026-11-16'])
  })
})

describe('Import rückgängig machen', () => {
  it('löscht nur importierte Einheiten samt Einträgen und lässt eigene Einheiten unberührt', async () => {
    const ex = await db.exercises.get(seedExerciseId(USER, 'biz_curls'))
    const own = await saveExerciseLog({ kind: 'free', templateId: null, date: '2026-11-20' }, ex!, {
      sets: 3,
      reps: 10,
      weight_kg: 10,
      seconds: null,
      increase_next: false,
      note: null,
    })
    await applyImport(buildImportPlan(parsed(DAYS), await loadImportContext(USER)), USER)
    expect(await countImportedSessions()).toBe(2)

    const result = await deleteImportedData()
    expect(result).toEqual({ sessions: 2, logs: 7 })
    expect(await countImportedSessions()).toBe(0)

    const liveSessions = (await db.sessions.toArray()).filter((s) => !s.deleted_at)
    expect(liveSessions.map((s) => s.id)).toEqual([own.session_id])
    expect((await db.exerciseLogs.toArray()).filter((l) => !l.deleted_at).map((l) => l.id)).toEqual([own.id])
  })

  it('lässt sich wiederholen und nach dem Löschen erneut importieren', async () => {
    const plan = buildImportPlan(parsed(DAYS), await loadImportContext(USER))
    await applyImport(plan, USER)
    await deleteImportedData()
    expect(await deleteImportedData()).toEqual({ sessions: 0, logs: 0 })
    await applyImport(plan, USER)
    expect(await countImportedSessions()).toBe(2)
    expect((await db.exerciseLogs.toArray()).filter((l) => !l.deleted_at)).toHaveLength(7)
  })
})
