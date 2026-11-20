import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db, getMeta } from '../db/db'
import { buildRow, saveRow, saveRows, setCurrentUserId, softDeleteRow } from '../db/repo'
import type { GymExercise, GymSession } from '../types/db'
import { PULL_PAGE, isNetworkError, pullChanges, pushChanges, runSync, type SyncClient } from './engine'
import { syncStatus } from './status'

const USER = '00000000-0000-4000-8000-000000000001'

/** Server-Attrappe: bildet das Verhalten des gym_before_write-Triggers nach (LWW + server_updated_at). */
function fakeServer() {
  const tables = new Map<string, Map<string, Record<string, unknown>>>()
  const calls: { table: string; ids: string[] }[] = []
  let clock = 0
  let failNext: string | null = null
  const nextStamp = () => new Date(Date.UTC(2026, 10, 19, 12, 0, 0) + ++clock * 1000).toISOString()

  const client: SyncClient = {
    async upsert(remote, rows, onConflict) {
      if (failNext) {
        const message = failNext
        failNext = null
        return { error: { message } }
      }
      const table = tables.get(remote) ?? new Map()
      tables.set(remote, table)
      calls.push({ table: remote, ids: rows.map((r) => String(r[onConflict])) })
      for (const row of rows) {
        const key = String(row[onConflict])
        const existing = table.get(key)
        if (existing && Date.parse(String(row.updated_at)) < Date.parse(String(existing.updated_at))) continue
        table.set(key, { ...row, server_updated_at: nextStamp() })
      }
      return { error: null }
    },
    async fetchSince(remote, since, limit) {
      const table = tables.get(remote) ?? new Map()
      const rows = [...table.values()]
        .filter((r) => Date.parse(String(r.server_updated_at)) >= Date.parse(since))
        .sort((a, b) => Date.parse(String(a.server_updated_at)) - Date.parse(String(b.server_updated_at)))
        .slice(0, limit)
      return { data: rows, error: null }
    },
  }
  return {
    client,
    tables,
    calls,
    failNextUpsert: (message: string) => {
      failNext = message
    },
    /** Schreibt direkt auf dem Server (z. B. von einem anderen Gerät). */
    putRemote(remote: string, row: Record<string, unknown>) {
      const table = tables.get(remote) ?? new Map()
      tables.set(remote, table)
      table.set(String(row.id ?? row.user_id), { ...row, server_updated_at: nextStamp() })
    },
  }
}

const exerciseData = (name: string) => ({
  name,
  short_name: null,
  load_type: 'weight' as const,
  primary_muscles: ['chest' as const],
  secondary_muscles: [],
  weight_step: 5,
  notes: null,
  sides: 1 as const,
  archived: false,
})

beforeEach(async () => {
  await clearLocalData()
  setCurrentUserId(USER)
  syncStatus.set({ phase: 'idle', error: null, lastSyncAt: null, initialPullDone: false })
})

describe('Outbox', () => {
  it('legt pro Zeile höchstens einen Eintrag an (Zusammenfassen)', async () => {
    const row = buildRow('exercises', exerciseData('Bankdrücken'))
    await saveRow('exercises', row)
    await saveRow('exercises', { ...row, name: 'Bankdrücken Langhantel' })
    const entries = await db.outbox.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.key).toBe(`exercises:${row.id}`)
  })

  it('setzt beim Soft Delete deleted_at und merkt die Zeile für den Upload vor', async () => {
    const row = buildRow('exercises', exerciseData('Alt'))
    await saveRow('exercises', row)
    await db.outbox.clear()
    await softDeleteRow('exercises', row.id)
    const stored = await db.exercises.get(row.id)
    expect(stored?.deleted_at).not.toBeNull()
    expect(await db.outbox.count()).toBe(1)
  })
})

describe('pushChanges', () => {
  it('lädt die jeweils letzte Fassung hoch und leert die Outbox', async () => {
    const server = fakeServer()
    const row = buildRow('exercises', exerciseData('A'))
    await saveRow('exercises', row)
    await saveRow('exercises', { ...row, name: 'B' })

    const pushed = await pushChanges(server.client)
    expect(pushed).toBe(1)
    expect(server.tables.get('gym_exercises')?.get(row.id)?.name).toBe('B')
    expect(await db.outbox.count()).toBe(0)
  })

  it('lädt Eltern-Tabellen vor Kind-Tabellen hoch (Fremdschlüssel)', async () => {
    const server = fakeServer()
    const exercise = buildRow('exercises', exerciseData('Übung'))
    const session = buildRow('sessions', {
      kind: 'strength',
      template_id: null,
      date: '2026-11-19',
      started_at: null,
      finished_at: null,
      note: null,
      source: 'app',
    } satisfies Omit<GymSession, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'server_updated_at'>)
    const log = buildRow('exerciseLogs', {
      session_id: session.id,
      exercise_id: exercise.id,
      sets: 3,
      reps: 10,
      weight_kg: 50,
      seconds: null,
      sides: 1,
      increase_next: false,
      note: null,
      sort: 0,
    })
    // absichtlich in "falscher" Reihenfolge gespeichert
    await saveRow('exerciseLogs', log)
    await saveRow('sessions', session)
    await saveRow('exercises', exercise)

    await pushChanges(server.client)
    expect(server.calls.map((c) => c.table)).toEqual(['gym_exercises', 'gym_sessions', 'gym_exercise_logs'])
  })

  it('behält die Outbox bei einem Serverfehler und zählt den Versuch', async () => {
    const server = fakeServer()
    const row = buildRow('exercises', exerciseData('X'))
    await saveRow('exercises', row)
    server.failNextUpsert('violates foreign key constraint')

    await expect(pushChanges(server.client)).rejects.toThrow('foreign key')
    const entry = await db.outbox.get(`exercises:${row.id}`)
    expect(entry?.attempts).toBe(1)
    expect(entry?.lastError).toContain('foreign key')

    // Beim nächsten Versuch klappt es.
    await pushChanges(server.client)
    expect(await db.outbox.count()).toBe(0)
  })

  it('schickt große Mengen in mehreren Paketen', async () => {
    const server = fakeServer()
    const rows = Array.from({ length: 450 }, (_, i) => buildRow('exercises', exerciseData(`Übung ${i}`)))
    await saveRows('exercises', rows)
    await pushChanges(server.client)
    expect(server.calls.length).toBe(3)
    expect(server.tables.get('gym_exercises')?.size).toBe(450)
  })

  it('schickt server_updated_at nicht zurück', async () => {
    const server = fakeServer()
    const row = buildRow('exercises', exerciseData('S'))
    await saveRow('exercises', { ...row, server_updated_at: '2026-01-01T00:00:00.000Z' })
    let sent: Record<string, unknown> | undefined
    const spy: SyncClient = {
      ...server.client,
      async upsert(remote, rows, onConflict) {
        sent = rows[0]
        return server.client.upsert(remote, rows, onConflict)
      },
    }
    await pushChanges(spy)
    expect(sent && 'server_updated_at' in sent).toBe(false)
  })
})

