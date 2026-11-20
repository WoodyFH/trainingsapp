import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { DEFAULT_BODYWEIGHT_KG } from '../seed/seedData'
import type { StatsInput } from './compute'

/**
 * Lädt alles, was die Statistik braucht, aus der lokalen Datenbank. Bei Änderungen rechnet die Seite neu;
 * bis dahin bleibt der vorige Stand sichtbar (kein Flackern). `undefined` gibt es nur beim ersten Laden.
 */
export function useStatsData(userId: string | null): StatsInput | undefined {
  return useLiveQuery(async () => {
    const [sessions, logs, exercises, templates, cardioLogs, cardioTypes, settings] = await Promise.all([
      db.sessions.toArray(),
      db.exerciseLogs.toArray(),
      db.exercises.toArray(),
      db.templates.toArray(),
      db.cardioLogs.toArray(),
      db.cardioTypes.toArray(),
      userId ? db.settings.get(userId) : Promise.resolve(undefined),
    ])
    const liveSessions = sessions.filter((s) => !s.deleted_at)
    const sessionIds = new Set(liveSessions.map((s) => s.id))
    return {
      sessions: liveSessions,
      // Einträge einer gelöschten Einheit zählen nicht mit
      logs: logs.filter((l) => !l.deleted_at && sessionIds.has(l.session_id)),
      exercises: new Map(exercises.filter((e) => !e.deleted_at).map((e) => [e.id, e])),
      templates: new Map(templates.filter((t) => !t.deleted_at).map((t) => [t.id, t])),
      cardioLogs: cardioLogs.filter((l) => !l.deleted_at && sessionIds.has(l.session_id)),
      cardioTypes: new Map(cardioTypes.filter((t) => !t.deleted_at).map((t) => [t.id, t])),
      bodyweightKg: settings?.bodyweight_kg ?? DEFAULT_BODYWEIGHT_KG,
    } satisfies StatsInput
  }, [userId])
}
