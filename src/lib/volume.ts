import type { LoadType, Sides } from '../types/db'
import type { MuscleId } from '../types/muscles'
import { formatNumber } from './date'

/**
 * Volumenberechnung (Prompt Abschnitt 5). Alle Formeln werden mit dem Seiten-Faktor multipliziert:
 * sides = 1 beidseitig bzw. ohne Seitenbezug, sides = 2 kg pro Hand/Bein bzw. Wdh./Sekunden pro Seite.
 */

export interface LogValues {
  sets: number
  reps: number | null
  weight_kg: number | null
  seconds: number | null
  sides: Sides
}

/** Kilogramm-Volumen eines Eintrags. Zeitübungen haben keines (siehe holdTime). */
export function logVolume(log: LogValues, loadType: LoadType, bodyweightKg: number): number {
  const reps = log.reps ?? 0
  const kg = log.weight_kg ?? 0
  switch (loadType) {
    case 'weight':
      return log.sets * reps * kg * log.sides
    case 'assisted':
      return log.sets * reps * Math.max(0, bodyweightKg - kg) * log.sides
    case 'bodyweight':
      return log.sets * reps * kg * log.sides
    case 'time':
      return 0
  }
}

/** Haltezeit in Sekunden (Sätze × Sekunden × Seiten), nur für Zeitübungen. */
export function holdTime(log: LogValues, loadType: LoadType): number {
  if (loadType !== 'time') return 0
  return log.sets * (log.seconds ?? 0) * log.sides
}

export interface ExerciseMuscles {
  primary_muscles: readonly MuscleId[]
  secondary_muscles: readonly MuscleId[]
}

/** Primäre Muskeln zählen 100 %, sekundäre 50 %. */
export const PRIMARY_WEIGHT = 1
export const SECONDARY_WEIGHT = 0.5

/** Verteilt einen Wert (z. B. Volumen oder Satzzahl) auf die Muskeln einer Übung. */
export function addToMuscles(
  target: Partial<Record<MuscleId, number>>,
  exercise: ExerciseMuscles,
  value: number,
): void {
  for (const m of exercise.primary_muscles) target[m] = (target[m] ?? 0) + value * PRIMARY_WEIGHT
  for (const m of exercise.secondary_muscles) {
    if (exercise.primary_muscles.includes(m)) continue
    target[m] = (target[m] ?? 0) + value * SECONDARY_WEIGHT
  }
}

/**
 * Skaliert Muskelwerte auf 0…1 für die Heatmap. Alles über 0 bekommt mindestens `floor`,
 * damit ein wenig trainierter Muskel sichtbar vom unbenutzten abweicht.
 */
export function normalizeIntensity(
  values: Partial<Record<MuscleId, number>>,
  floor = 0.2,
): Partial<Record<MuscleId, number>> {
  const max = Math.max(0, ...Object.values(values).map((v) => v ?? 0))
  const result: Partial<Record<MuscleId, number>> = {}
  if (max <= 0) return result
  for (const [muscle, v] of Object.entries(values) as [MuscleId, number][]) {
    if (v > 0) result[muscle] = floor + (1 - floor) * (v / max)
  }
  return result
}

/** Intensität einer Übungsliste nach Häufigkeit als primärer bzw. sekundärer Muskel. */
export function intensityFromExercises(exercises: readonly ExerciseMuscles[]): Partial<Record<MuscleId, number>> {
  const counts: Partial<Record<MuscleId, number>> = {}
  for (const e of exercises) addToMuscles(counts, e, 1)
  return normalizeIntensity(counts)
}

/** Kurztext der Werte, z. B. "3 × 12 × 130 kg" oder "3 × 75 s pro Seite". */
export function describeLog(log: LogValues, loadType: LoadType): string {
  const side = log.sides === 2 ? ' pro Seite' : ''
  switch (loadType) {
    case 'time':
      return `${log.sets} × ${formatNumber(log.seconds ?? 0, 0)} s${side}`
    case 'assisted':
      return `${log.sets} × ${log.reps ?? 0} × ${formatNumber(log.weight_kg ?? 0)} kg Unterstützung`
    case 'bodyweight':
      return (log.weight_kg ?? 0) > 0
        ? `${log.sets} × ${log.reps ?? 0} × +${formatNumber(log.weight_kg ?? 0)} kg${side}`
        : `${log.sets} × ${log.reps ?? 0}${side}`
    case 'weight':
      return `${log.sets} × ${log.reps ?? 0} × ${formatNumber(log.weight_kg ?? 0)} kg${side}`
  }
}
