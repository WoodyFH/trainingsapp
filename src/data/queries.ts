import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { DEFAULT_BODYWEIGHT_KG } from '../seed/seedData'
import { lastRotationSession, nextTemplateId, sortRotation } from '../lib/rotation'
import type {
  GymCardioLog,
  GymCardioType,
  GymExercise,
  GymExerciseLog,
  GymSession,
  GymTemplate,
} from '../types/db'
import { findSession, liveLogs } from './sessions'

/** Reaktive Abfragen (Dexie liveQuery). `undefined` heißt "lädt noch", `null` heißt "gibt es nicht". */

export function useBodyweight(userId: string | null): number {
  return (
    useLiveQuery(async () => (userId ? (await db.settings.get(userId))?.bodyweight_kg : undefined), [userId]) ??
    DEFAULT_BODYWEIGHT_KG
  )
}

export function useRotationTemplates(): GymTemplate[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.templates.toArray()
    return sortRotation(all.filter((t) => !t.deleted_at && !t.archived && t.in_rotation))
  }, [])
}

export function useTemplate(id: string | undefined): GymTemplate | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null
    const t = await db.templates.get(id)
    return t && !t.deleted_at ? t : null
  }, [id])
}

/** Alle nicht gelöschten Übungen (aktive zuerst nach Name, archivierte nur auf Wunsch). */
export function useExercises(includeArchived = false): GymExercise[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.exercises.toArray()
    return all
      .filter((e) => !e.deleted_at && (includeArchived || !e.archived))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [includeArchived])
}

/** Übungen eines Trainings in der Reihenfolge des Plans. */
export function useTemplateExercises(templateId: string | undefined): GymExercise[] | undefined {
  return useLiveQuery(async () => {
    if (!templateId) return []
    const links = (await db.templateExercises.where('template_id').equals(templateId).toArray())
      .filter((l) => !l.deleted_at)
      .sort((a, b) => a.sort - b.sort)
    const exercises = await db.exercises.bulkGet(links.map((l) => l.exercise_id))
    return exercises.filter((e): e is GymExercise => !!e && !e.deleted_at && !e.archived)
  }, [templateId])
}

export function useSession(
  kind: 'strength' | 'free',
  date: string,
  templateId: string | null,
): GymSession | null | undefined {
  return useLiveQuery(async () => (await findSession(kind, date, templateId)) ?? null, [kind, date, templateId])
}

export function useSessionLogs(sessionId: string | undefined): GymExerciseLog[] | undefined {
  return useLiveQuery(async () => (sessionId ? liveLogs(sessionId) : []), [sessionId])
}

export interface LastLog {
  log: GymExerciseLog
  date: string
}

/**
 * Jeweils der letzte Eintrag jeder Übung vor bzw. an diesem Datum (ohne die aktuelle Einheit).
 * Das sind die Werte für "wie letztes Mal".
 */
export async function loadLastLogs(
  exerciseIds: readonly string[],
  date: string,
  excludeSessionId: string | undefined,
): Promise<Map<string, LastLog>> {
  const result = new Map<string, LastLog>()
  for (const exerciseId of exerciseIds) {
    const logs = (await db.exerciseLogs.where('exercise_id').equals(exerciseId).toArray()).filter(
      (l) => !l.deleted_at && l.session_id !== excludeSessionId,
    )
    if (logs.length === 0) continue
    const sessions = await db.sessions.bulkGet([...new Set(logs.map((l) => l.session_id))])
    const dateById = new Map<string, string>()
    for (const s of sessions) if (s && !s.deleted_at) dateById.set(s.id, s.date)

    let best: LastLog | null = null
    for (const log of logs) {
      const d = dateById.get(log.session_id)
      if (!d || d > date) continue
      if (!best || d > best.date || (d === best.date && log.created_at > best.log.created_at)) best = { log, date: d }
    }
    if (best) result.set(exerciseId, best)
  }
  return result
}

export function useLastLogs(
  exerciseIds: readonly string[],
  date: string,
  excludeSessionId: string | undefined,
): Map<string, LastLog> | undefined {
  const key = exerciseIds.join(',')
  return useLiveQuery(() => loadLastLogs(exerciseIds, date, excludeSessionId), [key, date, excludeSessionId])
}

export interface OpenSession {
  session: GymSession
  template: GymTemplate | null
  logCount: number
}

