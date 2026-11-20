import type { Workbook, Worksheet } from 'exceljs'
import { db } from '../db/db'
import { FREE_NOTE } from '../import/excelMapping'
import { todayIso } from '../lib/date'
import { logVolume } from '../lib/volume'
import { DEFAULT_BODYWEIGHT_KG } from '../seed/seedData'
import type {
  GymCardioLog,
  GymCardioType,
  GymExercise,
  GymExerciseLog,
  GymSession,
  GymTemplate,
  GymTemplateExercise,
  LoadType,
} from '../types/db'
import { MUSCLE_LABELS, type MuscleId } from '../types/muscles'

/** Excel-Export (Prompt Abschnitt 7): fünf Blätter, im Browser erzeugt, Dateiname Training_Export_JJJJ-MM-TT.xlsx. */

export interface ExportData {
  bodyweightKg: number
  exercises: GymExercise[]
  templates: GymTemplate[]
  templateExercises: GymTemplateExercise[]
  sessions: GymSession[]
  exerciseLogs: GymExerciseLog[]
  cardioTypes: GymCardioType[]
  cardioLogs: GymCardioLog[]
}

export const SHEET_NAMES = ['Krafttraining', 'Matrix', 'Cardio', 'Übungen', 'Pläne'] as const

export const LOAD_TYPE_TEXT: Record<LoadType, string> = {
  weight: 'Gewicht',
  assisted: 'Unterstützung',
  bodyweight: 'Körpergewicht',
  time: 'Zeit',
}

export function exportFilename(date: string = todayIso()): string {
  return `Training_Export_${date}.xlsx`
}

const live = <T extends { deleted_at: string | null }>(rows: T[]): T[] => rows.filter((r) => !r.deleted_at)

export async function loadExportData(userId?: string): Promise<ExportData> {
  const settings = userId ? await db.settings.get(userId) : (await db.settings.toArray())[0]
  return {
    bodyweightKg: settings?.bodyweight_kg ?? DEFAULT_BODYWEIGHT_KG,
    exercises: live(await db.exercises.toArray()),
    templates: live(await db.templates.toArray()),
    templateExercises: live(await db.templateExercises.toArray()),
    sessions: live(await db.sessions.toArray()),
    exerciseLogs: live(await db.exerciseLogs.toArray()),
    cardioTypes: live(await db.cardioTypes.toArray()),
    cardioLogs: live(await db.cardioLogs.toArray()),
  }
}

/** Excel-Datumszelle (Kalendertag als UTC-Mitternacht, damit keine Zeitzone verschiebt). */
function excelDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
}

const DATE_FORMAT = 'dd.mm.yyyy'

function styleHeader(sheet: Worksheet, rows: number[]): void {
  for (const r of rows) {
    const row = sheet.getRow(r)
    row.font = { bold: true }
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } } }
    })
  }
}

function muscleList(ids: readonly MuscleId[]): string {
  return ids.map((m) => MUSCLE_LABELS[m]).join(', ')
}

// ---------------------------------------------------------------------------
// Blatt 1: Krafttraining (Langformat)
// ---------------------------------------------------------------------------

function sessionKindLabel(session: GymSession, template: GymTemplate | undefined): string {
  if (session.kind === 'free') return 'Frei'
  if (template?.rotation_order && template.in_rotation) return `Training ${template.rotation_order}`
  return template ? 'Weiteres Training' : 'Training'
}

function addStrengthSheet(wb: Workbook, data: ExportData): void {
  const sheet = wb.addWorksheet('Krafttraining', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Datum', key: 'date', width: 12 },
    { header: 'Art', key: 'kind', width: 18 },
    { header: 'Trainingsname', key: 'template', width: 20 },
    { header: 'Übung', key: 'exercise', width: 40 },
    { header: 'Gerätebezeichnung', key: 'device', width: 24 },
    { header: 'Lasttyp', key: 'load', width: 15 },
    { header: 'Seiten', key: 'sides', width: 9 },
    { header: 'Sätze', key: 'sets', width: 8 },
    { header: 'Wdh', key: 'reps', width: 8 },
    { header: 'kg', key: 'kg', width: 9 },
    { header: 'Sekunden', key: 'seconds', width: 11 },
    { header: 'Volumen', key: 'volume', width: 12 },
    { header: 'Steigern vorgemerkt', key: 'increase', width: 20 },
    { header: 'Notiz', key: 'note', width: 40 },
  ]
  styleHeader(sheet, [1])

  const exercises = new Map(data.exercises.map((e) => [e.id, e]))
  const templates = new Map(data.templates.map((t) => [t.id, t]))
  const sessions = data.sessions
    .filter((s) => s.kind === 'strength' || s.kind === 'free')
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
  const logsBySession = new Map<string, GymExerciseLog[]>()
  for (const l of data.exerciseLogs) {
    const list = logsBySession.get(l.session_id) ?? []
    list.push(l)
    logsBySession.set(l.session_id, list)
  }

  for (const s of sessions) {
    const template = s.template_id ? templates.get(s.template_id) : undefined
    const logs = (logsBySession.get(s.id) ?? []).sort((a, b) => a.sort - b.sort)
    for (const l of logs) {
      const e = exercises.get(l.exercise_id)
      if (!e) continue
      const row = sheet.addRow({
        date: excelDate(s.date),
        kind: sessionKindLabel(s, template),
        template: template?.name ?? '',
        exercise: e.name,
        device: e.short_name ?? '',
        load: LOAD_TYPE_TEXT[e.load_type],
        sides: l.sides,
        sets: l.sets,
        reps: l.reps ?? null,
        kg: l.weight_kg ?? null,
        seconds: l.seconds ?? null,
        volume: Math.round(logVolume(l, e.load_type, data.bodyweightKg)),
        increase: l.increase_next ? 'Ja' : '',
        note: l.note ?? '',
      })
      row.getCell('date').numFmt = DATE_FORMAT
      row.getCell('volume').numFmt = '#,##0'
    }
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 14 } }
}

