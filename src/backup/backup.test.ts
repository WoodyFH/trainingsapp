import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCardioEntry } from '../test/helpers'
import { clearLocalData, db } from '../db/db'
import { setCurrentUserId } from '../db/repo'
import { ensureSeeded } from '../seed/seed'
import { BackupError, createBackup, parseBackup, restoreBackup } from './backup'

const USER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'

beforeEach(async () => {
  await clearLocalData()
  setCurrentUserId(USER)
  await ensureSeeded(USER)
})

describe('Backup', () => {
  it('enthält alle Tabellen als JSON und ist lesbar', async () => {
    await createCardioEntry()
    const backup = await createBackup()
    expect(backup).toMatchObject({ app: 'trainings-app', version: 1 })
    expect(backup.tables.exercises).toHaveLength(24)
    expect(backup.tables.templates).toHaveLength(3)
    expect(backup.tables.cardioLogs).toHaveLength(1)
    expect(parseBackup(JSON.stringify(backup)).tables.exercises).toHaveLength(24)
  })

  it('stellt Daten nach dem Löschen wieder her, mit der ID des angemeldeten Kontos', async () => {
    const backup = await createBackup()
    const text = JSON.stringify(backup)

    await clearLocalData()
    setCurrentUserId(OTHER)
    const result = await restoreBackup(parseBackup(text), OTHER)

    expect(result.perTable.exercises).toBe(24)
    expect(await db.exercises.count()).toBe(24)
    expect((await db.exercises.toArray()).every((e) => e.user_id === OTHER)).toBe(true)
    expect((await db.settings.toArray())[0]?.user_id).toBe(OTHER)
    // alles wartet auf den Upload
    expect(await db.outbox.count()).toBe(result.rows)
  })

  it('übernimmt keinen server_updated_at-Wert aus dem Backup', async () => {
    const backup = await createBackup()
    backup.tables.exercises[0] = { ...backup.tables.exercises[0], server_updated_at: '2020-01-01T00:00:00.000Z' }
    await clearLocalData()
    await restoreBackup(backup, USER)
    expect((await db.exercises.toArray()).some((e) => e.server_updated_at)).toBe(false)
  })
})

describe('Backup prüfen', () => {
  it('lehnt falsche Dateien mit verständlicher Meldung ab', () => {
    expect(() => parseBackup('das ist kein json')).toThrow('JSON')
    expect(() => parseBackup('[]')).toThrow(BackupError)
    expect(() => parseBackup('{"app":"andere-app","version":1,"tables":{}}')).toThrow('kein Backup dieser App')
    expect(() => parseBackup('{"app":"trainings-app","version":99,"tables":{}}')).toThrow('neueren Version')
    expect(() => parseBackup('{"app":"trainings-app","version":1}')).toThrow('Tabellen')
    expect(() => parseBackup('{"app":"trainings-app","version":1,"tables":{"exercises":"x"}}')).toThrow('beschädigt')
    expect(() => parseBackup('{"app":"trainings-app","version":1,"tables":{"exercises":[{"name":"ohne id"}]}}')).toThrow(
      'ungültige Zeilen',
    )
  })

  it('akzeptiert fehlende Tabellen als leer', () => {
    const backup = parseBackup('{"app":"trainings-app","version":1,"tables":{"exercises":[{"id":"a"}]}}')
    expect(backup.tables.exercises).toHaveLength(1)
    expect(backup.tables.sessions).toEqual([])
  })
})
