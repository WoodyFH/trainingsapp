import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db } from '../db/db'
import { setCurrentUserId } from '../db/repo'
import { stableId } from '../lib/uuid'
import { MUSCLE_IDS } from '../types/muscles'
import { buildSeed, ensureSeeded, seedExerciseId } from './seed'
import { SEED_EXERCISES, SEED_TEMPLATES } from './seedData'

const USER = '00000000-0000-4000-8000-000000000001'
const TS = '2026-11-19T10:00:00.000Z'

describe('stableId', () => {
  it('liefert für gleiche Eingaben dieselbe gültige UUID', () => {
    const a = stableId('x')
    expect(a).toBe(stableId('x'))
    expect(a).not.toBe(stableId('y'))
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('buildSeed', () => {
  const seed = buildSeed(USER, TS)

  it('legt 24 Übungen an: 20 aktive und 4 archivierte', () => {
    expect(seed.exercises).toHaveLength(24)
    expect(seed.exercises.filter((e) => e.archived)).toHaveLength(4)
    expect(seed.exercises.filter((e) => !e.archived)).toHaveLength(20)
  })

  it('hat eindeutige IDs und Schlüssel', () => {
    expect(new Set(seed.exercises.map((e) => e.id)).size).toBe(seed.exercises.length)
    expect(new Set(SEED_EXERCISES.map((e) => e.key)).size).toBe(SEED_EXERCISES.length)
    const all = [...seed.exercises, ...seed.templates, ...seed.templateExercises, ...seed.cardioTypes]
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length)
  })

  it('verwendet nur gültige Muskel-IDs, und jede Übung hat mindestens einen primären Muskel', () => {
    const valid = new Set<string>(MUSCLE_IDS)
    for (const e of seed.exercises) {
      expect(e.primary_muscles.length, e.name).toBeGreaterThan(0)
      for (const m of [...e.primary_muscles, ...e.secondary_muscles]) expect(valid.has(m), `${e.name}: ${m}`).toBe(true)
      expect(e.primary_muscles.some((m) => e.secondary_muscles.includes(m)), e.name).toBe(false)
    }
  })

  it('übernimmt Lasttyp und Seiten laut Uebungen.md', () => {
    const byKey = (key: string) => seed.exercises.find((e) => e.id === seedExerciseId(USER, key))!
    expect(byKey('biz_curls')).toMatchObject({ load_type: 'weight', sides: 2, weight_step: 2 })
    expect(byKey('dips')).toMatchObject({ load_type: 'assisted', sides: 1 })
    expect(byKey('klimmzuege')).toMatchObject({ load_type: 'assisted', sides: 1 })
    expect(byKey('seitstuetz')).toMatchObject({ load_type: 'time', sides: 2, weight_step: 15 })
    expect(byKey('unterarmstuetz')).toMatchObject({ load_type: 'time', sides: 1 })
    expect(byKey('beinheben')).toMatchObject({ load_type: 'bodyweight' })
    expect(byKey('beinpresse_liegend')).toMatchObject({ sides: 2 })
    expect(byKey('wadenheben')).toMatchObject({ sides: 2 })
    expect(byKey('adduktoren').primary_muscles).toEqual(['adductors'])
    expect(byKey('seitheben').weight_step).toBe(1)
  })

  it('legt die drei Trainings der Rotation in Reihenfolge an', () => {
    expect(seed.templates.map((t) => [t.name, t.rotation_order, t.in_rotation, t.color, t.icon])).toEqual([
      ['Oberkörper', 1, true, '#F04E5E', 'Dumbbell'],
      ['Beine & Po', 2, true, '#3B82F6', 'Footprints'],
      ['Rücken & Core', 3, true, '#84CC16', 'Activity'],
    ])
    expect(SEED_TEMPLATES.map((t) => t.exercises.length)).toEqual([7, 7, 6])
  })

  it('verknüpft Trainings nur mit vorhandenen, aktiven Übungen', () => {
    const exerciseIds = new Map(seed.exercises.map((e) => [e.id, e]))
    const templateIds = new Set(seed.templates.map((t) => t.id))
    expect(seed.templateExercises).toHaveLength(20)
    for (const link of seed.templateExercises) {
      expect(templateIds.has(link.template_id)).toBe(true)
      expect(exerciseIds.get(link.exercise_id)?.archived).toBe(false)
    }
  })

  it('legt die sieben Cardio-Arten an, Schwimmen in Metern', () => {
    expect(seed.cardioTypes.map((c) => c.name)).toEqual([
      'Stairmaster',
      'Laufband',
      'Rudergerät',
      'Crosstrainer',
      'Ergometer',
      'Schwimmen',
      'Wandern',
    ])
    expect(seed.cardioTypes.find((c) => c.name === 'Schwimmen')?.distance_unit).toBe('m')
    expect(seed.cardioTypes.find((c) => c.name === 'Stairmaster')?.distance_unit).toBe('floors')
  })

  it('schreibt Ausrüstung und Ausführung in die Notiz', () => {
    const curls = seed.exercises.find((e) => e.id === seedExerciseId(USER, 'biz_curls'))!
    expect(curls.notes).toContain('Ausrüstung: Zwei Kurzhanteln')
    expect(curls.notes).toContain('Supination')
    expect(curls.short_name).toBe('Biz. Curls')
  })

  it('setzt das Körpergewicht auf 75 kg', () => {
    expect(seed.settings.bodyweight_kg).toBe(75)
  })
})

describe('ensureSeeded', () => {
  beforeEach(async () => {
    await clearLocalData()
    setCurrentUserId(USER)
  })

  it('legt die Startdaten einmal an und merkt sie für den Upload vor', async () => {
    expect(await ensureSeeded(USER)).toBe(true)
    expect(await db.exercises.count()).toBe(24)
    expect(await db.templates.count()).toBe(3)
    expect(await db.templateExercises.count()).toBe(20)
    expect(await db.cardioTypes.count()).toBe(7)
    expect(await db.outbox.count()).toBe(1 + 24 + 3 + 20 + 7)
  })

  it('ist wiederholbar, ohne Daten zu überschreiben', async () => {
    await ensureSeeded(USER)
    const first = await db.exercises.get(seedExerciseId(USER, 'biz_curls'))
    await db.exercises.update(first!.id, { name: 'Selbst umbenannt' })
    expect(await ensureSeeded(USER)).toBe(false)
    expect((await db.exercises.get(first!.id))?.name).toBe('Selbst umbenannt')
  })
})
