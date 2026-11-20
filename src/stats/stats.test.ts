import { describe, expect, it } from 'vitest'
import type {
  GymCardioLog,
  GymCardioType,
  GymExercise,
  GymExerciseLog,
  GymSession,
  GymTemplate,
} from '../types/db'
import type { MuscleId } from '../types/muscles'
import {
  averagePerWeek,
  buildActivity,
  buildHistory,
  buildSessionStats,
  cardioStats,
  comparePeriods,
  currentStreak,
  exerciseHistory,
  exercisesWithHistory,
  heatmapWeeks,
  muscleStats,
  summarizeExercise,
  volumeBars,
  weekCounts,
  type StatsInput,
} from './compute'
import { DEFAULT_GRANULARITY, rangeFor } from './period'

const U = 'u'
const base = { user_id: U, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }

const ex = (
  id: string,
  load: GymExercise['load_type'],
  primary: MuscleId[],
  secondary: MuscleId[] = [],
  sides: 1 | 2 = 1,
): GymExercise => ({
  ...base,
  id,
  name: id,
  short_name: null,
  load_type: load,
  primary_muscles: primary,
  secondary_muscles: secondary,
  weight_step: 5,
  notes: null,
  sides,
  archived: false,
})

const tpl = (id: string, color: string, order: number): GymTemplate => ({
  ...base,
  id,
  name: id,
  color,
  icon: 'Dumbbell',
  in_rotation: true,
  rotation_order: order,
  sort: order,
  archived: false,
})

const session = (id: string, date: string, kind: GymSession['kind'], template: string | null = null): GymSession => ({
  ...base,
  id,
  kind,
  template_id: template,
  date,
  started_at: null,
  finished_at: null,
  note: null,
  source: 'app',
})

const log = (id: string, sessionId: string, exerciseId: string, over: Partial<GymExerciseLog> = {}): GymExerciseLog => ({
  ...base,
  id,
  session_id: sessionId,
  exercise_id: exerciseId,
  sets: 3,
  reps: 10,
  weight_kg: 20,
  seconds: null,
  sides: 1,
  increase_next: false,
  note: null,
  sort: 0,
  ...over,
})

const bench = ex('bench', 'weight', ['chest'], ['shoulders'])
const plank = ex('plank', 'time', ['abs'], ['obliques'])
const pull = ex('pull', 'assisted', ['upper_back'], ['biceps'])
const leg = ex('leg', 'bodyweight', ['abs'])

function input(over: Partial<StatsInput> = {}): StatsInput {
  return {
    sessions: [],
    logs: [],
    exercises: new Map([bench, plank, pull, leg].map((e) => [e.id, e])),
    templates: new Map([tpl('t1', '#F04E5E', 1), tpl('t2', '#3B82F6', 2)].map((t) => [t.id, t])),
    cardioLogs: [],
    cardioTypes: new Map(),
    bodyweightKg: 75,
    ...over,
  }
}

const TODAY = '2026-11-20' // Freitag

describe('Zeitraum', () => {
  it('liefert 28 Tage für 4 Wochen und den gleich langen Zeitraum davor', () => {
    const r = rangeFor('4w', TODAY)
    expect(r).toEqual({ from: '2026-10-24', to: TODAY, prevFrom: '2026-09-26', prevTo: '2026-10-23' })
  })

  it('rechnet 3 und 12 Monate über Monatsgrenzen und hat bei "Alles" keinen Vergleich', () => {
    expect(rangeFor('3m', TODAY).from).toBe('2026-08-21')
    expect(rangeFor('12m', TODAY).from).toBe('2025-11-21')
    expect(rangeFor('all', TODAY)).toEqual({ from: null, to: TODAY, prevFrom: null, prevTo: null })
    expect(DEFAULT_GRANULARITY['4w']).toBe('session')
  })
})

