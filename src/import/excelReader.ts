/**
 * Liest das Blatt "Eingabe" einer Excel-Datei in eine einfache Tabelle (im Browser, nichts wird hochgeladen).
 * ExcelJS wird erst hier geladen, damit es nicht im Startpaket der App steckt.
 */

export type Cell = string | number | boolean | Date | null

export interface SheetMatrix {
  /** Zeile 1 (Übungsnamen), Index = Spaltennummer (1-basiert, Index 0 unbenutzt). */
  header1: Cell[]
  /** Zeile 2 (Unterköpfe). */
  header2: Cell[]
  /** Datenzeilen ab Zeile 3, Index = Spaltennummer. */
  rows: { row: number; cells: Cell[] }[]
}

export const SHEET_NAME = 'Eingabe'

function normalizeCell(value: unknown): Cell {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const t = value.trim()
    return t === '' ? null : t
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    if ('result' in v) return normalizeCell(v.result) // Formel
    if ('richText' in v && Array.isArray(v.richText)) {
      return normalizeCell(v.richText.map((r: { text?: string }) => r.text ?? '').join(''))
    }
    if ('text' in v) return normalizeCell(v.text) // Hyperlink
    return null // Fehlerwerte u. Ä.
  }
  return null
}

export async function readEingabeSheet(data: ArrayBuffer | Uint8Array): Promise<SheetMatrix> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(data as ArrayBuffer)
  const sheet = workbook.getWorksheet(SHEET_NAME)
  if (!sheet) {
    const names = workbook.worksheets.map((w) => w.name).join(', ')
    throw new Error(`Das Blatt „${SHEET_NAME}“ fehlt in der Datei. Gefunden: ${names || 'keine Blätter'}.`)
  }

  const columns = sheet.columnCount
  const readRow = (rowNumber: number): Cell[] => {
    const row = sheet.getRow(rowNumber)
    const cells: Cell[] = [null]
    for (let c = 1; c <= columns; c++) {
      const cell = row.getCell(c)
      // Verbundene Zellen: der Wert steht nur in der Haupt-Zelle.
      cells.push(normalizeCell(cell.isMerged && cell.master ? cell.master.value : cell.value))
    }
    return cells
  }

  const rows: SheetMatrix['rows'] = []
  for (let r = 3; r <= sheet.rowCount; r++) rows.push({ row: r, cells: readRow(r) })
  return { header1: readRow(1), header2: readRow(2), rows }
}
