import { addDays, daysBetween, formatMonthShort, formatShortDate, startOfMonth, startOfWeek } from '../lib/date'
import { TRAINING_COLORS } from '../lib/trainingColors'
import { addToMuscles, holdTime, logVolume, PRIMARY_WEIGHT, SECONDARY_WEIGHT } from '../lib/volume'
import type {
  GymCardioLog,
  GymCardioType,
  GymExercise,
  GymExerciseLog,
  GymSession,
  GymTemplate,
  LoadType,
} from '../types/db'
import type { MuscleId } from '../types/muscles'
import { inRange, type DateRange } from './period'

/** Berechnungen der Statistik. Alles rein (ohne Datenbankzugriff) und einzeln testbar. */

export interface StatsInput {
  /** Nicht gelöschte Einheiten. */
  sessions: GymSession[]
  /** Nicht gelöschte Einträge der Krafteinheiten. */
  logs: GymExerciseLog[]
  exercises: Map<string, GymExercise>
  templates: Map<string, GymTemplate>
  cardioLogs: GymCardioLog[]
  cardioTypes: Map<string, GymCardioType>
  bodyweightKg: number
}

export function templateLabel(t: GymTemplate | undefined): string {
  if (!t) return 'Training'
  return t.in_rotation && t.rotation_order ? `Training ${t.rotation_order} · ${t.name}` : t.name
}

// ---------------------------------------------------------------------------
// Einheiten und Volumen
// ---------------------------------------------------------------------------

export interface SessionStat {
  id: string
  date: string
  kind: 'strength' | 'free'
  templateId: string | null
  name: string
  color: string
  /** Gesamtvolumen in kg (ohne Zeitübungen). */
  volume: number
  /** Gesamt-Haltezeit in Sekunden. */
  holdSeconds: number
  exerciseCount: number
  sets: number
}

export function sessionColor(session: GymSession, templates: Map<string, GymTemplate>): string {
  if (session.kind === 'free') return TRAINING_COLORS.free
  if (session.kind === 'cardio') return TRAINING_COLORS.cardio
  return (session.template_id && templates.get(session.template_id)?.color) || TRAINING_COLORS.training1
}