describe('Volumen', () => {
  const data = input({
    sessions: [
      session('s1', '2026-11-02', 'strength', 't1'),
      session('s2', '2026-11-16', 'strength', 't2'),
      session('s3', '2026-11-18', 'free'),
      session('s0', '2026-10-05', 'strength', 't1'),
      session('empty', '2026-11-19', 'strength', 't1'),
    ],
    logs: [
      log('l1', 's1', 'bench', { weight_kg: 50 }), // 3 × 10 × 50 = 1.500
      log('l2', 's2', 'bench', { weight_kg: 60 }), // 1.800
      log('l3', 's3', 'pull', { weight_kg: 25 }), // 3 × 10 × 50 = 1.500
      log('l4', 's3', 'plank', { reps: null, weight_kg: null, seconds: 60, sides: 1 }), // Haltezeit
      log('l0', 's0', 'bench', { weight_kg: 40 }), // 1.200
    ],
  })
  const stats = buildSessionStats(data)

  it('berechnet das Volumen je Einheit, Haltezeit getrennt, und ignoriert Einheiten ohne Einträge', () => {
    expect(stats.map((s) => [s.id, s.volume, s.holdSeconds, s.exerciseCount])).toEqual([
      ['s0', 1200, 0, 1],
      ['s1', 1500, 0, 1],
      ['s2', 1800, 0, 1],
      ['s3', 1500, 180, 2],
    ])
  })

  it('färbt nach Training, Freitraining in Bernstein', () => {
    expect(stats.find((s) => s.id === 's1')?.color).toBe('#F04E5E')
    expect(stats.find((s) => s.id === 's2')?.color).toBe('#3B82F6')
    expect(stats.find((s) => s.id === 's3')?.color).toBe('#F59E0B')
  })

  it('vergleicht mit dem vorherigen Zeitraum in Prozent', () => {
    const range = rangeFor('4w', TODAY) // 24.10.–20.11. enthält s1, s2, s3; davor s0
    const c = comparePeriods(stats, range)
    expect(c).toEqual({ current: 4800, previous: 1200, deltaPercent: 300 })
    expect(comparePeriods(stats, rangeFor('all', TODAY)).deltaPercent).toBeNull()
    expect(comparePeriods(stats, { ...range, prevFrom: '2000-01-01', prevTo: '2000-02-01' }).deltaPercent).toBeNull()
  })

  it('bildet Balken je Einheit, je Woche (lückenlos, ab Montag) und je Monat', () => {
    const range = rangeFor('4w', TODAY)
    expect(volumeBars(stats, 'session', range, TODAY).map((b) => b.volume)).toEqual([1500, 1800, 1500])

    const weeks = volumeBars(stats, 'week', range, TODAY)
    expect(weeks[0]?.key).toBe('2026-10-19') // Montag der Woche des 24.10.
    expect(weeks.map((b) => b.volume)).toEqual([0, 0, 1500, 0, 3300]) // Wochen ab 19.10., 26.10., 02.11., 09.11., 16.11.
    expect(weeks.at(-1)?.key).toBe('2026-11-16')

    const months = volumeBars(stats, 'month', rangeFor('all', TODAY), TODAY)
    expect(months.map((b) => [b.key, b.volume])).toEqual([
      ['2026-10-01', 1200],
      ['2026-11-01', 4800],
    ])
  })

  it('liefert ohne Daten keine Balken bei "Alles"', () => {
    expect(volumeBars([], 'week', rangeFor('all', TODAY), TODAY)).toEqual([])
  })
})

describe('Trainingstage und Serie', () => {
  it('zählt Wochen mit mindestens zwei Einheiten als Serie, die laufende Woche bricht sie nicht', () => {
    // Heute Freitag 20.11. (Woche ab 16.11.). Vorwochen: 09.11. (2), 02.11. (3), 26.10. (1)
    const counts = new Map([
      ['2026-11-09', 2],
      ['2026-11-02', 3],
      ['2026-10-26', 1],
    ])
    expect(currentStreak(counts, TODAY)).toBe(2) // laufende Woche hat 0, bricht nicht
    counts.set('2026-11-16', 2)
    expect(currentStreak(counts, TODAY)).toBe(3) // laufende Woche hat 2 und zählt mit
    counts.set('2026-11-16', 1)
    expect(currentStreak(counts, TODAY)).toBe(2)
    expect(currentStreak(new Map(), TODAY)).toBe(0)
  })

  it('zählt Kraft- und Freitrainings je Woche', () => {
    const stats = buildSessionStats(
      input({
        sessions: [session('a', '2026-11-16', 'strength', 't1'), session('b', '2026-11-22', 'free'), session('c', '2026-11-23', 'free')],
        logs: [log('1', 'a', 'bench'), log('2', 'b', 'bench'), log('3', 'c', 'bench')],
      }),
    )
    expect([...weekCounts(stats)]).toEqual([
      ['2026-11-16', 2], // Sonntag 22.11. gehört noch zur Woche ab Montag 16.11.
      ['2026-11-23', 1],
    ])
  })

  it('berechnet Einheiten pro Woche im Zeitraum', () => {
    const data = input({
      sessions: [1, 2, 3, 4].map((i) => session(`s${i}`, `2026-11-0${i}`, 'strength', 't1')),
      logs: [1, 2, 3, 4].map((i) => log(`l${i}`, `s${i}`, 'bench')),
    })
    const stats = buildSessionStats(data)
    expect(averagePerWeek(stats, rangeFor('4w', TODAY), TODAY)).toBeCloseTo(1) // 4 Einheiten in 4 Wochen
    expect(averagePerWeek([], rangeFor('4w', TODAY), TODAY)).toBe(0)
  })

  it('wählt die Tagesfarbe: Krafttraining vor Freitraining vor Cardio', () => {
    const data = input({
      sessions: [session('c', '2026-11-18', 'cardio'), session('a', '2026-11-18', 'strength', 't2'), session('f', '2026-11-19', 'free')],
      logs: [log('1', 'a', 'bench'), log('2', 'f', 'bench')],
      cardioLogs: [{ ...base, id: 'cl', session_id: 'c', cardio_type_id: 'x', duration_min: 20, kcal: null, avg_hr: null, distance: null, note: null }],
    })
    const activity = buildActivity(data, buildSessionStats(data))
    expect(activity.get('2026-11-18')).toMatchObject({ color: '#3B82F6', kinds: ['strength', 'cardio'] })
    expect(activity.get('2026-11-19')?.color).toBe('#F59E0B')
  })

  it('begrenzt die Heatmap auf höchstens 53 Wochen, immer ab Montag', () => {
    const weeks = heatmapWeeks(rangeFor('all', TODAY), TODAY, '2022-10-10')
    expect(weeks).toHaveLength(53)
    expect(weeks.at(-1)).toBe('2026-11-16')
    expect(weeks.every((w) => new Date(`${w}T00:00:00`).getDay() === 1)).toBe(true)
    expect(heatmapWeeks(rangeFor('4w', TODAY), TODAY, null)).toHaveLength(5)
  })
})

