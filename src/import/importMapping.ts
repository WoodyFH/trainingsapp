import { formatDate } from '../lib/date'
import { stableId } from '../lib/uuid'
import { logVolume } from '../lib/volume'
import { seedExerciseId } from '../seed/seed'
import { SEED_EXERCISES, type SeedExercise } from '../seed/seedData'
import type { GymExerciseLog, GymSession, Sides } from '../types/db'
import {
  DEFAULT_SETS,
  EXCEL_EXERCISES,
  FREE_NOTE,
  IMPORT_EXPECTED,
  MIN_TEMPLATE_HITS,
  MIN_TEMPLATE_SHARE,
  normalizeName,
  type ExcelExercise,
} from './excelMapping'
import type { ImportWarning, ParsedDay, ParsedEntry, ParseResult } from './importParser'

/** Aus den gelesenen Tagen werden Einheiten und Einträge der App (rein, ohne Datenbank). */

export type TrainingNumber = 1 | 2 | 3

export interface ImportContext {
  userId: string
  /** IDs der drei Rotations-Trainings. Fehlt eines, werden dessen Tage als Freitraining importiert. */
  templateIds: Partial<Record<TrainingNumber, string>>
  /** Körpergewicht für die Volumen-Anzeige in der Vorschau. */
  bodyweightKg: number
}

export interface ImportDaySummary {
  date: string
  training: TrainingNumber | null
  exerciseCount: number
}

export interface ImportStats {
  /** Zeilen mit Datum und mindestens einer Übung in der Excel. */
  sourceRows: number
  /** Einheiten nach dem Zusammenfassen gleicher Daten. */
  sessionCount: number
  firstDate: string | null
  lastDate: string | null
  byTraining: Record<'1' | '2' | '3' | 'free', number>
  logCount: number
  remarksFound: number
  remarksImported: number
  totalVolume: number
  /** Anzahl Einträge je Schlüssel der Startübung. */
  perExercise: Record<string, number>
}

export interface ImportPlan {
  sessions: GymSession[]
  logs: GymExerciseLog[]
  days: ImportDaySummary[]
  stats: ImportStats
  warnings: ImportWarning[]
  /** Schlüssel der Startübungen, die der Import verwendet (zum Wiederanlegen fehlender Übungen). */
  exerciseKeys: string[]
}

const seedByKey = new Map<string, SeedExercise>(SEED_EXERCISES.map((e) => [e.key, e]))

/** Wählt das Training mit den meisten Treffern (mind. 2 Übungen und 60 % des Tages), sonst null. */
export function assignTraining(hits: Record<TrainingNumber, number>, total: number): TrainingNumber | null {
  let best: TrainingNumber | null = null
  for (const n of [1, 2, 3] as const) {
    if (best === null || hits[n] > hits[best]) best = n
  }
  if (best === null || total === 0) return null
  if (hits[best] >= MIN_TEMPLATE_HITS && hits[best] / total >= MIN_TEMPLATE_SHARE) return best
  return null
}

function mergeDuplicates(days: ParsedDay[], warnings: ImportWarning[]): ParsedDay[] {
  const byDate = new Map<string, ParsedDay>()
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row)) {
    const existing = byDate.get(day.date)
    if (!existing) {
      byDate.set(day.date, { ...day, entries: [...day.entries] })
      continue
    }
    const overwritten: string[] = []
    for (const entry of day.entries) {
      const index = existing.entries.findIndex((e) => normalizeName(e.excelName) === normalizeName(entry.excelName))
      if (index === -1) existing.entries.push(entry)
      else {
        overwritten.push(entry.excelName)
        existing.entries[index] = entry
      }
    }
    warnings.push({
      code: 'duplicate',
      date: day.date,
      message:
        `${formatDate(day.date)}: Das Datum steht in zwei Zeilen (${existing.row} und ${day.row}) und wird zu einer Einheit zusammengefasst.` +
        (overwritten.length > 0
          ? ` Bei ${overwritten.join(', ')} zählt die spätere Zeile ${day.row}. Prüfe, ob eines der Daten in der Excel falsch ist.`
          : ''),
    })
    existing.remark = [existing.remark, day.remark].filter(Boolean).join('\n') || null
  }
  return [...byDate.values()]
}

