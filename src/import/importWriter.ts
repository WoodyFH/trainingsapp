import { db } from '../db/db'
import { saveRows } from '../db/repo'
import { seedTemplateId, seedExerciseId, buildSeed } from '../seed/seed'
import { DEFAULT_BODYWEIGHT_KG } from '../seed/seedData'
import type { GymExerciseLog, GymSession } from '../types/db'
import { formatDate } from '../lib/date'
import type { ImportContext, ImportPlan, TrainingNumber } from './importMapping'
import type { ImportWarning } from './importParser'

/** Schreibt einen Import-Plan in die lokale Datenbank (und damit in die Outbox) und macht ihn rückgängig. */

const CHUNK = 500

/** Kontext für den Import: IDs der drei Rotations-Trainings (falls vorhanden) und das Körpergewicht. */
export async function loadImportContext(userId: string): Promise<ImportContext> {
  const templateIds: ImportContext['templateIds'] = {}
  const keys: [TrainingNumber, string][] = [
    [1, 'training1'],
    [2, 'training2'],
    [3, 'training3'],
  ]
  for (const [n, key] of keys) {
    const t = await db.templates.get(seedTemplateId(userId, key))
    if (t && !t.deleted_at) templateIds[n] = t.id
  }
  const settings = await db.settings.get(userId)
  return { userId, templateIds, bodyweightKg: settings?.bodyweight_kg ?? DEFAULT_BODYWEIGHT_KG }
}

/** Hinweise zu bereits in der App erfassten Einheiten an Tagen, die der Import ebenfalls enthält. */
export async function findAppSessionConflicts(plan: ImportPlan): Promise<ImportWarning[]> {
  const appSessions = (await db.sessions.where('source').equals('app').toArray()).filter(
    (s) => !s.deleted_at && (s.kind === 'strength' || s.kind === 'free'),
  )
  const appDates = new Set(appSessions.map((s) => s.date))
  return plan.sessions
    .filter((s) => appDates.has(s.date))
    .map((s) => ({
      code: 'existing-app-session' as const,
      date: s.date,
      message: `${formatDate(s.date)}: In der App gibt es an diesem Tag schon eine Einheit. Die importierte kommt zusätzlich dazu.`,
    }))
}

/** Stellt fehlende oder gelöschte Startübungen wieder her, die der Import braucht. Gibt deren Namen zurück. */
async function ensureExercises(plan: ImportPlan, userId: string): Promise<string[]> {
  const seed = buildSeed(userId, new Date().toISOString())
  const restored: string[] = []
  const toSave = []
  for (const key of plan.exerciseKeys) {
    const id = seedExerciseId(userId, key)
    const existing = await db.exercises.get(id)
    if (existing && !existing.deleted_at) continue
    const template = seed.exercises.find((e) => e.id === id)
    if (!template) continue
    toSave.push({ ...(existing ?? template), deleted_at: null })
    restored.push(template.name)
  }
  await saveRows('exercises', toSave)
  return restored
}

export interface ImportProgress {
  phase: 'exercises' | 'sessions' | 'logs'
  done: number
  total: number
}

export interface ImportResult {
  sessions: number
  logs: number
  restoredExercises: string[]
}

async function saveInChunks<T extends GymSession | GymExerciseLog>(
  table: 'sessions' | 'exerciseLogs',
  rows: T[],
  onChunk: (done: number) => void,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await saveRows(table, rows.slice(i, i + CHUNK) as never)
    onChunk(Math.min(i + CHUNK, rows.length))
  }
}

export async function applyImport(
  plan: ImportPlan,
  userId: string,
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  onProgress?.({ phase: 'exercises', done: 0, total: plan.exerciseKeys.length })
  const restoredExercises = await ensureExercises(plan, userId)

  await saveInChunks('sessions', plan.sessions, (done) =>
    onProgress?.({ phase: 'sessions', done, total: plan.sessions.length }),
  )
  await saveInChunks('exerciseLogs', plan.logs, (done) =>
    onProgress?.({ phase: 'logs', done, total: plan.logs.length }),
  )
  return { sessions: plan.sessions.length, logs: plan.logs.length, restoredExercises }
}

/** Anzahl der noch vorhandenen importierten Einheiten. */
export async function countImportedSessions(): Promise<number> {
  return (await db.sessions.where('source').equals('import').toArray()).filter((s) => !s.deleted_at).length
}

/** "Alle importierten Daten löschen": Einheiten mit source = import samt Einträgen (Soft Delete, wird synchronisiert). */
export async function deleteImportedData(): Promise<{ sessions: number; logs: number }> {
  const sessions = (await db.sessions.where('source').equals('import').toArray()).filter((s) => !s.deleted_at)
  const ts = new Date().toISOString()
  const ids = sessions.map((s) => s.id)

  const logs: GymExerciseLog[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = await db.exerciseLogs
      .where('session_id')
      .anyOf(ids.slice(i, i + CHUNK))
      .toArray()
    logs.push(...part.filter((l) => !l.deleted_at))
  }

  for (let i = 0; i < logs.length; i += CHUNK) {
    await saveRows(
      'exerciseLogs',
      logs.slice(i, i + CHUNK).map((l) => ({ ...l, deleted_at: ts })),
    )
  }
  for (let i = 0; i < sessions.length; i += CHUNK) {
    await saveRows(
      'sessions',
      sessions.slice(i, i + CHUNK).map((s) => ({ ...s, deleted_at: ts })),
    )
  }
  return { sessions: sessions.length, logs: logs.length }
}
