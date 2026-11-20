import { saveCardioLog } from '../data/sessions'
import { db } from '../db/db'

/** Hilfen für Tests (nicht Teil der App). */

/** Legt einen Cardio-Eintrag mit der Art "Stairmaster" an. */
export async function createCardioEntry(date = '2026-11-18') {
  const type = (await db.cardioTypes.toArray()).find((t) => t.name === 'Stairmaster')
  if (!type) throw new Error('Keine Cardio-Art vorhanden')
  return saveCardioLog(date, type.id, { duration_min: 30, kcal: 300, avg_hr: 140, distance: 5, note: 'Test' })
}
