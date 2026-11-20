import { db } from '../db/db'
import { buildRow, saveRow, saveRows, softDeleteRow } from '../db/repo'
import type { GymExercise, GymTemplate, GymTemplateExercise, LoadType, Sides } from '../types/db'
import type { MuscleId } from '../types/muscles'

/** Pläne (Trainings) und Übungsbibliothek verwalten. Alles lokal zuerst (Outbox). */

// ---------------------------------------------------------------------------
// Trainings
// ---------------------------------------------------------------------------

async function liveTemplates(): Promise<GymTemplate[]> {
  return (await db.templates.toArray()).filter((t) => !t.deleted_at)
}

export async function createTemplate(input: { name: string; color: string; icon: string }): Promise<GymTemplate> {
  const all = await liveTemplates()
  const sort = all.reduce((max, t) => Math.max(max, t.sort), -1) + 1
  const row = buildRow('templates', {
    name: input.name.trim(),
    color: input.color,
    icon: input.icon,
    in_rotation: false,
    rotation_order: null,
    sort,
    archived: false,
  })
  return saveRow('templates', row)
}

export async function updateTemplate(
  id: string,
  patch: Partial<Pick<GymTemplate, 'name' | 'color' | 'icon'>>,
): Promise<void> {
  const t = await db.templates.get(id)
  if (!t || t.deleted_at) return
  const next = { ...t, ...patch, name: patch.name !== undefined ? patch.name.trim() || t.name : t.name }
  await saveRow('templates', next)
}

/** Trainings der Rotation in Reihenfolge. */
function rotationList(all: GymTemplate[]): GymTemplate[] {
  return all
    .filter((t) => t.in_rotation && !t.archived)
    .sort((a, b) => (a.rotation_order ?? 999) - (b.rotation_order ?? 999) || a.sort - b.sort)
}

/** Nummeriert die Rotation lückenlos 1…n und speichert nur, was sich ändert. */
async function compactRotation(): Promise<void> {
  const list = rotationList(await liveTemplates())
  const changed: GymTemplate[] = []
  list.forEach((t, i) => {
    if (t.rotation_order !== i + 1) changed.push({ ...t, rotation_order: i + 1 })
  })
  await saveRows('templates', changed)
}

export async function setInRotation(id: string, on: boolean): Promise<void> {
  const t = await db.templates.get(id)
  if (!t || t.deleted_at) return
  if (on) {
    if (t.archived) return
    const max = rotationList(await liveTemplates()).reduce((m, x) => Math.max(m, x.rotation_order ?? 0), 0)
    await saveRow('templates', { ...t, in_rotation: true, rotation_order: max + 1 })
  } else {
    await saveRow('templates', { ...t, in_rotation: false, rotation_order: null })
  }
  await compactRotation()
}

/** Verschiebt ein Training in der Rotation um eine Position (−1 nach vorn, +1 nach hinten). */
export async function moveInRotation(id: string, direction: -1 | 1): Promise<void> {
  const list = rotationList(await liveTemplates())
  const index = list.findIndex((t) => t.id === id)
  const target = index + direction
  if (index === -1 || target < 0 || target >= list.length) return
  const reordered = [...list]
  const [moved] = reordered.splice(index, 1)
  if (!moved) return
  reordered.splice(target, 0, moved)
  const changed: GymTemplate[] = []
  reordered.forEach((t, i) => {
    if (t.rotation_order !== i + 1) changed.push({ ...t, rotation_order: i + 1 })
  })
  await saveRows('templates', changed)
}

/** Archivieren nimmt das Training auch aus der Rotation. Der Verlauf bleibt erhalten. */
export async function setTemplateArchived(id: string, archived: boolean): Promise<void> {
  const t = await db.templates.get(id)
  if (!t || t.deleted_at) return
  await saveRow(
    'templates',
    archived ? { ...t, archived: true, in_rotation: false, rotation_order: null } : { ...t, archived: false },
  )
  if (archived) await compactRotation()
}

// ---------------------------------------------------------------------------
// Übungen eines Trainings
// ---------------------------------------------------------------------------

async function linksOf(templateId: string): Promise<GymTemplateExercise[]> {
  return db.templateExercises.where('template_id').equals(templateId).toArray()
}