/** Heute begonnene, noch nicht beendete Krafteinheit (für das Banner "Training fortsetzen"). */
export function useOpenSessionToday(today: string): OpenSession | null | undefined {
  return useLiveQuery(async () => {
    const sessions = (await db.sessions.where('date').equals(today).toArray()).filter(
      (s) => !s.deleted_at && !s.finished_at && (s.kind === 'strength' || s.kind === 'free'),
    )
    for (const session of sessions.sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      const logCount = (await liveLogs(session.id)).length
      if (logCount === 0) continue
      const template = session.template_id ? ((await db.templates.get(session.template_id)) ?? null) : null
      return { session, template, logCount }
    }
    return null
  }, [today])
}

export interface RotationInfo {
  templates: GymTemplate[]
  nextId: string | null
  /** Datum der letzten Einheit je Training (JJJJ-MM-TT). */
  lastDate: Map<string, string>
}

export function useRotationInfo(): RotationInfo | undefined {
  return useLiveQuery(async () => {
    const templates = sortRotation(
      (await db.templates.toArray()).filter((t) => !t.deleted_at && !t.archived && t.in_rotation),
    )
    const ids = new Set(templates.map((t) => t.id))
    const sessions = (await db.sessions.where('kind').equals('strength').toArray()).filter(
      (s) => !s.deleted_at && s.template_id && ids.has(s.template_id),
    )
    // Nur Einheiten mit mindestens einem Eintrag zählen als absolviert.
    const done: GymSession[] = []
    for (const s of sessions) {
      if ((await liveLogs(s.id)).length > 0) done.push(s)
    }
    const lastDate = new Map<string, string>()
    for (const s of done) {
      if (!s.template_id) continue
      const prev = lastDate.get(s.template_id)
      if (!prev || s.date > prev) lastDate.set(s.template_id, s.date)
    }
    const last = lastRotationSession(done, ids)
    return { templates, nextId: nextTemplateId(templates, last?.template_id ?? null), lastDate }
  }, [])
}

export interface DayActivity {
  date: string
  /** Farbe der Einheit dieses Tages (Krafttraining: Farbe des Trainings, Frei, Cardio). */
  kinds: ('strength' | 'free' | 'cardio')[]
  templateColor: string | null
}

export interface WeekData {
  activity: Map<string, DayActivity>
  /** Gewichtete Sätze je Muskel seit `sinceDate` (primär 1, sekundär 0,5). */
  muscleSets: Partial<Record<string, number>>
}

/** Aktivität der letzten Wochen (Heatmap) und Muskelbelastung seit einem Stichtag. */
export function useActivity(fromDate: string, sinceDate: string): WeekData | undefined {
  return useLiveQuery(async () => {
    const sessions = (await db.sessions.where('date').aboveOrEqual(fromDate).toArray()).filter((s) => !s.deleted_at)
    const templates = new Map((await db.templates.toArray()).map((t) => [t.id, t]))
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))

    const activity = new Map<string, DayActivity>()
    const muscleSets: Partial<Record<string, number>> = {}

    for (const s of sessions) {
      let hasContent = false
      if (s.kind === 'cardio') {
        const logs = (await db.cardioLogs.where('session_id').equals(s.id).toArray()).filter((l) => !l.deleted_at)
        hasContent = logs.length > 0
      } else {
        const logs = await liveLogs(s.id)
        hasContent = logs.length > 0
        if (s.date >= sinceDate) {
          for (const log of logs) {
            const ex = exercises.get(log.exercise_id)
            if (!ex) continue
            for (const m of ex.primary_muscles) muscleSets[m] = (muscleSets[m] ?? 0) + log.sets
            for (const m of ex.secondary_muscles) {
              if (ex.primary_muscles.includes(m)) continue
              muscleSets[m] = (muscleSets[m] ?? 0) + log.sets * 0.5
            }
          }
        }
      }
      if (!hasContent) continue
      const day = activity.get(s.date) ?? { date: s.date, kinds: [], templateColor: null }
      day.kinds.push(s.kind)
      if (s.kind === 'strength' && s.template_id && !day.templateColor) {
        day.templateColor = templates.get(s.template_id)?.color ?? null
      }
      activity.set(s.date, day)
    }
    return { activity, muscleSets }
  }, [fromDate, sinceDate])
}

export function useCardioTypes(): GymCardioType[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.cardioTypes.toArray()
    return all.filter((t) => !t.deleted_at && !t.archived).sort((a, b) => a.sort - b.sort)
  }, [])
}

export function useCardioLogsForDate(date: string): GymCardioLog[] | undefined {
  return useLiveQuery(async () => {
    const sessions = (await db.sessions.where('[kind+date]').equals(['cardio', date]).toArray()).filter(
      (s) => !s.deleted_at,
    )
    const logs: GymCardioLog[] = []
    for (const s of sessions) {
      logs.push(...(await db.cardioLogs.where('session_id').equals(s.id).toArray()).filter((l) => !l.deleted_at))
    }
    return logs.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }, [date])
}
