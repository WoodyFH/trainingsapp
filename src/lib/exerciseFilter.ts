import type { GymExercise } from '../types/db'
import type { MuscleId } from '../types/muscles'

/** Filtert Übungen nach Suchtext (Name oder Gerätebezeichnung) und Muskel. Primär trainierte Muskeln zuerst. */
export function filterExercises(
  exercises: readonly GymExercise[],
  query: string,
  muscle: MuscleId | null,
): GymExercise[] {
  const q = query.trim().toLowerCase()
  return exercises
    .filter((e) => {
      if (muscle && !e.primary_muscles.includes(muscle) && !e.secondary_muscles.includes(muscle)) return false
      if (!q) return true
      return e.name.toLowerCase().includes(q) || (e.short_name ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (muscle) {
        const pa = a.primary_muscles.includes(muscle) ? 0 : 1
        const pb = b.primary_muscles.includes(muscle) ? 0 : 1
        if (pa !== pb) return pa - pb
      }
      return a.name.localeCompare(b.name, 'de')
    })
}