// ---------------------------------------------------------------------------
// Blatt 2: Matrix im Format der alten Liste
// ---------------------------------------------------------------------------

function addMatrixSheet(wb: Workbook, data: ExportData): void {
  const sheet = wb.addWorksheet('Matrix', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] })
  const exercises = new Map(data.exercises.map((e) => [e.id, e]))
  const sessions = new Map(
    data.sessions.filter((s) => s.kind === 'strength' || s.kind === 'free').map((s) => [s.id, s]),
  )

  // Nur Übungen mit Einträgen, in der Reihenfolge ihres ersten Auftretens (dann nach Name).
  const firstDate = new Map<string, string>()
  const logsWithSession: { log: GymExerciseLog; session: GymSession }[] = []
  for (const log of data.exerciseLogs) {
    const session = sessions.get(log.session_id)
    if (!session || !exercises.has(log.exercise_id)) continue
    logsWithSession.push({ log, session })
    const prev = firstDate.get(log.exercise_id)
    if (!prev || session.date < prev) firstDate.set(log.exercise_id, session.date)
  }
  const columns = [...firstDate.keys()]
    .map((id) => exercises.get(id) as GymExercise)
    .sort((a, b) => (firstDate.get(a.id) ?? '').localeCompare(firstDate.get(b.id) ?? '') || a.name.localeCompare(b.name, 'de'))

  // Kopfzeilen: Zeile 1 = Übungsname (über die Spalten verbunden), Zeile 2 = Set., Whg., kg bzw. Set., sek.
  sheet.getCell(2, 1).value = 'Datum'
  const startColumn = new Map<string, number>()
  let col = 2
  for (const e of columns) {
    const subs = e.load_type === 'time' ? ['Set.', 'sek.'] : ['Set.', 'Whg.', 'kg']
    startColumn.set(e.id, col)
    sheet.getCell(1, col).value = e.short_name || e.name
    if (subs.length > 1) sheet.mergeCells(1, col, 1, col + subs.length - 1)
    subs.forEach((s, i) => {
      sheet.getCell(2, col + i).value = s
    })
    col += subs.length
  }
  const remarkColumn = col
  sheet.getCell(2, remarkColumn).value = 'Bemerkung'
  styleHeader(sheet, [1, 2])
  sheet.getColumn(1).width = 12
  sheet.getColumn(remarkColumn).width = 40

  // Eine Zeile pro Datum
  const byDate = new Map<string, { logs: GymExerciseLog[]; remarks: string[] }>()
  for (const { log, session } of logsWithSession.sort((a, b) => a.session.created_at.localeCompare(b.session.created_at))) {
    const day = byDate.get(session.date) ?? { logs: [], remarks: [] }
    day.logs.push(log)
    if (session.note && !day.remarks.includes(session.note)) day.remarks.push(session.note)
    byDate.set(session.date, day)
  }
  let rowNumber = 3
  for (const date of [...byDate.keys()].sort()) {
    const day = byDate.get(date)
    if (!day) continue
    const dateCell = sheet.getCell(rowNumber, 1)
    dateCell.value = excelDate(date)
    dateCell.numFmt = DATE_FORMAT
    for (const log of day.logs) {
      const e = exercises.get(log.exercise_id)
      const start = startColumn.get(log.exercise_id)
      if (!e || start === undefined) continue
      sheet.getCell(rowNumber, start).value = log.sets
      if (e.load_type === 'time') {
        sheet.getCell(rowNumber, start + 1).value = log.seconds ?? null
      } else {
        sheet.getCell(rowNumber, start + 1).value = log.reps ?? null
        sheet.getCell(rowNumber, start + 2).value = log.weight_kg ?? null
      }
    }
    // Der Zuordnungs-Hinweis des Imports gehört nicht in die Bemerkungsspalte der alten Liste.
    const remark = day.remarks
      .flatMap((n) => n.split('\n'))
      .filter((line) => line !== FREE_NOTE)
      .join(' | ')
    if (remark) sheet.getCell(rowNumber, remarkColumn).value = remark
    rowNumber++
  }
}

// ---------------------------------------------------------------------------
// Blatt 3 bis 5
// ---------------------------------------------------------------------------