describe('pullChanges', () => {
  it('übernimmt neue Zeilen und merkt sich den Stand je Tabelle', async () => {
    const server = fakeServer()
    server.putRemote('gym_exercises', {
      ...buildRow('exercises', exerciseData('Vom Server')),
      id: 'ex-remote-1',
    })
    const applied = await pullChanges(server.client)
    expect(applied).toBe(1)
    expect((await db.exercises.get('ex-remote-1'))?.name).toBe('Vom Server')
    expect(await getMeta<string>('cursor:gym_exercises')).toBeTruthy()

    // Zweiter Lauf holt nichts Neues, wendet die Zeile aber idempotent erneut an.
    expect(await pullChanges(server.client)).toBeLessThanOrEqual(1)
  })

  it('überschreibt eine neuere lokale Änderung nicht (letzte Änderung gewinnt)', async () => {
    const server = fakeServer()
    const local = await saveRow('exercises', { ...buildRow('exercises', exerciseData('Lokal neuer')), id: 'ex-1' })
    server.putRemote('gym_exercises', {
      ...local,
      name: 'Server älter',
      updated_at: new Date(Date.parse(local.updated_at) - 60_000).toISOString(),
    })
    await pullChanges(server.client)
    expect((await db.exercises.get('ex-1'))?.name).toBe('Lokal neuer')
  })

  it('übernimmt einen neueren Server-Stand und den Soft Delete', async () => {
    const server = fakeServer()
    const local = await saveRow('exercises', { ...buildRow('exercises', exerciseData('Lokal')), id: 'ex-2' })
    const later = new Date(Date.parse(local.updated_at) + 60_000).toISOString()
    server.putRemote('gym_exercises', { ...local, name: 'Server neuer', updated_at: later, deleted_at: later })
    await pullChanges(server.client)
    const stored = await db.exercises.get('ex-2')
    expect(stored?.name).toBe('Server neuer')
    expect(stored?.deleted_at).toBe(later)
  })

  it('holt mehr als eine Seite vollständig', async () => {
    const server = fakeServer()
    const total = PULL_PAGE + 50
    for (let i = 0; i < total; i++) {
      server.putRemote('gym_exercises', { ...buildRow('exercises', exerciseData(`E${i}`)), id: `bulk-${i}` })
    }
    await pullChanges(server.client)
    expect(await db.exercises.count()).toBe(total)
  })
})

describe('runSync', () => {
  it('gleicht zwei Geräte über den Server ab', async () => {
    const server = fakeServer()
    const row = buildRow('exercises', exerciseData('Gerät A'))
    await saveRow('exercises', row)

    const result = await runSync(server.client, USER)
    expect(result).toMatchObject({ ok: true, pushed: 1 })
    expect(await getMeta<string>('initialPullUser')).toBe(USER)
    expect(syncStatus.get().initialPullDone).toBe(true)

    // "Gerät B": leere lokale Datenbank
    await clearLocalData()
    await runSync(server.client, USER)
    expect((await db.exercises.get(row.id) as GymExercise).name).toBe('Gerät A')
  })

  it('meldet Netzwerkfehler als offline und andere Fehler als Fehler', async () => {
    const server = fakeServer()
    await saveRow('exercises', buildRow('exercises', exerciseData('N')))
    server.failNextUpsert('TypeError: Failed to fetch')
    const offline = await runSync(server.client, USER)
    expect(offline.offline).toBe(true)
    expect(syncStatus.get().phase).toBe('offline')

    server.failNextUpsert('permission denied')
    const failed = await runSync(server.client, USER)
    expect(failed.ok).toBe(false)
    expect(failed.offline).toBe(false)
    expect(syncStatus.get().phase).toBe('error')
    expect(syncStatus.get().error).toContain('permission denied')
  })
})

describe('isNetworkError', () => {
  it('erkennt typische Browser-Meldungen', () => {
    expect(isNetworkError('TypeError: Failed to fetch')).toBe(true)
    expect(isNetworkError('NetworkError when attempting to fetch resource.')).toBe(true)
    expect(isNetworkError('Load failed')).toBe(true)
    expect(isNetworkError('duplicate key value violates unique constraint')).toBe(false)
  })
})
