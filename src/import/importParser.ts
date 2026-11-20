import { normalizeName } from './excelMapping'
import type { Cell, SheetMatrix } from './excelReader'

/** Liest die Tabelle des Blatts "Eingabe" in Tage mit Einträgen (rein, ohne Datenbank). */

export type WarningCode =
  | 'sets-missing'
  | 'reps-missing'
  | 'weight-missing'
  | 'seconds-missing'
  | 'unreadable'
  | 'unknown-column'
  | 'duplicate'
  | 'remark-without-exercises'
  | 'row-without-date'
  | 'existing-app-session'
  | 'exercise-restored'

export interface ImportWarning {
  code: WarningCode
  /** JJJJ-MM-TT, falls die Warnung zu einem Tag gehört. */
  date?: string
  message: string
}

export interface ColumnGroup {
  /** Name laut Excel-Kopfzeile. */
  name: string
  set?: number
  reps?: number
  kg?: number
  seconds?: number
}

export interface ParsedEntry {
  excelName: string
  sets: number | null
  reps: number | null
  kg: number | null
  seconds: number | null
  /** Zellen, deren Inhalt keine Zahl war (Spaltenrolle). */
  unreadable: ('sets' | 'reps' | 'kg' | 'seconds')[]
}

export interface ParsedDay {
  /** JJJJ-MM-TT */
  date: string
  /** Zeilennummer im Blatt (für Meldungen). */
  row: number
  remark: string | null
  entries: ParsedEntry[]
}

export interface ParseResult {
  groups: ColumnGroup[]
  days: ParsedDay[]
  warnings: ImportWarning[]
  /** Zeilen mit Datum im Blatt (auch ohne Übung). */
  datedRows: number
  /** Zeilen mit Datum, aber ohne eine einzige Übung (werden übersprungen). */
  emptyDateRows: number
  /** Bemerkungen im ganzen Blatt (Zeilen mit Datum). */
  remarksFound: number
}

const FALLBACK_REMARK_COLUMN = 66 // BN

function isoFromDate(d: Date): string {
  // Excel liefert Datumszellen als UTC-Mitternacht.
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Datum aus einer Zelle (Datumszelle oder Text TT.MM.JJJJ bzw. JJJJ-MM-TT), sonst null. */
export function parseDateCell(cell: Cell): string | null {
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : isoFromDate(cell)
  if (typeof cell === 'string') {
    const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(cell)
    if (de) return `${de[3]}-${String(de[2]).padStart(2, '0')}-${String(de[1]).padStart(2, '0')}`
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(cell)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  }
  return null
}

/** Zahl aus einer Zelle. Texte wie "55." oder "17,5" werden gelesen. unreadable = Zelle gefüllt, aber keine Zahl. */
export function parseNumberCell(cell: Cell): { value: number | null; unreadable: boolean } {
  if (cell === null) return { value: null, unreadable: false }
  if (typeof cell === 'number') return { value: Number.isFinite(cell) ? cell : null, unreadable: !Number.isFinite(cell) }
  if (typeof cell === 'string') {
    const cleaned = cell.replace(',', '.').replace(/\.$/, '').trim()
    const value = Number(cleaned)
    if (cleaned === '' || Number.isNaN(value)) return { value: null, unreadable: true }
    return { value, unreadable: false }
  }
  return { value: null, unreadable: true }
}

function cellText(cell: Cell): string {
  return typeof cell === 'string' ? cell : cell === null ? '' : String(cell)
}

/** Erkennt die Spaltengruppen (Übungen) anhand der beiden Kopfzeilen. */
export function detectGroups(matrix: SheetMatrix): { groups: ColumnGroup[]; remarkColumn: number; dateColumn: number } {
  const { header1, header2 } = matrix
  const width = Math.max(header1.length, header2.length) - 1

  let dateColumn = 1
  let remarkColumn = FALLBACK_REMARK_COLUMN
  for (let c = 1; c <= width; c++) {
    const h2 = normalizeName(cellText(header2[c] ?? null))
    if (h2 === 'datum') dateColumn = c
    if (h2 === 'bemerkung') remarkColumn = c
  }

  const groups: ColumnGroup[] = []
  let current: ColumnGroup | null = null
  for (let c = 1; c <= width; c++) {
    if (c === dateColumn || c === remarkColumn) {
      current = null
      continue
    }
    const name = cellText(header1[c] ?? null)
    if (!name || normalizeName(name) === 'phys') {
      current = null
      continue
    }
    if (!current || normalizeName(current.name) !== normalizeName(name)) {
      current = { name }
      groups.push(current)
    }
    const sub = normalizeName(cellText(header2[c] ?? null))
    if (sub === 'whg') current.reps = c
    else if (sub === 'kg') current.kg = c
    else if (sub === 'sek' || sub === 'sekunden' || sub === 's') current.seconds = c
    else if (sub === 'set' || (sub === '' && current.set === undefined)) current.set = c // BB hat keine Beschriftung, ist aber "Set."
  }
  return { groups, remarkColumn, dateColumn }
}

function groupHasValue(group: ColumnGroup, cells: Cell[]): boolean {
  return [group.set, group.reps, group.kg, group.seconds].some((c) => c !== undefined && cells[c] !== null && cells[c] !== undefined)
}

export function parseSheet(matrix: SheetMatrix): ParseResult {
  const { groups, remarkColumn, dateColumn } = detectGroups(matrix)
  const warnings: ImportWarning[] = []
  const days: ParsedDay[] = []
  let datedRows = 0
  let emptyDateRows = 0
  let remarksFound = 0

  for (const { row, cells } of matrix.rows) {
    const date = parseDateCell(cells[dateColumn] ?? null)
    const entries: ParsedEntry[] = []
    for (const group of groups) {
      if (!groupHasValue(group, cells)) continue
      const read = (col: number | undefined) => (col === undefined ? { value: null, unreadable: false } : parseNumberCell(cells[col] ?? null))
      const sets = read(group.set)
      const reps = read(group.reps)
      const kg = read(group.kg)
      const seconds = read(group.seconds)
      const unreadable: ParsedEntry['unreadable'] = []
      if (sets.unreadable) unreadable.push('sets')
      if (reps.unreadable) unreadable.push('reps')
      if (kg.unreadable) unreadable.push('kg')
      if (seconds.unreadable) unreadable.push('seconds')
      entries.push({ excelName: group.name, sets: sets.value, reps: reps.value, kg: kg.value, seconds: seconds.value, unreadable })
    }

    const remarkCell = cells[remarkColumn] ?? null
    const remark = remarkCell === null ? null : cellText(remarkCell).trim() || null

    if (!date) {
      if (entries.length > 0) {
        warnings.push({
          code: 'row-without-date',
          message: `Zeile ${row} hat kein Datum und wird übersprungen (${entries.map((e) => e.excelName).join(', ')}). Trage das Datum in der Excel nach und importiere erneut.`,
        })
      }
      continue
    }
    datedRows++
    if (remark) remarksFound++
    if (entries.length === 0) {
      emptyDateRows++
      if (remark) {
        warnings.push({
          code: 'remark-without-exercises',
          date,
          message: `Zeile ${row}: Die Bemerkung steht an einem Tag ohne Übung und wird übersprungen.`,
        })
      }
      continue
    }
    days.push({ date, row, remark, entries })
  }

  return { groups, days, warnings, datedRows, emptyDateRows, remarksFound }
}
