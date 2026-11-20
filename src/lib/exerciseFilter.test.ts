import { describe, expect, it } from 'vitest'
import type { GymExercise } from '../types/db'
import type { MuscleId } from '../types/muscles'
import { filterExercises } from './exerciseFilter'

const ex = (name: string, short: string | null, primary: MuscleId[], secondary: MuscleId[] = []) =>
  ({ name, short_name: short, primary_muscles: primary, secondary_muscles: secondary }) as GymExercise

const LIST = [
  ex('Dips am Barren', 'Dips', ['triceps', 'chest'], ['shoulders']),
  ex('Butterfly Maschine', 'Brust 2A', ['chest'], ['shoulders']),
  ex('Seitheben Kurzhantel', 'Seitheben', ['shoulders']),
]

describe('filterExercises', () => {
  it('sucht in Name und Gerätebezeichnung ohne Beachtung der Groß-/Kleinschreibung', () => {
    expect(filterExercises(LIST, 'brust', null).map((e) => e.name)).toEqual(['Butterfly Maschine'])
    expect(filterExercises(LIST, '  DIPS ', null).map((e) => e.name)).toEqual(['Dips am Barren'])
  })

  it('filtert nach Muskel (primär oder sekundär) und sortiert primäre zuerst', () => {
    expect(filterExercises(LIST, '', 'shoulders').map((e) => e.name)).toEqual([
      'Seitheben Kurzhantel',
      'Butterfly Maschine',
      'Dips am Barren',
    ])
  })

  it('kombiniert Suche und Muskel', () => {
    expect(filterExercises(LIST, 'dips', 'chest').map((e) => e.name)).toEqual(['Dips am Barren'])
    expect(filterExercises(LIST, 'dips', 'abs')).toEqual([])
  })
})
