import type { MuscleId } from './muscles'

/** Handgeschriebene Typen für die gym_-Tabellen (siehe supabase/migrations/001_gym_schema.sql). */

export type LoadType = 'weight' | 'assisted' | 'bodyweight' | 'time'
export type SessionKind = 'strength' | 'free' | 'cardio'
export type SessionSource = 'app' | 'import'
/** Einheit des Distanzfelds einer Cardio-Art. 'floors' = Etagen (Stairmaster). */
export type DistanceUnit = 'km' | 'm' | 'floors'
/** 1 = beidseitig bzw. ohne Seitenbezug, 2 = pro Hand, Bein oder Seite. */
export type Sides = 1 | 2

/** ISO-8601-Zeitstempel (UTC). */
export type Timestamp = string

interface SyncedRow {
  id: string
  user_id: string
  created_at: Timestamp
  updated_at: Timestamp
  /** Soft Delete: gesetzt = gelöscht. */
  deleted_at: Timestamp | null
  /** Vom Server vergebener Sync-Zeitstempel (nur lesend, wird nie zurückgeschrieben). */
  server_updated_at?: Timestamp | null
}

export interface GymSettings {
  user_id: string
  bodyweight_kg: number
  updated_at: Timestamp
  server_updated_at?: Timestamp | null
}

export interface GymExercise extends SyncedRow {
  name: string
  /** Gerätebezeichnung, z. B. "Beine 4C". */
  short_name: string | null
  load_type: LoadType
  primary_muscles: MuscleId[]
  secondary_muscles: MuscleId[]
  weight_step: number
  notes: string | null
  sides: Sides
  archived: boolean
}

export interface GymTemplate extends SyncedRow {
  name: string
  color: string
  icon: string
  in_rotation: boolean
  rotation_order: number | null
  sort: number
  archived: boolean
}

export interface GymTemplateExercise extends SyncedRow {
  template_id: string
  exercise_id: string
  sort: number
}

export interface GymSession extends SyncedRow {
  kind: SessionKind
  template_id: string | null
  /** Kalendertag im Format JJJJ-MM-TT. */
  date: string
  started_at: Timestamp | null
  finished_at: Timestamp | null
  note: string | null
  source: SessionSource
}

export interface GymExerciseLog extends SyncedRow {
  session_id: string
  exercise_id: string
  sets: number
  reps: number | null
  /** Bei 'assisted' das Gegengewicht, bei 'bodyweight' das Zusatzgewicht. */
  weight_kg: number | null
  seconds: number | null
  sides: Sides
  increase_next: boolean
  note: string | null
  sort: number
}

export interface GymCardioType extends SyncedRow {
  name: string
  icon: string
  distance_unit: DistanceUnit
  sort: number
  archived: boolean
}

export interface GymCardioLog extends SyncedRow {
  session_id: string
  cardio_type_id: string
  duration_min: number | null
  kcal: number | null
  avg_hr: number | null
  distance: number | null
  note: string | null
}

/** Lokale Tabellennamen (Dexie) und ihre Zeilentypen. */
export interface TableMap {
  settings: GymSettings
  exercises: GymExercise
  templates: GymTemplate
  templateExercises: GymTemplateExercise
  cardioTypes: GymCardioType
  sessions: GymSession
  exerciseLogs: GymExerciseLog
  cardioLogs: GymCardioLog
}

export type TableName = keyof TableMap
