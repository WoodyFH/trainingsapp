import { db } from '../db/db'
import { holdTime, logVolume } from '../lib/volume'
import { liveLogs } from './sessions'

export interface SessionSummary {
  /** Anzahl abgehakter Übungen. */
  exerciseCount: number
  /** Gesamtvolumen in kg (ohne Zeitübungen). */
  volume: number
  /** Gesamt-Haltezeit in Sekunden (Zeitübungen). */
  holdSeconds: number
  /** Volumen der vorigen Einheit desselben Trainings (null, wenn es keine gibt). */
  previousVolume: number | null
  previousDate: string | null
  /** Veränderung zur vorigen Einheit in Prozent (null ohne Vergleich). */
  deltaPercent: number | null
}

async function totals(sessionId: string, bodyweightKg: number): Promise<Omit<SessionSummary, 'previousVolume' | 'previousDate' | 'deltaPercent'>> {
  const logs = await liveLogs(sessionId)
  const exercises = new Map((await db.exercises.bulkGet([...new Set(logs.map((l) => l.exercise_id))])).map((e) => [e?.id, e]))
  let volume = 0
  let hold = 0
  for (const log of logs) {
    const ex = exercises.get(log.exercise_id)
    if (!ex) continue
    volume += logVolume(log, ex.load_type, bodyweightKg)
    hold += holdTime(log, ex.load_type)
  }
  return { exerciseCount: logs.length, volume, holdSeconds: hold }
}

/** Prozentuale Veränderung; null, wenn der Vergleichswert 0 ist. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

/** Zusammenfassung einer Einheit inklusive Vergleich zum letzten Mal desselben Trainings. */
export async function summarizeSession(sessionId: string, bodyweightKg: number): Promise<SessionSummary | null> {
  const session = await db.sessions.get(sessionId)
  if (!session) return null
  const current = await totals(sessionId, bodyweightKg)

  let previousVolume: number | null = null
  let previousDate: string | null = null
  if (session.template_id) {
    const candidates = (await db.sessions.where('kind').equals('strength').toArray())
      .filter((s) => !s.deleted_at && s.template_id === session.template_id && s.id !== session.id && s.date <= session.date)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    for (const candidate of candidates) {
      const t = await totals(candidate.id, bodyweightKg)
      if (t.exerciseCount === 0) continue
      previousVolume = t.volume
      previousDate = candidate.date
      break
    }
  }

  return {
    ...current,
    previousVolume,
    previousDate,
    deltaPercent: previousVolume === null ? null : percentChange(current.volume, previousVolume),
  }
}