export function buildImportPlan(parsed: ParseResult, ctx: ImportContext): ImportPlan {
  const warnings: ImportWarning[] = [...parsed.warnings]
  const days = mergeDuplicates(parsed.days, warnings)

  const unknown = new Set<string>()
  const sessions: GymSession[] = []
  const logs: GymExerciseLog[] = []
  const daySummaries: ImportDaySummary[] = []
  const perExercise: Record<string, number> = {}
  const usedKeys = new Set<string>()
  let remarksImported = 0
  let totalVolume = 0
  const byTraining: ImportStats['byTraining'] = { '1': 0, '2': 0, '3': 0, free: 0 }

  for (const day of days) {
    // Bekannte Spalten und Zuordnung der Übungen eines Tages zu den Trainings
    const known: { entry: ParsedEntry; mapping: ExcelExercise }[] = []
    for (const entry of day.entries) {
      const mapping = EXCEL_EXERCISES.get(normalizeName(entry.excelName))
      if (!mapping) {
        if (!unknown.has(entry.excelName)) {
          unknown.add(entry.excelName)
          warnings.push({
            code: 'unknown-column',
            message: `Die Spalte „${entry.excelName}“ ist unbekannt, ihre Einträge werden nicht importiert.`,
          })
        }
        continue
      }
      known.push({ entry, mapping })
    }
    if (known.length === 0) continue

    const hits: Record<TrainingNumber, number> = { 1: 0, 2: 0, 3: 0 }
    for (const { mapping } of known) if (mapping.training) hits[mapping.training]++
    let training = assignTraining(hits, known.length)
    if (training !== null && !ctx.templateIds[training]) training = null

    const sessionId = stableId(`${ctx.userId}:import:session:${day.date}`)
    const stamp = `${day.date}T12:00:00.000Z`
    const noteParts = [day.remark, training === null ? FREE_NOTE : null].filter(Boolean)
    if (day.remark) remarksImported++

    const session: GymSession = {
      id: sessionId,
      user_id: ctx.userId,
      kind: training === null ? 'free' : 'strength',
      template_id: training === null ? null : (ctx.templateIds[training] ?? null),
      date: day.date,
      started_at: stamp,
      finished_at: stamp,
      note: noteParts.length ? noteParts.join('\n') : null,
      source: 'import',
      created_at: stamp,
      updated_at: stamp,
      deleted_at: null,
    }
    sessions.push(session)
    byTraining[training === null ? 'free' : String(training) as '1' | '2' | '3']++
    daySummaries.push({ date: day.date, training, exerciseCount: known.length })

    known.forEach(({ entry, mapping }, index) => {
      const key = mapping.keyFor(day.date)
      const seed = seedByKey.get(key)
      if (!seed) return
      usedKeys.add(key)
      perExercise[key] = (perExercise[key] ?? 0) + 1

      const label = `${formatDate(day.date)}, ${entry.excelName}`
      const isTime = seed.loadType === 'time'
      let sets = entry.sets
      if (sets === null) {
        sets = DEFAULT_SETS
        warnings.push({ code: 'sets-missing', date: day.date, message: `${label}: Sätze fehlen, es werden ${DEFAULT_SETS} angenommen.` })
      }
      if (entry.unreadable.length > 0) {
        warnings.push({
          code: 'unreadable',
          date: day.date,
          message: `${label}: Ein Wert ist keine Zahl und wird ignoriert (${entry.unreadable.join(', ')}).`,
        })
      }
      if (isTime && entry.seconds === null) {
        warnings.push({ code: 'seconds-missing', date: day.date, message: `${label}: Sekunden fehlen.` })
      }
      if (!isTime && entry.reps === null) {
        warnings.push({ code: 'reps-missing', date: day.date, message: `${label}: Wiederholungen fehlen.` })
      }
      if ((seed.loadType === 'weight' || seed.loadType === 'assisted') && entry.kg === null) {
        warnings.push({ code: 'weight-missing', date: day.date, message: `${label}: Gewicht fehlt.` })
      }

      const sides: Sides = mapping.sidesFor ? mapping.sidesFor(day.date) : seed.sides
      const log: GymExerciseLog = {
        id: stableId(`${ctx.userId}:import:log:${day.date}:${key}`),
        user_id: ctx.userId,
        session_id: sessionId,
        exercise_id: seedExerciseId(ctx.userId, key),
        sets,
        reps: isTime ? null : entry.reps,
        weight_kg: isTime ? null : entry.kg,
        seconds: isTime ? entry.seconds : null,
        sides,
        increase_next: false,
        note: null,
        sort: index,
        created_at: stamp,
        updated_at: stamp,
        deleted_at: null,
      }
      logs.push(log)
      totalVolume += logVolume(log, seed.loadType, ctx.bodyweightKg)
    })
  }

  return {
    sessions,
    logs,
    days: daySummaries,
    stats: {
      sourceRows: parsed.days.length,
      sessionCount: sessions.length,
      firstDate: sessions[0]?.date ?? null,
      lastDate: sessions[sessions.length - 1]?.date ?? null,
      byTraining,
      logCount: logs.length,
      remarksFound: parsed.remarksFound,
      remarksImported,
      totalVolume,
      perExercise,
    },
    warnings,
    exerciseKeys: [...usedKeys],
  }
}

