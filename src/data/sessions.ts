import { db } from '../db/db'
import { buildRow, nowIso, saveRow, softDeleteRow } from '../db/repo'
import type {
  DistanceUnit,
  GymCardioLog,
  GymCardioType,
  GymExercise,
  GymExerciseLog,
  GymSession,
  SessionKind,
} from '../types/db'

/** Schreib- und Leselogik für Einheiten, Übungseinträge und Cardio. Alles lokal zuerst (Outbox). */

export interface SessionTarget {
  kind: Extract<SessionKind, 'strength' | 'free'>
  /** null bei Freitraining. */
  templateId: string | null
  /** JJJJ-MM-TT */
  date: string
}

export async function findSession(
  kind: SessionKind,
  date: string,
  templateId: string | null,
): Promise<GymSession | undefined> {
  const rows = await db.sessions.where('[kind+date]').equals([kind, date]).toArray()
  return rows.find((s) => !s.deleted_at && s.template_id === templateId)
}

const pendingCreates = new Map<string, Promise<GymSession>>()

/** Findet die Einheit oder legt sie an. Gleichzeitige Aufrufe teilen sich eine Anlage (kein Doppeltippen-Duplikat). */
export function getOrCreateSession(target: SessionTarget): Promise<GymSession> {
  const key = `${target.kind}|${target.date}|${target.templateId ?? ''}`
  const running = pendingCreates.get(key)
  if (running) return running

  const promise = (async () => {
    const existing = await findSession(target.kind, target.date, target.templateId)
    if (existing) return existing
    const ts = nowIso()
    const row = buildRow('sessions', {
      kind: target.kind,
      template_id: target.templateId,
      date: target.date,
      started_at: ts,
      finished_at: null,
      note: null,
      source: 'app',
    })
    return saveRow('sessions', row)
  })().finally(() => {
    pendingCreates.delete(key)
  })
  pendingCreates.set(key, promise)
  return promise
}

export async function setSessionDate(sessionId: string, date: string): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session || session.deleted_at || session.date === date) return
  await saveRow('sessions', { ...session, date })
}

export async function setSessionNote(sessionId: string, note: string | null): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session || session.deleted_at) return
  await saveRow('sessions', { ...session, note: note?.trim() ? note.trim() : null })
}

export async function finishSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session || session.deleted_at) return
  await saveRow('sessions', { ...session, finished_at: nowIso() })
}

/** Einträge einer Einheit, die nicht gelöscht sind. */
export async function liveLogs(sessionId: string): Promise<GymExerciseLog[]> {
  const rows = await db.exerciseLogs.where('session_id').equals(sessionId).toArray()
  return rows.filter((l) => !l.deleted_at).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))
}

export interface LogInput {
  sets: number
  reps: number | null
  weight_kg: number | null
  seconds: number | null
  increase_next: boolean
  note: string | null
}

/**
 * Speichert den Eintrag einer Übung (pro Übung und Einheit höchstens einer). Legt die Einheit beim
 * ersten Eintrag an. `sides` wird aus der Übung übernommen, damit die Historie später abweichen kann.
 */
export async function saveExerciseLog(
  target: SessionTarget,
  exercise: GymExercise,
  input: LogInput,
): Promise<GymExerciseLog> {
  const session = await getOrCreateSession(target)
  const existing = (await liveLogs(session.id)).find((l) => l.exercise_id === exercise.id)
  if (existing) {
    return saveRow('exerciseLogs', { ...existing, ...input, sides: exercise.sides })
  }
  const count = (await liveLogs(session.id)).length
  const row = buildRow('exerciseLogs', {
    session_id: session.id,
    exercise_id: exercise.id,
    ...input,
    sides: exercise.sides,
    sort: count,
  })
  return saveRow('exerciseLogs', row)
}

/** Macht einen Eintrag rückgängig. Bleibt eine unfertige Einheit ohne Einträge, wird sie wieder entfernt. */
export async function undoExerciseLog(logId: string): Promise<void> {
  const log = await db.exerciseLogs.get(logId)
  if (!log || log.deleted_at) return
  await softDeleteRow('exerciseLogs', logId)
  const remaining = await liveLogs(log.session_id)
  if (remaining.length === 0) {
    const session = await db.sessions.get(log.session_id)
    if (session && !session.finished_at && !session.deleted_at) await softDeleteRow('sessions', session.id)
  }
}