describe('Muskelgruppen', () => {
  const data = input({
    sessions: [session('s1', '2026-11-16', 'strength', 't1'), session('old', '2026-01-05', 'strength', 't1')],
    logs: [
      log('l1', 's1', 'bench', { weight_kg: 50 }), // Volumen 1.500
      log('l2', 's1', 'plank', { reps: null, weight_kg: null, seconds: 60 }),
      log('l3', 's1', 'leg', { weight_kg: 0 }),
      log('l4', 'old', 'bench', { weight_kg: 100 }),
    ],
  })

  it('gewichtet primäre Muskeln mit 100 % und sekundäre mit 50 % nach Volumen', () => {
    const { totals, byMuscle } = muscleStats(data, '2026-11-01', TODAY, 'volume')
    expect(totals).toEqual({ chest: 1500, shoulders: 750 })
    expect(byMuscle.chest?.[0]).toMatchObject({ role: 'primary', value: 1500 })
    expect(byMuscle.shoulders?.[0]).toMatchObject({ role: 'secondary', value: 750 })
  })

  it('zählt nach Sätzen auch Zeit- und Körpergewichtsübungen', () => {
    const { totals } = muscleStats(data, '2026-11-01', TODAY, 'sets')
    expect(totals).toEqual({ chest: 3, shoulders: 1.5, abs: 6, obliques: 1.5 })
  })

  it('beachtet den Zeitraum', () => {
    expect(muscleStats(data, null, TODAY, 'volume').totals.chest).toBe(1500 + 3000)
    expect(muscleStats(data, '2026-12-01', '2026-12-31', 'volume').totals).toEqual({})
  })
})

describe('Übungsverlauf', () => {
  const data = input({
    sessions: [session('a', '2026-11-02', 'strength', 't1'), session('b', '2026-11-09', 'strength', 't1'), session('c', '2026-11-16', 'strength', 't1')],
    logs: [
      log('1', 'a', 'bench', { weight_kg: 50, reps: 10 }),
      log('2', 'b', 'bench', { weight_kg: 60, reps: 8 }),
      log('3', 'c', 'bench', { weight_kg: 60, reps: 10 }),
      log('4', 'a', 'pull', { weight_kg: 30 }),
      log('5', 'b', 'pull', { weight_kg: 10 }),
      log('6', 'c', 'pull', { weight_kg: 10, reps: 12 }),
    ],
  })

  it('sortiert nach Datum und liefert Volumen je Eintrag', () => {
    const history = exerciseHistory('bench', data)
    expect(history.map((h) => [h.date, h.volume])).toEqual([
      ['2026-11-02', 1500],
      ['2026-11-09', 1440],
      ['2026-11-16', 1800],
    ])
  })

  it('findet Bestwert, ersten und letzten Eintrag: Gewicht = höchstes Gewicht, bei Gleichstand mehr Wiederholungen', () => {
    const s = summarizeExercise(exerciseHistory('bench', data), 'weight')
    expect(s.first?.date).toBe('2026-11-02')
    expect(s.last?.date).toBe('2026-11-16')
    expect(s.best?.date).toBe('2026-11-16')
  })

  it('wertet bei Unterstützung die geringste Unterstützung als Bestwert', () => {
    const s = summarizeExercise(exerciseHistory('pull', data), 'assisted')
    expect(s.best?.date).toBe('2026-11-16') // 10 kg wie am 09.11., aber mehr Wiederholungen
    expect(summarizeExercise([], 'weight')).toEqual({ first: null, last: null, best: null })
  })

  it('listet nur Übungen mit Historie, zuletzt trainierte zuerst', () => {
    const items = exercisesWithHistory(data)
    expect(items.map((i) => [i.exercise.id, i.count])).toEqual([
      ['bench', 3],
      ['pull', 3],
    ])
  })
})