export interface ExpectedCheck {
  label: string
  expected: string
  actual: string
  ok: boolean
}

/** Gleicht die Ergebnisse mit den erwarteten Prüfwerten aus dem Auftrag ab. */
export function checkAgainstExpected(plan: ImportPlan): ExpectedCheck[] {
  const { stats, days } = plan
  const trainingText = (t: TrainingNumber | null) => (t === null ? 'Freitraining' : `Training ${t}`)
  const lastThree = days.slice(-3)

  const checks: ExpectedCheck[] = [
    {
      label: 'Trainingstage (Zeilen mit Übungen)',
      expected: String(IMPORT_EXPECTED.trainingDays),
      actual: String(stats.sourceRows),
      ok: stats.sourceRows === IMPORT_EXPECTED.trainingDays,
    },
    {
      label: 'Erster Tag',
      expected: formatDate(IMPORT_EXPECTED.firstDate),
      actual: stats.firstDate ? formatDate(stats.firstDate) : '–',
      ok: stats.firstDate === IMPORT_EXPECTED.firstDate,
    },
    {
      label: 'Letzter Tag',
      expected: formatDate(IMPORT_EXPECTED.lastDate),
      actual: stats.lastDate ? formatDate(stats.lastDate) : '–',
      ok: stats.lastDate === IMPORT_EXPECTED.lastDate,
    },
    {
      label: 'Bemerkungen',
      expected: String(IMPORT_EXPECTED.remarks),
      actual: String(stats.remarksFound),
      ok: stats.remarksFound === IMPORT_EXPECTED.remarks,
    },
  ]

  const dayLabels = ['Drittletzter Tag', 'Vorletzter Tag', 'Letzter Tag (Training)']
  IMPORT_EXPECTED.lastDays.forEach((expected, i) => {
    const actual = lastThree[i]
    checks.push({
      label: dayLabels[i] ?? `Tag ${i + 1}`,
      expected: `${formatDate(expected.date)}, ${trainingText(expected.training)}`,
      actual: actual ? `${formatDate(actual.date)}, ${trainingText(actual.training)}` : '–',
      ok: actual?.date === expected.date && actual.training === expected.training,
    })
  })
  return checks
}
