import { db, getMeta, setMeta, type OutboxEntry } from '../db/db'
import { SYNC_TABLES, type SyncTableConfig } from '../db/tables'
import { maxServerTimestamp, shouldApplyRemote } from './conflict'
import { onLocalChange } from './bus'
import { syncStatus } from './status'

/** Minimale Schnittstelle zum Server (in Tests durch eine Attrappe ersetzbar). */
export interface SyncClient {
  upsert(remote: string, rows: Record<string, unknown>[], onConflict: string): Promise<{ error: { message: string } | null }>
  fetchSince(
    remote: string,
    since: string,
    limit: number,
  ): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
}

export const PUSH_BATCH = 200
export const PULL_PAGE = 1000
const EPOCH = '1970-01-01T00:00:00.000Z'

export const INITIAL_PULL_META = 'initialPullUser'

const cursorKey = (cfg: SyncTableConfig) => `cursor:${cfg.remote}`

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

/** Netzwerkfehler (kein Zugriff auf den Server) sind kein "Fehler", sondern "offline". */
export function isNetworkError(message: string): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|offline/i.test(message)
}

/** Lädt alle vorgemerkten lokalen Änderungen hoch (Eltern-Tabellen zuerst). */
export async function pushChanges(client: SyncClient): Promise<number> {
  let pushed = 0
  for (const cfg of SYNC_TABLES) {
    for (;;) {
      const entries = await db.outbox.where('table').equals(cfg.local).limit(PUSH_BATCH).toArray()
      if (entries.length === 0) break

      const rows: Record<string, unknown>[] = []
      const sent: OutboxEntry[] = []
      for (const entry of entries) {
        const row = (await db.table(cfg.local).get(entry.pk)) as Record<string, unknown> | undefined
        if (!row) {
          await db.outbox.delete(entry.key)
          continue
        }
        const { server_updated_at: _ignored, ...payload } = row
        void _ignored
        rows.push(payload)
        sent.push(entry)
      }
      if (rows.length === 0) continue

      const { error } = await client.upsert(cfg.remote, rows, cfg.pk)
      if (error) {
        await db.transaction('rw', db.outbox, async () => {
          for (const entry of sent) {
            await db.outbox.update(entry.key, { attempts: entry.attempts + 1, lastError: error.message })
          }
        })
        throw new Error(error.message)
      }

      // Nur Einträge entfernen, die sich seitdem nicht erneut geändert haben.
      await db.transaction('rw', db.outbox, async () => {
        for (const entry of sent) {
          const current = await db.outbox.get(entry.key)
          if (current && current.queuedAt === entry.queuedAt) await db.outbox.delete(entry.key)
        }
      })
      pushed += rows.length
    }
  }
  return pushed
}

/** Holt Änderungen vom Server (seit dem letzten Stand je Tabelle) und wendet sie per "letzte Änderung gewinnt" an. */
export async function pullChanges(client: SyncClient): Promise<number> {
  let applied = 0
  for (const cfg of SYNC_TABLES) {
    let cursor = (await getMeta<string>(cursorKey(cfg))) ?? EPOCH
    for (;;) {
      const { data, error } = await client.fetchSince(cfg.remote, cursor, PULL_PAGE)
      if (error) throw new Error(error.message)
      const rows = data ?? []

      await db.transaction('rw', [db.table(cfg.local), db.outbox], async () => {
        for (const remote of rows) {
          const pk = String(remote[cfg.pk])
          const local = (await db.table(cfg.local).get(pk)) as { updated_at: string } | undefined
          const pending = (await db.outbox.get(`${cfg.local}:${pk}`)) !== undefined
          if (shouldApplyRemote(local, remote as { updated_at: string }, pending)) {
            await db.table(cfg.local).put(remote)
            applied++
          }
        }
      })

      const next = maxServerTimestamp(rows as { server_updated_at?: string | null }[], cursor)
      const progressed = next !== cursor
      cursor = next
      await setMeta(cursorKey(cfg), cursor)
      if (rows.length < PULL_PAGE || !progressed) break
    }
  }
  return applied
}

export interface SyncResult {
  ok: boolean
  offline: boolean
  pushed: number
  pulled: number
  error?: string
}

let inflight: Promise<SyncResult> | null = null
let rerunRequested = false

/**
 * Ein kompletter Abgleich: erst hochladen, dann herunterladen. Läuft immer nur einmal gleichzeitig;
 * Anfragen währenddessen lösen genau einen weiteren Lauf aus.
 */
export function runSync(client: SyncClient, userId?: string): Promise<SyncResult> {
  if (inflight) {
    rerunRequested = true
    return inflight
  }
  inflight = (async () => {
    let result: SyncResult
    do {
      rerunRequested = false
      result = await syncOnce(client, userId)
    } while (rerunRequested && result.ok)
    return result
  })().finally(() => {
    inflight = null
  })
  return inflight
}

async function syncOnce(client: SyncClient, userId?: string): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    syncStatus.set({ phase: 'offline', error: null })
    return { ok: false, offline: true, pushed: 0, pulled: 0 }
  }
  syncStatus.set({ phase: 'syncing' })
  try {
    const pushed = await pushChanges(client)
    const pulled = await pullChanges(client)
    if (userId) await setMeta(INITIAL_PULL_META, userId)
    syncStatus.set({
      phase: 'idle',
      error: null,
      lastSyncAt: new Date().toISOString(),
      initialPullDone: userId ? true : syncStatus.get().initialPullDone,
    })
    return { ok: true, offline: false, pushed, pulled }
  } catch (e) {
    const message = describeError(e)
    if (isNetworkError(message)) {
      syncStatus.set({ phase: 'offline', error: null })
      return { ok: false, offline: true, pushed: 0, pulled: 0, error: message }
    }
    syncStatus.set({ phase: 'error', error: message })
    return { ok: false, offline: false, pushed: 0, pulled: 0, error: message }
  }
}

/**
 * Startet die automatische Synchronisation: beim Start, beim Zurückkehren in die App,
 * beim online-Ereignis, alle 60 Sekunden und kurz nach jeder lokalen Änderung.
 * Gibt eine Funktion zum Beenden zurück.
 */
export function startSyncLoop(client: SyncClient, userId: string): () => void {
  const trigger = () => {
    void runSync(client, userId)
  }
  let debounce: ReturnType<typeof setTimeout> | undefined

  const onVisible = () => {
    if (document.visibilityState === 'visible') trigger()
  }
  const onOffline = () => syncStatus.set({ phase: 'offline', error: null })
  const offChange = onLocalChange(() => {
    clearTimeout(debounce)
    debounce = setTimeout(trigger, 1500)
  })

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', trigger)
  window.addEventListener('offline', onOffline)
  const interval = setInterval(trigger, 60_000)
  trigger()

  return () => {
    clearTimeout(debounce)
    clearInterval(interval)
    offChange()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', trigger)
    window.removeEventListener('offline', onOffline)
  }
}
