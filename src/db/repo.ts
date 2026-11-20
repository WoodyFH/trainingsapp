import { newId } from '../lib/uuid'
import { notifyLocalChange } from '../sync/bus'
import type { TableMap, TableName } from '../types/db'
import { db, type OutboxEntry } from './db'
import { tableConfig } from './tables'

/**
 * Lokal-zuerst-Schreibzugriff: Jede Änderung landet in Dexie UND in der Outbox,
 * in einer gemeinsamen Transaktion. Hochgeladen wird später von der Sync-Engine.
 */

let currentUserId: string | null = null

export function setCurrentUserId(id: string | null): void {
  currentUserId = id
}

export function requireUserId(): string {
  if (!currentUserId) throw new Error('Kein angemeldeter Benutzer')
  return currentUserId
}

export function nowIso(): string {
  return new Date().toISOString()
}

type NewRow<K extends TableName> = Omit<
  TableMap[K],
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'server_updated_at'
>

/** Legt eine neue Zeile mit ID und Zeitstempeln an (nicht für settings). */
export function buildRow<K extends Exclude<TableName, 'settings'>>(
  _table: K,
  data: NewRow<K> & { id?: string },
): TableMap[K] {
  const ts = nowIso()
  return {
    ...data,
    id: data.id ?? newId(),
    user_id: requireUserId(),
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  } as unknown as TableMap[K]
}

function outboxEntry(table: TableName, pk: string, ts: string): OutboxEntry {
  return { key: `${table}:${pk}`, table, pk, queuedAt: ts, attempts: 0, lastError: null }
}

/** Speichert eine Zeile (neu oder geändert) und merkt sie für den Upload vor. */
export async function saveRow<K extends TableName>(table: K, row: TableMap[K]): Promise<TableMap[K]> {
  const ts = nowIso()
  const pkField = tableConfig(table).pk
  const next = { ...row, updated_at: ts } as TableMap[K]
  const pk = String((next as unknown as Record<string, unknown>)[pkField])
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await db.table(table).put(next)
    await db.outbox.put(outboxEntry(table, pk, ts))
  })
  notifyLocalChange()
  return next
}

/** Speichert mehrere Zeilen einer Tabelle in einer Transaktion (z. B. beim Import). */
export async function saveRows<K extends TableName>(table: K, rows: TableMap[K][]): Promise<void> {
  if (rows.length === 0) return
  const ts = nowIso()
  const pkField = tableConfig(table).pk
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    const next = rows.map((r) => ({ ...r, updated_at: ts }))
    await db.table(table).bulkPut(next)
    await db.outbox.bulkPut(
      next.map((r) => outboxEntry(table, String((r as unknown as Record<string, unknown>)[pkField]), ts)),
    )
  })
  notifyLocalChange()
}

/** Soft Delete: setzt deleted_at und synchronisiert die Änderung wie jede andere. */
export async function softDeleteRow(table: Exclude<TableName, 'settings'>, id: string): Promise<void> {
  const ts = nowIso()
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    const row = await db.table(table).get(id)
    if (!row) return
    await db.table(table).put({ ...row, deleted_at: ts, updated_at: ts })
    await db.outbox.put(outboxEntry(table, id, ts))
  })
  notifyLocalChange()
}

/** Holt eine Zeile, die nicht als gelöscht markiert ist. */
export async function getLive<K extends Exclude<TableName, 'settings'>>(
  table: K,
  id: string,
): Promise<TableMap[K] | undefined> {
  const row = (await db.table(table).get(id)) as TableMap[K] | undefined
  return row && !row.deleted_at ? row : undefined
}
