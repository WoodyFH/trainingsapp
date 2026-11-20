import { existsSync, readFileSync } from 'node:fs'
import 'fake-indexeddb/auto'
import ExcelJS from 'exceljs'
import { beforeEach, describe, expect, it } from 'vitest'
import { saveExerciseLog } from '../data/sessions'
import { clearLocalData, db } from '../db/db'
import { setCurrentUserId } from '../db/repo'
import { ensureSeeded, seedExerciseId, seedTemplateId } from '../seed/seed'
import { createCardioEntry } from '../test/helpers'
import { buildImportPlan } from '../import/importMapping'
import { parseSheet } from '../import/importParser'
import { readEingabeSheet } from '../import/excelReader'
import { loadImportContext } from '../import/importWriter'
import { buildSeed } from '../seed/seed'
import { buildExportWorkbook, exportFilename, loadExportData, SHEET_NAMES, type ExportData } from './exportExcel'

const USER = '00000000-0000-4000-8000-000000000001'

async function log(key: string, date: string, template: string | null, input: Partial<Parameters<typeof saveExerciseLog>[2]> = {}) {
  const ex = await db.exercises.get(seedExerciseId(USER, key))
  return saveExerciseLog(
    { kind: template ? 'strength' : 'free', templateId: template ? seedTemplateId(USER, template) : null, date },
    ex!,
    { sets: 3, reps: 10, weight_kg: 18, seconds: null, increase_next: false, note: null, ...input },
  )
}

/** Schreibt die Arbeitsmappe in eine Datei im Speicher und liest sie wieder ein (wie beim echten Download). */
async function roundTrip() {
  const wb = await buildExportWorkbook(await loadExportData(USER))
  const buffer = await wb.xlsx.writeBuffer()
  const loaded = new ExcelJS.Workbook()
  await loaded.xlsx.load(buffer as ArrayBuffer)
  return loaded
}

beforeEach(async () => {
  await clearLocalData()
  setCurrentUserId(USER)
  await ensureSeeded(USER)
})

