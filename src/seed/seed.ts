import { db } from '../db/db'
import { saveRows } from '../db/repo'
import { stableId } from '../lib/uuid'
import type {
  GymCardioType,
  GymExercise,
  GymSettings,
  GymTemplate,
  GymTemplateExercise,
} from '../types/db'
import {
  DEFAULT_BODYWEIGHT_KG,
  SEED_CARDIO_TYPES,
  SEED_EXERCISES,
  SEED_TEMPLATES,
  type SeedExercise,
} from './seedData'

/** Stabile IDs: Gleiche Eingabe ergibt auf jedem Gerät dieselbe ID (keine Duplikate beim ersten Start). */
export const seedExerciseId = (userId: string, key: string) => stableId(`${userId}:exercise:${key}`)
export const seedTemplateId = (userId: string, key: string) => stableId(`${userId}:template:${key}`)
export const seedCardioTypeId = (userId: string, key: string) => stableId(`${userId}:cardio:${key}`)
const seedLinkId = (userId: string, templateKey: string, exerciseKey: string) =>
  stableId(`${userId}:link:${templateKey}:${exerciseKey}`)

function notesFor(e: SeedExercise): string {
  const parts = [`Ausrüstung: ${e.equipment}`, `Ausführung: ${e.execution}`]
  if (e.hint) parts.push(`Hinweis: ${e.hint}`)
  return parts.join('\n')
}

export interface SeedBundle {
  settings: GymSettings
  exercises: GymExercise[]
  templates: GymTemplate[]
  templateExercises: GymTemplateExercise[]
  cardioTypes: GymCardioType[]
}

/** Baut alle Startdaten als reine Daten (ohne Datenbankzugriff). */
export function buildSeed(userId: string, ts: string): SeedBundle {
  const base = { user_id: userId, created_at: ts, updated_at: ts, deleted_at: null }

  const exercises: GymExercise[] = SEED_EXERCISES.map((e) => ({
    ...base,
    id: seedExerciseId(userId, e.key),
    name: e.name,
    short_name: e.shortName,
    load_type: e.loadType,
    primary_muscles: [...e.primary],
    secondary_muscles: [...e.secondary],
    weight_step: e.weightStep,
    notes: notesFor(e),
    sides: e.sides,
    archived: e.archived ?? false,
  }))

  const templates: GymTemplate[] = SEED_TEMPLATES.map((t, i) => ({
    ...base,
    id: seedTemplateId(userId, t.key),
    name: t.name,
    color: t.color,
    icon: t.icon,
    in_rotation: true,
    rotation_order: i + 1,
    sort: i,
    archived: false,
  }))

  const templateExercises: GymTemplateExercise[] = SEED_TEMPLATES.flatMap((t) =>
    t.exercises.map((exerciseKey, i) => ({
      ...base,
      id: seedLinkId(userId, t.key, exerciseKey),
      template_id: seedTemplateId(userId, t.key),
      exercise_id: seedExerciseId(userId, exerciseKey),
      sort: i,
    })),
  )

  const cardioTypes: GymCardioType[] = SEED_CARDIO_TYPES.map((c, i) => ({
    ...base,
    id: seedCardioTypeId(userId, c.key),
    name: c.name,
    icon: c.icon,
    distance_unit: c.distanceUnit,
    sort: i,
    archived: false,
  }))

  return {
    settings: { user_id: userId, bodyweight_kg: DEFAULT_BODYWEIGHT_KG, updated_at: ts },
    exercises,
    templates,
    templateExercises,
    cardioTypes,
  }
}

/**
 * Legt die Startdaten an, falls für dieses Konto noch keine Einstellungen existieren.
 * Muss NACH dem ersten erfolgreichen Abgleich mit dem Server laufen, sonst könnten Startdaten
 * bereits bearbeitete Daten überschreiben. Gibt true zurück, wenn etwas angelegt wurde.
 */
export async function ensureSeeded(userId: string): Promise<boolean> {
  if (await db.settings.get(userId)) return false
  const seed = buildSeed(userId, new Date().toISOString())
  await saveRows('settings', [seed.settings])
  await saveRows('exercises', seed.exercises)
  await saveRows('templates', seed.templates)
  await saveRows('templateExercises', seed.templateExercises)
  await saveRows('cardioTypes', seed.cardioTypes)
  return true
}
