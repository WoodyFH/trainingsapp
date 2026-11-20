import { DATA_TABLES, db } from '../db/db'
import { saveRows } from '../db/repo'
import type { TableName } from '../types/db'

/** Vollständiges Backup aller gym_-Daten als JSON-Datei und Wiederherstellung daraus. */

export const BACKUP_APP = 'trainings-app'
export const BACKUP_VERSION = 1

export interface BackupFile {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  tables: Record<TableName, Record<string, unknown>[]>
}

export async function createBackup(): Promise<BackupFile> {
  const tables = {} as BackupFile['tables']
  for (const name of DATA_TABLES) {
    tables[name] = (await db.table(name).toArray()) as Record<string, unknown>[]
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables }
}

export class BackupError extends Error {}

/** Liest und prüft den Text einer Backup-Datei. Wirft BackupError mit verständlicher Meldung. */
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('Die Datei ist keine gültige JSON-Datei.')
  }
  if (!data || typeof data !== 'object') throw new BackupError('Die Datei hat kein erkennbares Backup-Format.')
  const file = data as Partial<BackupFile>
  if (file.app !== BACKUP_APP) throw new BackupError('Das ist kein Backup dieser App.')
  if (typeof file.version !== 'number' || file.version > BACKUP_VERSION) {
    throw new BackupError('Das Backup stammt aus einer neueren Version der App und kann nicht gelesen werden.')
  }
  if (!file.tables || typeof file.tables !== 'object') throw new BackupError('Im Backup fehlen die Tabellen.')

  const tables = {} as BackupFile['tables']
  for (const name of DATA_TABLES) {
    const rows = (file.tables as Record<string, unknown>)[name]
    if (rows === undefined) {
      tables[name] = []
      continue
    }
    if (!Array.isArray(rows)) throw new BackupError(`Die Tabelle „${name}“ im Backup ist beschädigt.`)
    const pk = name === 'settings' ? 'user_id' : 'id'
    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof (row as Record<string, unknown>)[pk] !== 'string') {
        throw new BackupError(`Die Tabelle „${name}“ im Backup enthält ungültige Zeilen.`)
      }
    }
    tables[name] = rows as Record<string, unknown>[]
  }
  return { app: BACKUP_APP, version: file.version, exportedAt: String(file.exportedAt ?? ''), tables }
}

export interface RestoreResult {
  rows: number
  perTable: Partial<Record<TableName, number>>
}

/**
 * Spielt ein Backup ein. Die Zeilen bekommen die Benutzer-ID des angemeldeten Kontos und einen
 * neuen Änderungszeitpunkt, damit sie bei der Synchronisation gewinnen. Vorhandene Daten mit
 * anderen IDs bleiben unverändert.
 */
export async function restoreBackup(backup: BackupFile, userId: string): Promise<RestoreResult> {
  const perTable: RestoreResult['perTable'] = {}
  let rows = 0
  for (const name of DATA_TABLES) {
    const source = backup.tables[name] ?? []
    if (source.length === 0) continue
    const prepared = source.map((r) => {
      const { server_updated_at: _drop, ...rest } = r
      void _drop
      return { ...rest, user_id: userId }
    })
    for (let i = 0; i < prepared.length; i += 500) {
      await saveRows(name, prepared.slice(i, i + 500) as never)
    }
    perTable[name] = prepared.length
    rows += prepared.length
  }
  return { rows, perTable }
}