describe('Excel-Export', () => {
  it('benennt die Datei Training_Export_JJJJ-MM-TT.xlsx', () => {
    expect(exportFilename('2026-11-20')).toBe('Training_Export_2026-11-20.xlsx')
  })

  it('erzeugt die fünf Blätter in der vorgesehenen Reihenfolge, auch ohne Einträge', async () => {
    const wb = await roundTrip()
    expect(wb.worksheets.map((w) => w.name)).toEqual([...SHEET_NAMES])
  })

  it('schreibt das Langformat mit Volumen, Seiten und Steigern-Vermerk', async () => {
    await log('biz_curls', '2026-11-16', 'training1', { weight_kg: 18, increase_next: true, note: 'sauber' })
    await log('seitstuetz', '2026-11-16', 'training1', { reps: null, weight_kg: null, seconds: 75 })
    await log('dips', '2026-11-16', 'training1', { reps: 8, weight_kg: 25 })
    await log('klimmzuege', '2026-11-19', null, { reps: 10, weight_kg: 0 })

    const sheet = (await roundTrip()).getWorksheet('Krafttraining')!
    const headers = (sheet.getRow(1).values as string[]).slice(1)
    expect(headers).toEqual([
      'Datum', 'Art', 'Trainingsname', 'Übung', 'Gerätebezeichnung', 'Lasttyp', 'Seiten', 'Sätze', 'Wdh', 'kg',
      'Sekunden', 'Volumen', 'Steigern vorgemerkt', 'Notiz',
    ])
    expect(sheet.rowCount).toBe(5)

    const rows = Object.fromEntries(
      Array.from({ length: 4 }, (_, i) => {
        const r = sheet.getRow(i + 2)
        return [String(r.getCell('D').value), r]
      }),
    )
    const curls = rows['Bizepscurls Kurzhantel, stehend alternierend']!
    expect(curls.getCell('A').value).toEqual(new Date(Date.UTC(2026, 10, 16)))
    expect(curls.getCell('A').numFmt).toBe('dd.mm.yyyy')
    expect(curls.getCell('B').value).toBe('Training 1')
    expect(curls.getCell('C').value).toBe('Oberkörper')
    expect(curls.getCell('F').value).toBe('Gewicht')
    expect(curls.getCell('G').value).toBe(2)
    expect(curls.getCell('L').value).toBe(1080) // 3 × 10 × 18 kg × 2 Seiten
    expect(curls.getCell('M').value).toBe('Ja')
    expect(curls.getCell('N').value).toBe('sauber')

    expect(rows['Dips am Barren']!.getCell('L').value).toBe(3 * 8 * (75 - 25)) // Gegengewicht
    const plank = rows['Seitstütz']!
    expect(plank.getCell('K').value).toBe(75)
    expect(plank.getCell('L').value).toBe(0)
    expect(rows['Klimmzüge breit']!.getCell('B').value).toBe('Frei')
  })

  it('schreibt die Matrix im Format der alten Liste mit verbundenem Kopf und einer Zeile pro Datum', async () => {
    await log('biz_curls', '2026-11-16', 'training1', { weight_kg: 18 })
    await log('seitstuetz', '2026-11-16', 'training1', { reps: null, weight_kg: null, seconds: 75 })
    await log('biz_curls', '2026-11-18', 'training1', { reps: 12, weight_kg: 20 })

    const sheet = (await roundTrip()).getWorksheet('Matrix')!
    // Zeile 1: Name (über die Spalten verbunden), Zeile 2: Unterköpfe
    expect(sheet.getCell('A2').value).toBe('Datum')
    expect(sheet.getCell('B1').value).toBe('Biz. Curls')
    expect(sheet.getCell('B1').isMerged).toBe(true)
    expect(sheet.getCell('D1').master.address).toBe('B1')
    expect([sheet.getCell('B2').value, sheet.getCell('C2').value, sheet.getCell('D2').value]).toEqual(['Set.', 'Whg.', 'kg'])
    expect(sheet.getCell('E1').value).toBe('seitl.Plan.')
    expect([sheet.getCell('E2').value, sheet.getCell('F2').value]).toEqual(['Set.', 'sek.'])
    expect(sheet.getCell('G2').value).toBe('Bemerkung')

    expect(sheet.getCell('A3').value).toEqual(new Date(Date.UTC(2026, 10, 16)))
    expect([sheet.getCell('B3').value, sheet.getCell('C3').value, sheet.getCell('D3').value]).toEqual([3, 10, 18])
    expect([sheet.getCell('E3').value, sheet.getCell('F3').value]).toEqual([3, 75])
    expect(sheet.getCell('A4').value).toEqual(new Date(Date.UTC(2026, 10, 18)))
    expect([sheet.getCell('C4').value, sheet.getCell('D4').value]).toEqual([12, 20])
    expect(sheet.getCell('E4').value).toBeNull()
  })

  it('schreibt Cardio, Übungen und Pläne', async () => {
    await createCardioEntry('2026-11-18')
    const wb = await roundTrip()

    const cardio = wb.getWorksheet('Cardio')!
    expect(cardio.getRow(2).getCell('B').value).toBe('Stairmaster')
    expect(cardio.getRow(2).getCell('C').value).toBe(30)
    expect(cardio.getRow(2).getCell('G').value).toBe('km')

    const exercises = wb.getWorksheet('Übungen')!
    expect(exercises.rowCount).toBe(25) // Kopf + 24 Übungen
    const curls = Array.from({ length: 24 }, (_, i) => exercises.getRow(i + 2)).find((r) => String(r.getCell('A').value).startsWith('Bizepscurls'))!
    expect(curls.getCell('F').value).toBe('Bizeps')
    expect(curls.getCell('D').value).toBe('pro Seite')
    // archivierte Übungen stehen am Ende und sind markiert
    expect(exercises.getRow(25).getCell('H').value).toBe('Ja')

    const plans = wb.getWorksheet('Pläne')!
    expect(plans.rowCount).toBe(21) // Kopf + 20 Zuordnungen
    expect([plans.getRow(2).getCell('A').value, plans.getRow(2).getCell('B').value, plans.getRow(2).getCell('D').value]).toEqual([1, 'Oberkörper', 1])
  })
})

const REAL_FILE = new URL('../../private/Workouts.xlsx', import.meta.url)

describe.skipIf(!existsSync(REAL_FILE))('Export mit den echten, importierten Daten', () => {
  it('erzeugt aus 698 importierten Einheiten die erwarteten Zeilen in allen Blättern', async () => {
    const sheet = await readEingabeSheet(new Uint8Array(readFileSync(REAL_FILE)))
    const ctx = await loadImportContext(USER)
    const plan = buildImportPlan(parseSheet(sheet), ctx)
    const seed = buildSeed(USER, '2026-11-20T00:00:00.000Z')
    const data: ExportData = {
      bodyweightKg: 75,
      exercises: seed.exercises,
      templates: seed.templates,
      templateExercises: seed.templateExercises,
      sessions: plan.sessions,
      exerciseLogs: plan.logs,
      cardioTypes: seed.cardioTypes,
      cardioLogs: [],
    }

    const wb = await buildExportWorkbook(data)
    const loaded = new ExcelJS.Workbook()
    await loaded.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer)

    expect(loaded.getWorksheet('Krafttraining')!.rowCount).toBe(1 + plan.logs.length)
    const matrix = loaded.getWorksheet('Matrix')!
    expect(matrix.rowCount).toBe(2 + plan.sessions.length) // zwei Kopfzeilen + eine Zeile je Datum
    expect(matrix.getCell('A3').value).toEqual(new Date(Date.UTC(2022, 9, 10)))
    expect(loaded.getWorksheet('Übungen')!.rowCount).toBe(25)
  }, 120_000)
})