describe('Cardio', () => {
  const type = (id: string, name: string, sort: number, unit: 'km' | 'm' = 'km'): GymCardioType => ({
    ...base,
    id,
    name,
    icon: 'Activity',
    distance_unit: unit,
    sort,
    archived: false,
  })
  const clog = (id: string, sessionId: string, typeId: string, over: Partial<GymCardioLog> = {}): GymCardioLog => ({
    ...base,
    id,
    session_id: sessionId,
    cardio_type_id: typeId,
    duration_min: null,
    kcal: null,
    avg_hr: null,
    distance: null,
    note: null,
    ...over,
  })
  const data = input({
    sessions: [session('a', '2026-11-02', 'cardio'), session('b', '2026-11-10', 'cardio'), session('c', '2026-11-12', 'cardio')],
    cardioTypes: new Map([type('run', 'Laufband', 1), type('swim', 'Schwimmen', 2, 'm')].map((t) => [t.id, t])),
    cardioLogs: [
      clog('1', 'a', 'run', { duration_min: 30, distance: 5 }),
      clog('2', 'b', 'run', { duration_min: 20, distance: 3 }),
      clog('3', 'c', 'swim', { duration_min: 40, distance: 1500 }),
    ],
  })
  const range = rangeFor('4w', TODAY)

  it('summiert Minuten je Woche und Art mit festen Farben je Art', () => {
    const c = cardioStats(data, range, TODAY, 'duration')
    // Farbe nach Position der Art in der sortierten Artenliste, nicht nach Rang im Zeitraum
    expect(c.series.map((s) => [s.name, s.color])).toEqual([
      ['Laufband', '#2a78d6'],
      ['Schwimmen', '#eb6834'],
    ])
    expect(c.weeks.map((w) => w.total)).toEqual([0, 0, 30, 60, 0]) // Wochen ab 19.10., 26.10., 02.11., 09.11., 16.11.
    expect(c.total).toBe(90)
  })

  it('rechnet Meter in Kilometer um', () => {
    const c = cardioStats(data, range, TODAY, 'distance')
    expect(c.total).toBeCloseTo(5 + 3 + 1.5)
  })

  it('lässt Arten ohne Wert weg und liefert ohne Daten leere Listen', () => {
    expect(cardioStats(data, range, TODAY, 'kcal')).toEqual({ series: [], weeks: [], total: 0 })
  })
})

describe('Verlauf', () => {
  it('listet alle Einheiten, jüngste zuerst, und markiert Importe', () => {
    const data = input({
      sessions: [
        session('a', '2026-11-02', 'strength', 't1'),
        { ...session('b', '2026-11-09', 'free'), source: 'import' },
        session('c', '2026-11-10', 'cardio'),
        session('empty', '2026-11-11', 'strength', 't1'),
      ],
      logs: [log('1', 'a', 'bench'), log('2', 'b', 'bench'), log('3', 'b', 'pull')],
      cardioLogs: [{ ...base, id: 'cl', session_id: 'c', cardio_type_id: 'run', duration_min: 20, kcal: null, avg_hr: null, distance: null, note: null }],
      cardioTypes: new Map([['run', { ...base, id: 'run', name: 'Laufband', icon: 'Activity', distance_unit: 'km' as const, sort: 0, archived: false }]]),
    })
    const items = buildHistory(data, buildSessionStats(data))
    expect(items.map((i) => [i.id, i.name, i.subtitle, i.imported])).toEqual([
      ['c', 'Cardio', 'Laufband', false],
      ['b', 'Freitraining', '2 Übungen', true],
      ['a', 'Training 1 · t1', '1 Übung', false],
    ])
  })
})
