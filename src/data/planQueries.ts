import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { GymExercise, GymTemplate, GymTemplateExercise } from '../types/db'
import { exerciseHistoryCount } from './plans'

/** Alle nicht gelöschten Trainings (auch archivierte). */
export function useAllTemplates(): GymTemplate[] | undefined {
  return useLiveQuery(async () => (await db.templates.toArray()).filter((t) => !t.deleted_at), [])
}

export interface TemplateLink {
  link: GymTemplateExercise
  exercise: GymExercise
}

/** Übungen eines Trainings in Plan-Reihenfolge, auch archivierte (mit Hinweis im UI). */
export function useTemplateLinks(templateId: string | undefined): TemplateLink[] | undefined {
  return useLiveQuery(async () => {
    if (!templateId) return []
    const links = (await db.templateExercises.where('template_id').equals(templateId).toArray())
      .filter((l) => !l.deleted_at)
      .sort((a, b) => a.sort - b.sort)
    const exercises = await db.exercises.bulkGet(links.map((l) => l.exercise_id))
    const result: TemplateLink[] = []
    links.forEach((link, i) => {
      const exercise = exercises[i]
      if (exercise && !exercise.deleted_at) result.push({ link, exercise })
    })
    return result
  }, [templateId])
}

/** Anzahl aktiver Übungen je Training. */
export function useTemplateExerciseCounts(): Map<string, number> | undefined {
  return useLiveQuery(async () => {
    const links = (await db.templateExercises.toArray()).filter((l) => !l.deleted_at)
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
    const counts = new Map<string, number>()
    for (const l of links) {
      const e = exercises.get(l.exercise_id)
      if (!e || e.deleted_at || e.archived) continue
      counts.set(l.template_id, (counts.get(l.template_id) ?? 0) + 1)
    }
    return counts
  }, [])
}

/** Eine Übung (auch archivierte). null = gibt es nicht. */
export function useExercise(id: string | undefined): GymExercise | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null
    const e = await db.exercises.get(id)
    return e && !e.deleted_at ? e : null
  }, [id])
}

export function useExerciseHistoryCount(id: string | undefined): number | undefined {
  return useLiveQuery(async () => (id ? exerciseHistoryCount(id) : 0), [id])
}