function addCardioSheet(wb: Workbook, data: ExportData): void {
  const sheet = wb.addWorksheet('Cardio', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Datum', key: 'date', width: 12 },
    { header: 'Art', key: 'type', width: 20 },
    { header: 'Dauer (min)', key: 'duration', width: 13 },
    { header: 'kcal', key: 'kcal', width: 9 },
    { header: 'Ø Puls', key: 'hr', width: 9 },
    { header: 'Distanz', key: 'distance', width: 11 },
    { header: 'Einheit', key: 'unit', width: 9 },
    { header: 'Notiz', key: 'note', width: 40 },
  ]
  styleHeader(sheet, [1])
  const types = new Map(data.cardioTypes.map((t) => [t.id, t]))
  const sessions = new Map(data.sessions.filter((s) => s.kind === 'cardio').map((s) => [s.id, s]))
  const entries = data.cardioLogs
    .map((l) => ({ log: l, session: sessions.get(l.session_id) }))
    .filter((x): x is { log: GymCardioLog; session: GymSession } => x.session !== undefined)
    .sort((a, b) => a.session.date.localeCompare(b.session.date) || a.log.created_at.localeCompare(b.log.created_at))
  for (const { log, session } of entries) {
    const type = types.get(log.cardio_type_id)
    const row = sheet.addRow({
      date: excelDate(session.date),
      type: type?.name ?? '',
      duration: log.duration_min ?? null,
      kcal: log.kcal ?? null,
      hr: log.avg_hr ?? null,
      distance: log.distance ?? null,
      unit: type?.distance_unit ?? '',
      note: log.note ?? '',
    })
    row.getCell('date').numFmt = DATE_FORMAT
  }
}

function addExercisesSheet(wb: Workbook, data: ExportData): void {
  const sheet = wb.addWorksheet('Übungen', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Name', key: 'name', width: 42 },
    { header: 'Gerätebezeichnung', key: 'device', width: 26 },
    { header: 'Lasttyp', key: 'load', width: 15 },
    { header: 'Seiten', key: 'sides', width: 12 },
    { header: 'Schritt', key: 'step', width: 9 },
    { header: 'Primäre Muskeln', key: 'primary', width: 34 },
    { header: 'Sekundäre Muskeln', key: 'secondary', width: 34 },
    { header: 'Archiviert', key: 'archived', width: 11 },
    { header: 'Notiz', key: 'notes', width: 70 },
  ]
  styleHeader(sheet, [1])
  const sorted = [...data.exercises].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'de'),
  )
  for (const e of sorted) {
    sheet.addRow({
      name: e.name,
      device: e.short_name ?? '',
      load: LOAD_TYPE_TEXT[e.load_type],
      sides: e.sides === 2 ? 'pro Seite' : 'beidseitig',
      step: e.weight_step,
      primary: muscleList(e.primary_muscles),
      secondary: muscleList(e.secondary_muscles),
      archived: e.archived ? 'Ja' : '',
      notes: e.notes ?? '',
    })
  }
}

function addPlansSheet(wb: Workbook, data: ExportData): void {
  const sheet = wb.addWorksheet('Pläne', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Rotation', key: 'rotation', width: 10 },
    { header: 'Training', key: 'template', width: 24 },
    { header: 'Archiviert', key: 'archived', width: 11 },
    { header: 'Position', key: 'position', width: 10 },
    { header: 'Übung', key: 'exercise', width: 42 },
    { header: 'Gerätebezeichnung', key: 'device', width: 26 },
  ]
  styleHeader(sheet, [1])
  const exercises = new Map(data.exercises.map((e) => [e.id, e]))
  const templates = [...data.templates].sort(
    (a, b) =>
      Number(b.in_rotation && !b.archived) - Number(a.in_rotation && !a.archived) ||
      (a.rotation_order ?? 999) - (b.rotation_order ?? 999) ||
      Number(a.archived) - Number(b.archived) ||
      a.sort - b.sort,
  )
  for (const t of templates) {
    const links = data.templateExercises.filter((l) => l.template_id === t.id).sort((a, b) => a.sort - b.sort)
    const base = {
      rotation: t.in_rotation && t.rotation_order ? t.rotation_order : null,
      template: t.name,
      archived: t.archived ? 'Ja' : '',
    }
    if (links.length === 0) sheet.addRow({ ...base, position: null, exercise: '', device: '' })
    links.forEach((l, i) => {
      const e = exercises.get(l.exercise_id)
      sheet.addRow({ ...base, position: i + 1, exercise: e?.name ?? '', device: e?.short_name ?? '' })
    })
  }
}

export async function buildExportWorkbook(data: ExportData): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Trainings-App'
  wb.created = new Date()
  addStrengthSheet(wb, data)
  addMatrixSheet(wb, data)
  addCardioSheet(wb, data)
  addExercisesSheet(wb, data)
  addPlansSheet(wb, data)
  return wb
}

/** Erzeugt die Excel-Datei aus den lokalen Daten. */
export async function createExcelExport(userId?: string): Promise<{ blob: Blob; filename: string }> {
  const wb = await buildExportWorkbook(await loadExportData(userId))
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  return { blob, filename: exportFilename() }
}
