import type { Sides } from '../types/db'

/**
 * Zuordnung der Excel-Spalten (Blatt "Eingabe") zu den Übungen der App.
 * Grundlage: Prompt Abschnitt 8 und 9 sowie Uebungen.md.
 */

/** Vereinheitlicht Spaltennamen für den Vergleich ("seitl. Bauch" und "seitl.Bauch" sind gleich). */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s.]+/g, '')
}

/** Letzter Tag der alten Zuordnung (inklusive): Datum ≤ Grenze → alte Übung. */
export const DIPS_MACHINE_UNTIL = '2023-11-16'
export const SHOULDER_MACHINE_UNTIL = '2025-01-05'
/** Ab diesem Datum einbeinig (Seiten = 2), davor beidbeinig. */
export const LEG_PRESS_SINGLE_LEG_FROM = '2023-04-16'
export const CALF_SINGLE_LEG_FROM = '2023-02-25'

export interface ExcelExercise {
  /** Name laut Excel (nur zur Anzeige). */
  excelName: string
  /** Schlüssel der Übung in den Startdaten; hängt bei Umstellungen vom Datum ab. */
  keyFor: (date: string) => string
  /** Überschreibt die Seiten der Übung für Einträge an diesem Datum (Umstellung auf einbeinig). */
  sidesFor?: (date: string) => Sides
  /** Zu welchem Rotations-Training die Excel-Spalte gehört (Tabelle in Abschnitt 9). */
  training?: 1 | 2 | 3
}

const fixed = (key: string) => (): string => key

const EXERCISES: ExcelExercise[] = [
  { excelName: 'Arme 1', keyFor: fixed('bizepsmaschine') },
  { excelName: 'Biz. Curls', keyFor: fixed('biz_curls'), training: 1 },
  {
    excelName: 'Dips',
    keyFor: (date) => (date <= DIPS_MACHINE_UNTIL ? 'trizepsmaschine' : 'dips'),
    training: 1,
  },
  { excelName: 'Seitheben', keyFor: fixed('seitheben'), training: 3 },
  {
    excelName: 'Schultern 3',
    keyFor: (date) => (date <= SHOULDER_MACHINE_UNTIL ? 'schulterdruecken_maschine' : 'schulterdruecken_kh'),
    training: 1,
  },
  { excelName: 'Brust 2A', keyFor: fixed('butterfly'), training: 1 },
  { excelName: 'Rücken', keyFor: fixed('rudern_maschine'), training: 1 },
  { excelName: 'Bauch 3', keyFor: fixed('crunches') },
  { excelName: 'Bauch A4', keyFor: fixed('bauchmaschine'), training: 2 },
  { excelName: 'Leg Raises', keyFor: fixed('beinheben'), training: 3 },
  { excelName: 'seitl. Bauch', keyFor: fixed('rotation_kniend'), training: 3 },
  { excelName: 'Unter. Rück. 2', keyFor: fixed('rueckenstrecker'), training: 3 },
  { excelName: 'Planken', keyFor: fixed('unterarmstuetz'), training: 2 },
  { excelName: 'seitl.Plan.', keyFor: fixed('seitstuetz'), training: 1 },
  { excelName: 'Kniebeugen', keyFor: fixed('goblet_squat'), training: 1 },
  { excelName: 'Beine 2A', keyFor: fixed('beinbeuger'), training: 2 },
  {
    excelName: 'Beine 3C',
    keyFor: fixed('beinpresse_liegend'),
    sidesFor: (date) => (date < LEG_PRESS_SINGLE_LEG_FROM ? 1 : 2),
    training: 2,
  },
  {
    excelName: 'Beine 4C',
    keyFor: fixed('wadenheben'),
    sidesFor: (date) => (date < CALF_SINGLE_LEG_FROM ? 1 : 2),
    training: 3,
  },
  { excelName: 'O.Schenk.', keyFor: fixed('ausfallschritte_sandsack'), training: 2 },
  { excelName: 'Gesäss 1', keyFor: fixed('abduktoren'), training: 2 },
  { excelName: 'Gesäss 2', keyFor: fixed('adduktoren'), training: 2 },
  { excelName: 'Klimmzug', keyFor: fixed('klimmzuege'), training: 3 },
]

export const EXCEL_EXERCISES: ReadonlyMap<string, ExcelExercise> = new Map(
  EXERCISES.map((e) => [normalizeName(e.excelName), e]),
)

/** Erwartete Prüfwerte laut Auftrag (Abschnitt 8.2). */
export const IMPORT_EXPECTED = {
  /** Zeilen mit Datum und mindestens einer Übung (zwei davon haben dasselbe Datum, siehe Import-Vorschau). */
  trainingDays: 699,
  firstDate: '2022-10-10',
  lastDate: '2026-11-19',
  remarks: 36,
  /** Die letzten drei Tage (Datum, Rotations-Training). */
  lastDays: [
    { date: '2026-11-16', training: 1 },
    { date: '2026-11-17', training: 2 },
    { date: '2026-11-19', training: 3 },
  ],
} as const

export const DEFAULT_SETS = 3
export const MIN_TEMPLATE_HITS = 2
export const MIN_TEMPLATE_SHARE = 0.6
export const FREE_NOTE = 'Import, keinem Training zugeordnet'
