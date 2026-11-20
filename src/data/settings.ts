import { db } from '../db/db'
import { saveRow } from '../db/repo'
import { DEFAULT_BODYWEIGHT_KG } from '../seed/seedData'

/** Speichert das Körpergewicht für die Volumenberechnung (nur dieser eine Wert, kein Verlauf). */
export async function setBodyweight(userId: string, kg: number): Promise<void> {
  if (!(kg > 0) || kg > 500) return
  const current = await db.settings.get(userId)
  await saveRow('settings', {
    user_id: userId,
    bodyweight_kg: kg,
    updated_at: current?.updated_at ?? new Date().toISOString(),
  })
}

export { DEFAULT_BODYWEIGHT_KG }
