import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db } from '../db/db'
import { setCurrentUserId } from '../db/repo'
import { saveExerciseLog } from './sessions'
import {
  addExerciseToTemplate,
  createExercise,
  createTemplate,
  moveInRotation,
  removeExercise,
  removeTemplateLink,
  reorderTemplateLinks,
  setExerciseArchived,
  setInRotation,
  setTemplateArchived,
  updateExercise,
  updateTemplate,
  validateExercise,
  type ExerciseInput,
} from './plans'

const USER = '00000000-0000-4000-8000-000000000001'

const exerciseInput = (over: Partial<ExerciseInput> = {}): ExerciseInput => ({
  name: 'Bankdrücken',
  short_name: ' Brust 1 ',
  load_type: 'weight',
  sides: 1,
  weight_step: 5,
  notes: '  ',
  primary_muscles: ['chest'],
  secondary_muscles: ['shoulders'],
  ...over,
})

const tpl = (name: string) => createTemplate({ name, color: '#F04E5E', icon: 'Dumbbell' })

async function rotationOrders(): Promise<Record<string, number | null>> {
  const all = (await db.templates.toArray()).filter((t) => !t.deleted_at)
  return Object.fromEntries(all.map((t) => [t.name, t.in_rotation ? t.rotation_order : null]))
}

beforeEach(async () => {
  await clearLocalData()
  setCurrentUserId(USER)
})

describe('Rotation', () => {
  it('nimmt neue Trainings hinten auf und nummeriert lückenlos', async () => {
    const a = await tpl('A')
    const b = await tpl('B')
    const c = await tpl('C')
    await setInRotation(a.id, true)
    await setInRotation(b.id, true)
    await setInRotation(c.id, true)
    expect(await rotationOrders()).toEqual({ A: 1, B: 2, C: 3 })

    await setInRotation(b.id, false)
    expect(await rotationOrders()).toEqual({ A: 1, B: null, C: 2 })
  })

  it('verschiebt Trainings nach vorn und hinten, aber nicht über den Rand', async () => {
    const a = await tpl('A')
    const b = await tpl('B')
    const c = await tpl('C')
    for (const t of [a, b, c]) await setInRotation(t.id, true)

    await moveInRotation(c.id, -1)
    expect(await rotationOrders()).toEqual({ A: 1, B: 3, C: 2 })
    await moveInRotation(a.id, -1)
    expect(await rotationOrders()).toEqual({ A: 1, B: 3, C: 2 })
    await moveInRotation(b.id, 1)
    expect(await rotationOrders()).toEqual({ A: 1, B: 3, C: 2 })
    await moveInRotation(a.id, 1)
    expect(await rotationOrders()).toEqual({ A: 2, B: 3, C: 1 })
  })

  it('nimmt archivierte Trainings aus der Rotation und lässt sie nicht wieder hinein', async () => {
    const a = await tpl('A')
    const b = await tpl('B')
    await setInRotation(a.id, true)
    await setInRotation(b.id, true)
    await setTemplateArchived(a.id, true)
    expect(await rotationOrders()).toEqual({ A: null, B: 1 })
    await setInRotation(a.id, true)
    expect(await rotationOrders()).toEqual({ A: null, B: 1 })
    await setTemplateArchived(a.id, false)
    expect((await db.templates.get(a.id))?.archived).toBe(false)
  })

  it('benennt um, ohne den Namen leer zu machen', async () => {
    const a = await tpl('Alt')
    await updateTemplate(a.id, { name: '  Neu  ', color: '#3B82F6' })
    expect(await db.templates.get(a.id)).toMatchObject({ name: 'Neu', color: '#3B82F6' })
    await updateTemplate(a.id, { name: '   ' })
    expect((await db.templates.get(a.id))?.name).toBe('Neu')
  })
})

