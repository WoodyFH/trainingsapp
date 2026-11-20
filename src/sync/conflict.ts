/**
 * Konfliktlogik: "Letzte Änderung gewinnt" anhand von updated_at.
 * Diese Funktionen sind frei von Seiteneffekten und einzeln testbar.
 */

interface Versioned {
  updated_at: string
}

function time(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/**
 * Entscheidet, ob ein vom Server geholter Stand die lokale Zeile ersetzen soll.
 *
 * - Keine lokale Zeile: übernehmen.
 * - Remote strikt neuer: übernehmen. Eine eventuell wartende lokale Änderung ist dann
 *   älter und wird vom Server beim Hochladen ohnehin verworfen.
 * - Remote älter: behalten.
 * - Gleicher Zeitstempel: übernehmen, außer die lokale Zeile wartet noch auf den Upload
 *   (dann ist sie der jüngste Stand dieses Geräts).
 */
export function shouldApplyRemote(
  local: Versioned | undefined,
  remote: Versioned,
  hasPendingLocalChange: boolean,
): boolean {
  if (!local) return true
  const l = time(local.updated_at)
  const r = time(remote.updated_at)
  if (r > l) return true
  if (r < l) return false
  return !hasPendingLocalChange
}

/** Der jüngere von zwei Ständen (bei Gleichstand der erste). */
export function lastWriteWins<T extends Versioned>(a: T, b: T): T {
  return time(b.updated_at) > time(a.updated_at) ? b : a
}

/** Größter server_updated_at-Wert einer Seite von Zeilen (für den Pull-Cursor). */
export function maxServerTimestamp(rows: { server_updated_at?: string | null }[], fallback: string): string {
  let best = fallback
  for (const r of rows) {
    const s = r.server_updated_at
    if (s && Date.parse(s) > Date.parse(best)) best = s
  }
  return best
}
