import type { TableName } from '../types/db'

export interface SyncTableConfig {
  local: TableName
  remote: string
  /** Primärschlüssel (bei gym_settings die user_id). */
  pk: 'id' | 'user_id'
}

/**
 * Alle synchronisierten Tabellen. Die Reihenfolge ist die Abhängigkeitsreihenfolge
 * (Eltern vor Kindern), damit Fremdschlüssel beim Hochladen erfüllt sind.
 */
export const SYNC_TABLES: readonly SyncTableConfig[] = [
  { local: 'settings', remote: 'gym_settings', pk: 'user_id' },
  { local: 'exercises', remote: 'gym_exercises', pk: 'id' },
  { local: 'templates', remote: 'gym_templates', pk: 'id' },
  { local: 'templateExercises', remote: 'gym_template_exercises', pk: 'id' },
  { local: 'cardioTypes', remote: 'gym_cardio_types', pk: 'id' },
  { local: 'sessions', remote: 'gym_sessions', pk: 'id' },
  { local: 'exerciseLogs', remote: 'gym_exercise_logs', pk: 'id' },
  { local: 'cardioLogs', remote: 'gym_cardio_logs', pk: 'id' },
]

export function tableConfig(local: TableName): SyncTableConfig {
  const cfg = SYNC_TABLES.find((t) => t.local === local)
  if (!cfg) throw new Error(`Unbekannte Tabelle: ${local}`)
  return cfg
}
