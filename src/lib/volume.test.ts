import { describe, expect, it } from 'vitest'
import { addToMuscles, describeLog, holdTime, intensityFromExercises, logVolume, normalizeIntensity } from './volume'

const base = { sets: 3, reps: 10, weight_kg: 18, seconds: null, sides: 1 as const }

describe('logVolume', () => {
  it('weight: Sätze × Wdh × kg', () => {
    expect(logVolume({ ...base, weight_kg: 85, reps: 11 }, 'weight', 75)).toBe(3 * 11 * 85)
  })

  it('weight mit Seiten-Faktor: Bizepscurls 3 × 10 × 18 kg × 2 = 1.080 kg', () => {
    expect(logVolume({ ...base, sides: 2 }, 'weight', 75)).toBe(1080)
  })

  it('assisted: Sätze × Wdh × (Körpergewicht − Gegengewicht)', () => {
    expect(logVolume({ ...base, weight_kg: 25, reps: 8 }, 'assisted', 75)).toBe(3 * 8 * 50)
    expect(logVolume({ ...base, weight_kg: 0, reps: 8 }, 'assisted', 75)).toBe(3 * 8 * 75)
  })

  it('assisted wird nie negativ (Gegengewicht über Körpergewicht)', () => {
    expect(logVolume({ ...base, weight_kg: 90 }, 'assisted', 75)).toBe(0)
  })

  it('bodyweight: Sätze × Wdh × Zusatzgewicht, ohne Zusatz 0', () => {
    expect(logVolume({ ...base, weight_kg: 5, reps: 12 }, 'bodyweight', 75)).toBe(3 * 12 * 5)
    expect(logVolume({ ...base, weight_kg: null, reps: 12 }, 'bodyweight', 75)).toBe(0)
  })

  it('time hat kein kg-Volumen, sondern Haltezeit', () => {
    const plank = { sets: 3, reps: null, weight_kg: null, seconds: 75, sides: 2 as const }
    expect(logVolume(plank, 'time', 75)).toBe(0)
    expect(holdTime(plank, 'time')).toBe(3 * 75 * 2)
    expect(holdTime(base, 'weight')).toBe(0)
  })

  it('behandelt fehlende Werte als 0', () => {
    expect(logVolume({ sets: 3, reps: null, weight_kg: null, seconds: null, sides: 1 }, 'weight', 75)).toBe(0)
  })
})

describe('Muskelverteilung', () => {
  it('primär 100 %, sekundär 50 %', () => {
    const target = {}
    addToMuscles(target, { primary_muscles: ['chest'], secondary_muscles: ['shoulders', 'triceps'] }, 100)
    expect(target).toEqual({ chest: 100, shoulders: 50, triceps: 50 })
  })

  it('zählt einen Muskel, der primär und sekundär ist, nur einmal als primär', () => {
    const target = {}
    addToMuscles(target, { primary_muscles: ['abs'], secondary_muscles: ['abs'] }, 10)
    expect(target).toEqual({ abs: 10 })
  })

  it('normalisiert auf 0…1 mit Mindestwert für alles Trainierte', () => {
    const result = normalizeIntensity({ chest: 200, abs: 2, calves: 0 })
    expect(result.chest).toBe(1)
    expect(result.abs).toBeGreaterThanOrEqual(0.2)
    expect(result.abs).toBeLessThan(0.25)
    expect(result.calves).toBeUndefined()
    expect(normalizeIntensity({})).toEqual({})
  })

  it('berechnet die Vorschau-Intensität nach Häufigkeit', () => {
    const result = intensityFromExercises([
      { primary_muscles: ['chest'], secondary_muscles: ['shoulders'] },
      { primary_muscles: ['chest'], secondary_muscles: [] },
    ])
    expect(result.chest).toBe(1)
    expect(result.shoulders).toBeCloseTo(0.2 + 0.8 * 0.25)
  })
})

describe('describeLog', () => {
  it('beschreibt die Werte je Lasttyp', () => {
    expect(describeLog({ ...base, reps: 12, weight_kg: 130 }, 'weight')).toBe('3 × 12 × 130 kg')
    expect(describeLog({ ...base, sides: 2, weight_kg: 17.5 }, 'weight')).toBe('3 × 10 × 17,5 kg pro Seite')
    expect(describeLog({ ...base, weight_kg: 0, reps: 8 }, 'assisted')).toBe('3 × 8 × 0 kg Unterstützung')
    expect(describeLog({ ...base, weight_kg: 0, reps: 15 }, 'bodyweight')).toBe('3 × 15')
    expect(describeLog({ ...base, weight_kg: 5, reps: 15 }, 'bodyweight')).toBe('3 × 15 × +5 kg')
    expect(describeLog({ sets: 3, reps: null, weight_kg: null, seconds: 75, sides: 2 }, 'time')).toBe(
      '3 × 75 s pro Seite',
    )
  })
})