// ---------------------------------------------------------------------------
// Cardio
// ---------------------------------------------------------------------------

export async function getOrCreateCardioSession(date: string): Promise<GymSession> {
  const existing = await findSession('cardio', date, null)
  if (existing) return existing
  const ts = nowIso()
  const row = buildRow('sessions', {
    kind: 'cardio',
    template_id: null,
    date,
    started_at: ts,
    finished_at: ts,
    note: null,
    source: 'app',
  })
  return saveRow('sessions', row)
}

export interface CardioInput {
  duration_min: number | null
  kcal: number | null
  avg_hr: number | null
  distance: number | null
  note: string | null
}

export function hasCardioValue(input: CardioInput): boolean {
  return [input.duration_min, input.kcal, input.avg_hr, input.distance].some((v) => v !== null && v > 0)
}

export async function saveCardioLog(date: string, cardioTypeId: string, input: CardioInput): Promise<GymCardioLog> {
  if (!hasCardioValue(input)) throw new Error('Mindestens ein Wert muss ausgefüllt sein.')
  const session = await getOrCreateCardioSession(date)
  const row = buildRow('cardioLogs', { session_id: session.id, cardio_type_id: cardioTypeId, ...input })
  return saveRow('cardioLogs', row)
}

export async function deleteCardioLog(logId: string): Promise<void> {
  const log = await db.cardioLogs.get(logId)
  if (!log || log.deleted_at) return
  await softDeleteRow('cardioLogs', logId)
  const rest = (await db.cardioLogs.where('session_id').equals(log.session_id).toArray()).filter((l) => !l.deleted_at)
  if (rest.length === 0) await softDeleteRow('sessions', log.session_id)
}

export async function createCardioType(input: {
  name: string
  icon: string
  distance_unit: DistanceUnit
}): Promise<GymCardioType> {
  const all = await db.cardioTypes.toArray()
  const sort = all.reduce((max, t) => Math.max(max, t.sort), -1) + 1
  const row = buildRow('cardioTypes', { ...input, name: input.name.trim(), sort, archived: false })
  return saveRow('cardioTypes', row)
}

// ---------------------------------------------------------------------------
// Verlauf bearbeiten (Statistik)
// ---------------------------------------------------------------------------

/** Löscht eine Einheit samt Einträgen (Soft Delete, wird synchronisiert). */
export async function deleteSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session || session.deleted_at) return
  const logs = (await db.exerciseLogs.where('session_id').equals(sessionId).toArray()).filter((l) => !l.deleted_at)
  const cardio = (await db.cardioLogs.where('session_id').equals(sessionId).toArray()).filter((l) => !l.deleted_at)
  for (const l of logs) await softDeleteRow('exerciseLogs', l.id)
  for (const l of cardio) await softDeleteRow('cardioLogs', l.id)
  await softDeleteRow('sessions', sessionId)
}

/**
 * Verschiebt eine Einheit auf ein anderes Datum. Gibt es dort schon eine gleichartige Einheit
 * (gleiche Art und gleiches Training), bleibt alles unverändert und das Ergebnis ist "conflict".
 */
export async function moveSessionDate(sessionId: string, date: string): Promise<'ok' | 'conflict'> {
  const session = await db.sessions.get(sessionId)
  if (!session || session.deleted_at) return 'ok'
  if (session.date === date) return 'ok'
  const other = await findSession(session.kind, date, session.template_id)
  if (other && other.id !== sessionId) return 'conflict'
  await saveRow('sessions', { ...session, date })
  return 'ok'
}

export async function updateCardioLog(logId: string, input: CardioInput): Promise<void> {
  if (!hasCardioValue(input)) throw new Error('Mindestens ein Wert muss ausgefüllt sein.')
  const log = await db.cardioLogs.get(logId)
  if (!log || log.deleted_at) return
  await saveRow('cardioLogs', { ...log, ...input })
}
