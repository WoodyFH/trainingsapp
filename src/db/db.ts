import Dexie, { type EntityTable } from 'dexie'
import type {
  GymCardioLog,
  GymCardioType,
  GymExercise,
  GymExerciseLog,
  GymSession,
  GymSettings,
  GymTemplate,
  GymTemplateExercise,
  TableName,
} from '../types/db'

/** Eintrag der Outbox: "diese Zeile muss noch hochgeladen werden". Pro Zeile höchstens ein Eintrag. */
export interface OutboxEntry {
  /** `${table}:${pk}` */
  key: string
  table: TableName
  pk: string
  /** Zeitpunkt der letzten lokalen Änderung (ISO). */
  queuedAt: string
  attempts: number
  lastError: string | null
}

export interface MetaEntry {
  key: string
  value: unknown
}

export type AppDB = Dexie & {
  settings: EntityTable<GymSettings, 'user_id'>
  exercises: EntityTable<GymExercise, 'id'>
  templates: EntityTable<GymTemplate, 'id'>
  templateExercises: EntityTable<GymTemplateExercise, 'id'>
  cardioTypes: EntityTable<GymCardioType, 'id'>
  sessions: EntityTable<GymSession, 'id'>
  exerciseLogs: EntityTable<GymExerciseLog, 'id'>
  cardioLogs: EntityTable<GymCardioLog, 'id'>
  outbox: EntityTable<OutboxEntry, 'key'>
  meta: EntityTable<MetaEntry, 'key'>
}

export const db = new Dexie('trainingsapp') as AppDB

db.version(1).stores({
  settings: 'user_id',
  exercises: 'id, archived, deleted_at, name',
  templates: 'id, in_rotation, rotation_order, archived, deleted_at',
  templateExercises: 'id, template_id, exercise_id, deleted_at',
  cardioTypes: 'id, archived, deleted_at',
  sessions: 'id, date, kind, template_id, source, deleted_at, [kind+date]',
  exerciseLogs: 'id, session_id, exercise_id, deleted_at',
  cardioLogs: 'id, session_id, cardio_type_id, deleted_at',
  outbox: 'key, table, queuedAt',
  meta: 'key',
})

export const DATA_TABLES: readonly TableName[] = [
  'settings',
  'exercises',
  'templates',
  'templateExercises',
  'cardioTypes',
  'sessions',
  'exerciseLogs',
  'cardioLogs',
]

/** Löscht alle lokalen Daten, Outbox und Sync-Zustand (z. B. beim Wechsel des Kontos). */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.outbox, db.meta], async () => {
    for (const t of DATA_TABLES) await db.table(t).clear()
    await db.outbox.clear()
    await db.meta.clear()
  })
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
