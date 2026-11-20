import { clearLocalData, getMeta, setMeta } from './db'

const LOCAL_USER_META = 'localUserId'

/**
 * Stellt sicher, dass die lokale Datenbank zum angemeldeten Konto gehört.
 * Wechselt das Konto auf diesem Gerät, werden die Daten des vorigen Kontos entfernt.
 */
export async function ensureLocalUser(userId: string): Promise<void> {
  const stored = await getMeta<string>(LOCAL_USER_META)
  if (stored && stored !== userId) await clearLocalData()
  await setMeta(LOCAL_USER_META, userId)
}