export async function addExerciseToTemplate(templateId: string, exerciseId: string): Promise<void> {
  const links = await linksOf(templateId)
  const max = links.filter((l) => !l.deleted_at).reduce((m, l) => Math.max(m, l.sort), -1)
  const existing = links.find((l) => l.exercise_id === exerciseId)
  if (existing && !existing.deleted_at) return
  if (existing) {
    await saveRow('templateExercises', { ...existing, deleted_at: null, sort: max + 1 })
    return
  }
  await saveRow(
    'templateExercises',
    buildRow('templateExercises', { template_id: templateId, exercise_id: exerciseId, sort: max + 1 }),
  )
}

export async function removeTemplateLink(linkId: string): Promise<void> {
  await softDeleteRow('templateExercises', linkId)
}

/** Speichert die neue Reihenfolge (nur geänderte Zeilen). */
export async function reorderTemplateLinks(templateId: string, orderedLinkIds: string[]): Promise<void> {
  const links = new Map((await linksOf(templateId)).map((l) => [l.id, l]))
  const changed: GymTemplateExercise[] = []
  orderedLinkIds.forEach((id, i) => {
    const link = links.get(id)
    if (link && !link.deleted_at && link.sort !== i) changed.push({ ...link, sort: i })
  })
  await saveRows('templateExercises', changed)
}

// ---------------------------------------------------------------------------
// Übungsbibliothek
// ---------------------------------------------------------------------------

export interface ExerciseInput {
  name: string
  short_name: string | null
  load_type: LoadType
  sides: Sides
  weight_step: number
  notes: string | null
  primary_muscles: MuscleId[]
  secondary_muscles: MuscleId[]
}

/** Prüft die Eingaben des Übungseditors. Gibt eine Fehlermeldung zurück oder null. */
export function validateExercise(input: ExerciseInput): string | null {
  if (!input.name.trim()) return 'Bitte einen Namen eingeben.'
  if (input.primary_muscles.length === 0) return 'Wähle mindestens einen primären Muskel am Männchen aus.'
  if (!(input.weight_step > 0)) return 'Der Schritt muss größer als 0 sein.'
  return null
}

function normalize(input: ExerciseInput): ExerciseInput {
  return {
    ...input,
    name: input.name.trim(),
    short_name: input.short_name?.trim() ? input.short_name.trim() : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    // Ein Muskel ist entweder primär oder sekundär, nie beides.
    secondary_muscles: input.secondary_muscles.filter((m) => !input.primary_muscles.includes(m)),
  }
}

export async function createExercise(input: ExerciseInput): Promise<GymExercise> {
  const error = validateExercise(input)
  if (error) throw new Error(error)
  return saveRow('exercises', buildRow('exercises', { ...normalize(input), archived: false }))
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<GymExercise> {
  const error = validateExercise(input)
  if (error) throw new Error(error)
  const current = await db.exercises.get(id)
  if (!current || current.deleted_at) throw new Error('Die Übung gibt es nicht mehr.')
  return saveRow('exercises', { ...current, ...normalize(input) })
}

/** Anzahl der Einträge (Historie) einer Übung. */
export async function exerciseHistoryCount(id: string): Promise<number> {
  return (await db.exerciseLogs.where('exercise_id').equals(id).toArray()).filter((l) => !l.deleted_at).length
}

export async function setExerciseArchived(id: string, archived: boolean): Promise<void> {
  const e = await db.exercises.get(id)
  if (!e || e.deleted_at) return
  await saveRow('exercises', { ...e, archived })
}

/**
 * Entfernt eine Übung. Hat sie Historie, wird sie nur archiviert (die Einträge bleiben lesbar),
 * sonst gelöscht und aus allen Trainings genommen.
 */
export async function removeExercise(id: string): Promise<'deleted' | 'archived'> {
  if ((await exerciseHistoryCount(id)) > 0) {
    await setExerciseArchived(id, true)
    return 'archived'
  }
  const links = (await db.templateExercises.where('exercise_id').equals(id).toArray()).filter((l) => !l.deleted_at)
  for (const link of links) await softDeleteRow('templateExercises', link.id)
  await softDeleteRow('exercises', id)
  return 'deleted'
}