describe('Übungen eines Trainings', () => {
  it('fügt hinten an, verhindert Dubletten und belebt entfernte Übungen wieder', async () => {
    const t = await tpl('T')
    const e1 = await createExercise(exerciseInput({ name: 'E1' }))
    const e2 = await createExercise(exerciseInput({ name: 'E2' }))
    await addExerciseToTemplate(t.id, e1.id)
    await addExerciseToTemplate(t.id, e2.id)
    await addExerciseToTemplate(t.id, e1.id)

    const live = async () =>
      (await db.templateExercises.toArray()).filter((l) => !l.deleted_at).sort((a, b) => a.sort - b.sort)
    let links = await live()
    expect(links.map((l) => [l.exercise_id, l.sort])).toEqual([
      [e1.id, 0],
      [e2.id, 1],
    ])

    await removeTemplateLink(links[0]!.id)
    await addExerciseToTemplate(t.id, e1.id)
    links = await live()
    expect(links).toHaveLength(2)
    expect(links.find((l) => l.exercise_id === e1.id)?.sort).toBe(2)
    expect(await db.templateExercises.count()).toBe(2) // wiederbelebt, nicht doppelt angelegt
  })

  it('speichert die neue Reihenfolge und ändert nur, was sich verschoben hat', async () => {
    const t = await tpl('T')
    const ids: string[] = []
    for (const name of ['A', 'B', 'C']) {
      const e = await createExercise(exerciseInput({ name }))
      await addExerciseToTemplate(t.id, e.id)
      ids.push(e.id)
    }
    const links = (await db.templateExercises.toArray()).sort((a, b) => a.sort - b.sort)
    const [la, lb, lc] = links as [(typeof links)[number], (typeof links)[number], (typeof links)[number]]
    await db.outbox.clear()
    await reorderTemplateLinks(t.id, [lc.id, la.id, lb.id])

    const after = (await db.templateExercises.toArray()).sort((a, b) => a.sort - b.sort)
    expect(after.map((l) => l.exercise_id)).toEqual([ids[2], ids[0], ids[1]])
    expect(await db.outbox.count()).toBe(3)

    await db.outbox.clear()
    await reorderTemplateLinks(t.id, [lc.id, la.id, lb.id])
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('Übungsbibliothek', () => {
  it('prüft Name, primären Muskel und Schritt', () => {
    expect(validateExercise(exerciseInput())).toBeNull()
    expect(validateExercise(exerciseInput({ name: '  ' }))).toContain('Namen')
    expect(validateExercise(exerciseInput({ primary_muscles: [] }))).toContain('primären Muskel')
    expect(validateExercise(exerciseInput({ weight_step: 0 }))).toContain('Schritt')
  })

  it('bereinigt Eingaben und trennt primäre von sekundären Muskeln', async () => {
    const e = await createExercise(
      exerciseInput({ primary_muscles: ['chest'], secondary_muscles: ['chest', 'shoulders'] }),
    )
    expect(e).toMatchObject({ short_name: 'Brust 1', notes: null, secondary_muscles: ['shoulders'], archived: false })
    await expect(createExercise(exerciseInput({ name: '' }))).rejects.toThrow('Namen')
  })

  it('aktualisiert eine Übung', async () => {
    const e = await createExercise(exerciseInput())
    const updated = await updateExercise(e.id, exerciseInput({ name: 'Bankdrücken Kurzhantel', sides: 2, weight_step: 2 }))
    expect(updated).toMatchObject({ name: 'Bankdrücken Kurzhantel', sides: 2, weight_step: 2 })
  })

  it('löscht eine Übung ohne Historie und nimmt sie aus den Trainings', async () => {
    const t = await tpl('T')
    const e = await createExercise(exerciseInput())
    await addExerciseToTemplate(t.id, e.id)
    expect(await removeExercise(e.id)).toBe('deleted')
    expect((await db.exercises.get(e.id))?.deleted_at).not.toBeNull()
    expect((await db.templateExercises.toArray()).every((l) => l.deleted_at)).toBe(true)
  })

  it('archiviert eine Übung mit Historie statt sie zu löschen', async () => {
    const e = await createExercise(exerciseInput())
    await saveExerciseLog({ kind: 'free', templateId: null, date: '2026-11-19' }, e, {
      sets: 3,
      reps: 10,
      weight_kg: 50,
      seconds: null,
      increase_next: false,
      note: null,
    })
    expect(await removeExercise(e.id)).toBe('archived')
    expect(await db.exercises.get(e.id)).toMatchObject({ archived: true, deleted_at: null })
    await setExerciseArchived(e.id, false)
    expect((await db.exercises.get(e.id))?.archived).toBe(false)
  })
})