/** Krafteinheiten und Freitrainings mit mindestens einem Eintrag, nach Datum sortiert. */
export function buildSessionStats(input: StatsInput): SessionStat[] {
  const logsBySession = new Map<string, GymExerciseLog[]>()
  for (const l of input.logs) {
    const list = logsBySession.get(l.session_id)
    if (list) list.push(l)
    else logsBySession.set(l.session_id, [l])
  }

  const stats: SessionStat[] = []
  for (const s of input.sessions) {
    if (s.kind !== 'strength' && s.kind !== 'free') continue
    const logs = logsBySession.get(s.id)
    if (!logs || logs.length === 0) continue
    let volume = 0
    let hold = 0
    let sets = 0
    for (const l of logs) {
      const ex = input.exercises.get(l.exercise_id)
      if (!ex) continue
      volume += logVolume(l, ex.load_type, input.bodyweightKg)
      hold += holdTime(l, ex.load_type)
      sets += l.sets
    }
    stats.push({
      id: s.id,
      date: s.date,
      kind: s.kind,
      templateId: s.template_id,
      name: s.kind === 'free' ? 'Freitraining' : templateLabel(s.template_id ? input.templates.get(s.template_id) : undefined),
      color: sessionColor(s, input.templates),
      volume,
      holdSeconds: hold,
      exerciseCount: logs.length,
      sets,
    })
  }
  return stats.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

export function statsInRange(stats: SessionStat[], from: string | null, to: string): SessionStat[] {
  return stats.filter((s) => inRange(s.date, from, to))
}

export function totalVolume(stats: SessionStat[]): number {
  return stats.reduce((sum, s) => sum + s.volume, 0)
}

export interface PeriodComparison {
  current: number
  previous: number | null
  /** Veränderung in Prozent; null ohne Vergleichszeitraum oder wenn dort 0 war. */
  deltaPercent: number | null
}

export function comparePeriods(stats: SessionStat[], range: DateRange): PeriodComparison {
  const current = totalVolume(statsInRange(stats, range.from, range.to))
  if (range.prevFrom === null || range.prevTo === null) return { current, previous: null, deltaPercent: null }
  const previous = totalVolume(statsInRange(stats, range.prevFrom, range.prevTo))
  return { current, previous, deltaPercent: previous > 0 ? ((current - previous) / previous) * 100 : null }
}

export type Granularity = 'session' | 'week' | 'month'

export interface VolumeBar {
  key: string
  /** Kurzer Achsentext. */
  label: string
  /** Langer Text für Tooltip und Tabelle. */
  title: string
  volume: number
  color: string
  sessions: number
}

const SUM_COLOR = '#27272A'

/** Balken für das Volumen: je Einheit (Farbe des Trainings) oder als Wochen- bzw. Monatssummen (lückenlos, leere = 0). */
export function volumeBars(stats: SessionStat[], granularity: Granularity, range: DateRange, today: string): VolumeBar[] {
  const inside = statsInRange(stats, range.from, range.to)
  if (granularity === 'session') {
    return inside.map((s) => ({
      key: s.id,
      label: formatShortDate(s.date),
      title: `${formatShortDate(s.date)} · ${s.name}`,
      volume: s.volume,
      color: s.color,
      sessions: 1,
    }))
  }
  if (inside.length === 0 && range.from === null) return []

  const first = range.from ?? inside[0]?.date ?? today
  const bucketStart = granularity === 'week' ? startOfWeek : startOfMonth
  const sums = new Map<string, { volume: number; sessions: number }>()
  for (const s of inside) {
    const key = bucketStart(s.date)
    const cur = sums.get(key) ?? { volume: 0, sessions: 0 }
    cur.volume += s.volume
    cur.sessions += 1
    sums.set(key, cur)
  }

  const bars: VolumeBar[] = []
  let cursor = bucketStart(first)
  const end = bucketStart(today)
  while (cursor <= end) {
    const v = sums.get(cursor) ?? { volume: 0, sessions: 0 }
    bars.push({
      key: cursor,
      label: granularity === 'week' ? formatShortDate(cursor) : formatMonthShort(cursor),
      title: granularity === 'week' ? `Woche ab ${formatShortDate(cursor)}` : formatMonthShort(cursor),
      volume: v.volume,
      color: SUM_COLOR,
      sessions: v.sessions,
    })
    if (granularity === 'week') cursor = addDays(cursor, 7)
    else {
      const [y, m] = cursor.split('-').map(Number)
      const next = new Date(y ?? 1970, m ?? 1, 1) // Monat + 1 (m ist 1-basiert, Date 0-basiert)
      cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
    }
  }
  return bars
}

// ---------------------------------------------------------------------------
// Trainingstage, Wochen, Serie
// ---------------------------------------------------------------------------

export interface ActivityDay {
  date: string
  kinds: ('strength' | 'free' | 'cardio')[]
  /** Farbe des Tages: Krafttraining vor Freitraining vor Cardio. */
  color: string
  /** Namen der Einheiten dieses Tages (Tooltip). */
  names: string[]
}

/** Tage mit mindestens einer Einheit mit Inhalt (Kraft, Frei oder Cardio). */
export function buildActivity(input: StatsInput, sessionStats: SessionStat[]): Map<string, ActivityDay> {
  const map = new Map<string, ActivityDay>()
  const rank = { strength: 0, free: 1, cardio: 2 } as const
  const bestRank = new Map<string, number>()
  const add = (date: string, kind: ActivityDay['kinds'][number], color: string, name: string) => {
    const day = map.get(date) ?? { date, kinds: [], color, names: [] }
    day.kinds.push(kind)
    day.names.push(name)
    const best = bestRank.get(date)
    if (best === undefined || rank[kind] < best) {
      bestRank.set(date, rank[kind])
      day.color = color
    }
    map.set(date, day)
  }
  for (const s of sessionStats) add(s.date, s.kind, s.color, s.name)

  const cardioSessions = new Set(input.cardioLogs.map((l) => l.session_id))
  for (const s of input.sessions) {
    if (s.kind === 'cardio' && cardioSessions.has(s.id)) add(s.date, 'cardio', TRAINING_COLORS.cardio, 'Cardio')
  }
  return map
}

/** Montage der Wochen für die Kalender-Heatmap (aufsteigend, höchstens `maxWeeks`). */
export function heatmapWeeks(range: DateRange, today: string, firstDate: string | null, maxWeeks = 53): string[] {
  const start = range.from ?? firstDate ?? today
  let first = startOfWeek(start)
  const last = startOfWeek(today)
  const weeks = Math.floor(daysBetween(first, last) / 7) + 1
  if (weeks > maxWeeks) first = addDays(last, -(maxWeeks - 1) * 7)
  const result: string[] = []
  for (let w = first; w <= last; w = addDays(w, 7)) result.push(w)
  return result
}

/** Anzahl Kraft- und Freitrainings je Woche (Schlüssel = Montag). */
export function weekCounts(stats: SessionStat[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const s of stats) {
    const key = startOfWeek(s.date)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * Aktuelle Serie: aufeinanderfolgende Wochen mit mindestens `min` Einheiten. Die laufende Woche zählt mit,
 * sobald sie `min` erreicht hat; solange sie noch läuft, bricht sie die Serie nicht.
 */
export function currentStreak(counts: Map<string, number>, today: string, min = 2): number {
  let week = startOfWeek(today)
  let streak = 0
  if ((counts.get(week) ?? 0) >= min) streak++
  week = addDays(week, -7)
  while ((counts.get(week) ?? 0) >= min) {
    streak++
    week = addDays(week, -7)
  }
  return streak
}

/** Durchschnittliche Einheiten pro Woche im Zeitraum (bei "Alles" ab der ersten Einheit). */
export function averagePerWeek(stats: SessionStat[], range: DateRange, today: string): number {
  const inside = statsInRange(stats, range.from, range.to)
  if (inside.length === 0) return 0
  const from = range.from ?? inside[0]?.date ?? today
  const weeks = Math.max(1, (daysBetween(from, today) + 1) / 7)
  return inside.length / weeks
}

// ---------------------------------------------------------------------------
// Muskelgruppen
// ---------------------------------------------------------------------------

export type MuscleMetric = 'volume' | 'sets'

export interface MuscleContribution {
  exercise: GymExercise
  role: 'primary' | 'secondary'
  /** Anteil am Muskel (Volumen oder Sätze, bei sekundär zu 50 % gewichtet). */
  value: number
}

export interface MuscleStats {
  totals: Partial<Record<MuscleId, number>>
  byMuscle: Partial<Record<MuscleId, MuscleContribution[]>>
}

/**
 * Belastung je Muskel im Zeitraum. Volumen (kg) oder Anzahl Sätze; primäre Muskeln zählen 100 %, sekundäre 50 %.
 * Zeit- und Körpergewichtsübungen haben kein kg-Volumen und tauchen daher nur bei "Sätze" auf.
 */
export function muscleStats(input: StatsInput, from: string | null, to: string, metric: MuscleMetric): MuscleStats {
  const sessionDate = new Map<string, string>()
  for (const s of input.sessions) if (s.kind !== 'cardio') sessionDate.set(s.id, s.date)

  const perExercise = new Map<string, number>()
  for (const l of input.logs) {
    const date = sessionDate.get(l.session_id)
    if (!date || !inRange(date, from, to)) continue
    const ex = input.exercises.get(l.exercise_id)
    if (!ex) continue
    const value = metric === 'sets' ? l.sets : logVolume(l, ex.load_type, input.bodyweightKg)
    perExercise.set(ex.id, (perExercise.get(ex.id) ?? 0) + value)
  }

  const totals: Partial<Record<MuscleId, number>> = {}
  const byMuscle: Partial<Record<MuscleId, MuscleContribution[]>> = {}
  for (const [exerciseId, value] of perExercise) {
    const ex = input.exercises.get(exerciseId)
    if (!ex || value <= 0) continue
    addToMuscles(totals, ex, value)
    for (const m of ex.primary_muscles) {
      byMuscle[m] = [...(byMuscle[m] ?? []), { exercise: ex, role: 'primary', value: value * PRIMARY_WEIGHT }]
    }
    for (const m of ex.secondary_muscles) {
      if (ex.primary_muscles.includes(m)) continue
      byMuscle[m] = [...(byMuscle[m] ?? []), { exercise: ex, role: 'secondary', value: value * SECONDARY_WEIGHT }]
    }
  }
  for (const list of Object.values(byMuscle)) list?.sort((a, b) => b.value - a.value)
  return { totals, byMuscle }
}

// ---------------------------------------------------------------------------
// Verlauf einer Übung
// ---------------------------------------------------------------------------

export interface ExerciseEntry {
  date: string
  sessionId: string
  log: GymExerciseLog
  /** kg-Volumen (0 bei Zeit- und Körpergewichtsübungen ohne Zusatz). */
  volume: number
  /** Haltezeit gesamt in Sekunden (nur Zeitübungen). */
  hold: number
  /** Gesamtzahl Wiederholungen (Sätze × Wdh × Seiten). */
  totalReps: number
}

export function exerciseHistory(exerciseId: string, input: StatsInput): ExerciseEntry[] {
  const ex = input.exercises.get(exerciseId)
  if (!ex) return []
  const dateById = new Map(input.sessions.filter((s) => s.kind !== 'cardio').map((s) => [s.id, s.date]))
  const entries: ExerciseEntry[] = []
  for (const log of input.logs) {
    if (log.exercise_id !== exerciseId) continue
    const date = dateById.get(log.session_id)
    if (!date) continue
    entries.push({
      date,
      sessionId: log.session_id,
      log,
      volume: logVolume(log, ex.load_type, input.bodyweightKg),
      hold: holdTime(log, ex.load_type),
      totalReps: log.sets * (log.reps ?? 0) * log.sides,
    })
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.log.created_at.localeCompare(b.log.created_at))
}

/** Hauptwert eines Eintrags je Lasttyp: kg, Gegengewicht (kg), Wiederholungen oder Sekunden. */
export function mainValue(entry: ExerciseEntry, loadType: LoadType): number {
  switch (loadType) {
    case 'weight':
    case 'assisted':
      return entry.log.weight_kg ?? 0
    case 'bodyweight':
      return entry.log.reps ?? 0
    case 'time':
      return entry.log.seconds ?? 0
  }
}

/** Zweiter Verlauf: Volumen (kg), bei Körpergewicht gesamte Wiederholungen, bei Zeit die Haltezeit. */
export function secondValue(entry: ExerciseEntry, loadType: LoadType): number {
  switch (loadType) {
    case 'weight':
    case 'assisted':
      return entry.volume
    case 'bodyweight':
      return entry.totalReps
    case 'time':
      return entry.hold
  }
}

export interface ChartSpec {
  main: { label: string; unit: string }
  second: { label: string; unit: string }
}

export function chartSpec(loadType: LoadType, sides: 1 | 2): ChartSpec {
  switch (loadType) {
    case 'weight':
      return { main: { label: sides === 2 ? 'Gewicht pro Seite' : 'Gewicht', unit: 'kg' }, second: { label: 'Volumen', unit: 'kg' } }
    case 'assisted':
      return { main: { label: 'Unterstützung', unit: 'kg' }, second: { label: 'Volumen', unit: 'kg' } }
    case 'bodyweight':
      return { main: { label: 'Wiederholungen pro Satz', unit: '' }, second: { label: 'Wiederholungen gesamt', unit: '' } }
    case 'time':
      return { main: { label: sides === 2 ? 'Sekunden pro Seite' : 'Sekunden', unit: 's' }, second: { label: 'Haltezeit gesamt', unit: 's' } }
  }
}

export interface ExerciseSummary {
  first: ExerciseEntry | null
  last: ExerciseEntry | null
  /** Bestwert: höchstes Gewicht, geringste Unterstützung, meiste Wiederholungen bzw. längste Haltezeit. */
  best: ExerciseEntry | null
}

export function summarizeExercise(entries: ExerciseEntry[], loadType: LoadType): ExerciseSummary {
  if (entries.length === 0) return { first: null, last: null, best: null }
  const better = (a: ExerciseEntry, b: ExerciseEntry): boolean => {
    const av = mainValue(a, loadType)
    const bv = mainValue(b, loadType)
    if (av !== bv) return loadType === 'assisted' ? av < bv : av > bv
    // Gleicher Hauptwert: mehr Wiederholungen bzw. mehr Volumen gewinnt
    return (a.log.reps ?? 0) * a.log.sets > (b.log.reps ?? 0) * b.log.sets
  }
  let best = entries[0] as ExerciseEntry
  for (const e of entries) if (better(e, best)) best = e
  return { first: entries[0] ?? null, last: entries[entries.length - 1] ?? null, best }
}

export interface ExerciseListItem {
  exercise: GymExercise
  count: number
  lastDate: string
}

/** Übungen mit mindestens einem Eintrag, zuletzt trainierte zuerst. */
export function exercisesWithHistory(input: StatsInput): ExerciseListItem[] {
  const dateById = new Map(input.sessions.filter((s) => s.kind !== 'cardio').map((s) => [s.id, s.date]))
  const info = new Map<string, { count: number; lastDate: string }>()
  for (const l of input.logs) {
    const date = dateById.get(l.session_id)
    if (!date) continue
    const cur = info.get(l.exercise_id) ?? { count: 0, lastDate: '' }
    cur.count++
    if (date > cur.lastDate) cur.lastDate = date
    info.set(l.exercise_id, cur)
  }
  const items: ExerciseListItem[] = []
  for (const [id, v] of info) {
    const exercise = input.exercises.get(id)
    if (exercise) items.push({ exercise, ...v })
  }
  return items.sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.exercise.name.localeCompare(b.exercise.name, 'de'))
}

// ---------------------------------------------------------------------------
// Cardio
// ---------------------------------------------------------------------------

export type CardioMetric = 'duration' | 'kcal' | 'distance' | 'floors'

export const CARDIO_METRICS: { key: CardioMetric; label: string; unit: string }[] = [
  { key: 'duration', label: 'Minuten', unit: 'min' },
  { key: 'kcal', label: 'Kalorien', unit: 'kcal' },
  { key: 'distance', label: 'Distanz', unit: 'km' },
  { key: 'floors', label: 'Etagen', unit: 'Etagen' },
]

/** Farben der Cardio-Arten (kategorisch, feste Reihenfolge nach Sortierung der Art, nie nach Rang im Zeitraum). */
export const CARDIO_SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'] as const
export const CARDIO_OTHER_COLOR = '#8B8B8B'
export const CARDIO_OTHER_KEY = '__other__'

export interface CardioSeries {
  key: string
  name: string
  color: string
}

export interface CardioWeek {
  weekStart: string
  total: number
  byType: Record<string, number>
}

export interface CardioStats {
  series: CardioSeries[]
  weeks: CardioWeek[]
  total: number
}

function cardioValue(log: GymCardioLog, type: GymCardioType | undefined, metric: CardioMetric): number {
  if (metric === 'duration') return log.duration_min ?? 0
  if (metric === 'kcal') return log.kcal ?? 0
  const d = log.distance ?? 0
  const isFloors = type?.distance_unit === 'floors'
  if (metric === 'floors') return isFloors ? d : 0
  if (isFloors) return 0 // Etagen zählen nicht als Kilometer
  return type?.distance_unit === 'm' ? d / 1000 : d // Distanz immer in km
}

/** Cardio je Woche, aufgeteilt nach Art. Arten ab dem 9. Platz werden zu "Weitere" zusammengefasst. */
export function cardioStats(input: StatsInput, range: DateRange, today: string, metric: CardioMetric): CardioStats {
  const dateBySession = new Map(input.sessions.filter((s) => s.kind === 'cardio').map((s) => [s.id, s.date]))
  const orderedTypes = [...input.cardioTypes.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'de'))
  const colorIndex = new Map(orderedTypes.map((t, i) => [t.id, i]))
  const maxSlots = CARDIO_SERIES_COLORS.length

  const seriesKeyFor = (typeId: string): string => ((colorIndex.get(typeId) ?? maxSlots) < maxSlots ? typeId : CARDIO_OTHER_KEY)

  const perWeek = new Map<string, Record<string, number>>()
  const usedKeys = new Set<string>()
  let firstDate: string | null = null
  let total = 0
  for (const log of input.cardioLogs) {
    const date = dateBySession.get(log.session_id)
    if (!date || !inRange(date, range.from, range.to)) continue
    const value = cardioValue(log, input.cardioTypes.get(log.cardio_type_id), metric)
    if (value <= 0) continue
    const key = seriesKeyFor(log.cardio_type_id)
    const week = startOfWeek(date)
    const row = perWeek.get(week) ?? {}
    row[key] = (row[key] ?? 0) + value
    perWeek.set(week, row)
    usedKeys.add(key)
    total += value
    if (firstDate === null || date < firstDate) firstDate = date
  }

  const series: CardioSeries[] = orderedTypes
    .filter((t) => usedKeys.has(t.id))
    .map((t) => ({ key: t.id, name: t.name, color: CARDIO_SERIES_COLORS[colorIndex.get(t.id) ?? 0] ?? CARDIO_OTHER_COLOR }))
  if (usedKeys.has(CARDIO_OTHER_KEY)) series.push({ key: CARDIO_OTHER_KEY, name: 'Weitere', color: CARDIO_OTHER_COLOR })

  const weeks: CardioWeek[] = []
  if (firstDate !== null) {
    const start = startOfWeek(range.from ?? firstDate)
    const end = startOfWeek(today)
    for (let w = start; w <= end; w = addDays(w, 7)) {
      const byType = perWeek.get(w) ?? {}
      weeks.push({ weekStart: w, byType, total: Object.values(byType).reduce((a, b) => a + b, 0) })
    }
  }
  return { series, weeks, total }
}

// ---------------------------------------------------------------------------
// Verlauf (Liste aller Einheiten)
// ---------------------------------------------------------------------------

export interface HistoryItem {
  id: string
  date: string
  kind: GymSession['kind']
  name: string
  color: string
  subtitle: string
  note: string | null
  imported: boolean
}

/** Alle Einheiten mit Inhalt, jüngste zuerst. */
export function buildHistory(input: StatsInput, sessionStats: SessionStat[]): HistoryItem[] {
  const statById = new Map(sessionStats.map((s) => [s.id, s]))
  const cardioBySession = new Map<string, GymCardioLog[]>()
  for (const l of input.cardioLogs) {
    cardioBySession.set(l.session_id, [...(cardioBySession.get(l.session_id) ?? []), l])
  }

  const items: HistoryItem[] = []
  for (const s of input.sessions) {
    if (s.kind === 'cardio') {
      const logs = cardioBySession.get(s.id)
      if (!logs || logs.length === 0) continue
      const names = [...new Set(logs.map((l) => input.cardioTypes.get(l.cardio_type_id)?.name ?? 'Cardio'))]
      items.push({
        id: s.id,
        date: s.date,
        kind: 'cardio',
        name: 'Cardio',
        color: TRAINING_COLORS.cardio,
        subtitle: names.join(', '),
        note: s.note,
        imported: s.source === 'import',
      })
      continue
    }
    const stat = statById.get(s.id)
    if (!stat) continue
    items.push({
      id: s.id,
      date: s.date,
      kind: s.kind,
      name: stat.name,
      color: stat.color,
      subtitle: `${stat.exerciseCount} ${stat.exerciseCount === 1 ? 'Übung' : 'Übungen'}`,
      note: s.note,
      imported: s.source === 'import',
    })
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}
