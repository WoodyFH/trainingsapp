import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { IMPORT_EXPECTED } from './excelMapping'
import { readEingabeSheet, type Cell, type SheetMatrix } from './excelReader'
import { assignTraining, buildImportPlan, checkAgainstExpected, type ImportContext } from './importMapping'
import { detectGroups, parseDateCell, parseNumberCell, parseSheet } from './importParser'

const CTX: ImportContext = {
  userId: '00000000-0000-4000-8000-000000000001',
  templateIds: { 1: 'tpl-1', 2: 'tpl-2', 3: 'tpl-3' },
  bodyweightKg: 75,
}

/** Baut eine kleine Tabelle im Aufbau der echten Datei (Spaltennamen der Excel-Datei). */
function matrix(rows: { date: string | Date; values: Record<string, number | string>; remark?: string }[]): SheetMatrix {
  // Spalten: A Datum, B Phys., dann Gruppen, am Ende Bemerkung
  const groups: [string, string[]][] = [
    ['Biz. Curls', ['Set.', 'Whg.', 'kg']],
    ['Dips', ['Set.', 'Whg.', 'kg']],
    ['Seitheben', ['Set.', 'Whg.', 'kg']],
    ['Schultern 3', ['Set.', 'Whg.', 'kg']],
    ['Brust 2A', ['Set.', 'Whg.', 'kg']],
    ['Rücken', ['Set.', 'Whg.', 'kg']],
    ['seitl.Plan.', ['Set.', 'sek.']],
    ['Kniebeugen', ['Set.', 'Whg.', 'kg']],
    ['Beine 3C', ['Set.', 'Whg.', 'kg']],
    ['Beine 4C', ['Set.', 'Whg.', 'kg']],
    ['O.Schenk.', ['', 'Whg.', 'kg']],
    ['Gesäss 1', ['Set.', 'Whg.', 'kg']],
    ['Gesäss 2', ['Set.', 'Whg.', 'kg']],
    ['Bauch A4', ['Set.', 'Whg.', 'kg']],
    ['Planken', ['Set.', 'sek.']],
    ['Beine 2A', ['Set.', 'Whg.', 'kg']],
    ['Leg Raises', ['Set.', 'Whg.', 'kg']],
    ['seitl. Bauch', ['Set.', 'Whg.', 'kg']],
    ['Unter. Rück. 2', ['Set.', 'Whg.', 'kg']],
    ['Klimmzug', ['Set.', 'Whg.', 'kg']],
  ]
  const header1: Cell[] = [null, null, 'Phys.']
  const header2: Cell[] = [null, 'Datum', null]
  const columnOf = new Map<string, number>()
  for (const [name, subs] of groups) {
    for (const sub of subs) {
      header1.push(name)
      header2.push(sub === '' ? null : sub)
      columnOf.set(`${name}|${sub === '' ? 'Set.' : sub}`, header1.length - 1)
    }
  }
  header1.push(null)
  header2.push('Bemerkung')
  const remarkColumn = header1.length - 1

  return {
    header1,
    header2,
    rows: rows.map((r, i) => {
      const cells: Cell[] = Array.from({ length: header1.length }, () => null)
      cells[1] = typeof r.date === 'string' ? new Date(`${r.date}T00:00:00.000Z`) : r.date
      cells[2] = false
      for (const [key, value] of Object.entries(r.values)) {
        const col = columnOf.get(key)
        if (col === undefined) throw new Error(`Unbekannter Testschlüssel ${key}`)
        cells[col] = value
      }
      if (r.remark) cells[remarkColumn] = r.remark
      return { row: i + 3, cells }
    }),
  }
}

const full = (name: string, sets = 3, reps = 10, kg = 20): Record<string, number> => ({
  [`${name}|Set.`]: sets,
  [`${name}|Whg.`]: reps,
  [`${name}|kg`]: kg,
})

describe('Zellen lesen', () => {
  it('liest Zahlen auch als Text mit Punkt oder Komma', () => {
    expect(parseNumberCell(55)).toEqual({ value: 55, unreadable: false })
    expect(parseNumberCell('55.')).toEqual({ value: 55, unreadable: false })
    expect(parseNumberCell('17,5')).toEqual({ value: 17.5, unreadable: false })
    expect(parseNumberCell(null)).toEqual({ value: null, unreadable: false })
    expect(parseNumberCell('abc')).toEqual({ value: null, unreadable: true })
    expect(parseNumberCell(true)).toEqual({ value: null, unreadable: true })
  })

  it('liest Datumszellen als UTC-Kalendertag', () => {
    expect(parseDateCell(new Date('2026-11-19T00:00:00.000Z'))).toBe('2026-11-19')
    expect(parseDateCell('19.11.2026')).toBe('2026-11-19')
    expect(parseDateCell('2026-11-19')).toBe('2026-11-19')
    expect(parseDateCell('kein Datum')).toBeNull()
    expect(parseDateCell(null)).toBeNull()
  })
})

describe('Spaltengruppen', () => {
  it('erkennt Gruppen, die Beschriftungen, die unbeschriftete Set.-Spalte und die Bemerkung', () => {
    const { groups, remarkColumn, dateColumn } = detectGroups(matrix([]))
    expect(dateColumn).toBe(1)
    expect(groups.find((g) => g.name === 'Phys.')).toBeUndefined()
    const planken = groups.find((g) => g.name === 'Planken')!
    expect(planken.seconds).toBeDefined()
    expect(planken.reps).toBeUndefined()
    const schenk = groups.find((g) => g.name === 'O.Schenk.')!
    expect(schenk.set).toBeDefined() // Spalte ohne Kopf zählt als "Set."
    expect(schenk.reps).toBeDefined()
    expect(remarkColumn).toBeGreaterThan(schenk.kg ?? 0)
  })
})

describe('Import-Plan', () => {
  it('überspringt Zeilen ohne Datum und Tage ohne Übung und zählt Bemerkungen', () => {
    const m = matrix([
      { date: '2026-11-16', values: { ...full('Biz. Curls'), ...full('Dips'), ...full('Brust 2A') }, remark: 'gut' },
      { date: '2026-11-17', values: {}, remark: 'nur Notiz' },
      { date: '2026-11-18', values: {} },
    ])
    m.rows.push({ row: 99, cells: Array.from({ length: m.header1.length }, () => null) })
    const parsed = parseSheet(m)
    expect(parsed.datedRows).toBe(3)
    expect(parsed.emptyDateRows).toBe(2)
    expect(parsed.remarksFound).toBe(2)
    expect(parsed.warnings.map((w) => w.code)).toEqual(['remark-without-exercises'])
    const plan = buildImportPlan(parsed, CTX)
    expect(plan.stats.sessionCount).toBe(1)
    expect(plan.stats.remarksImported).toBe(1)
    expect(plan.sessions[0]?.note).toBe('gut')
  })

  it('teilt Dips am 17.11.2023 in Trizepsmaschine und Dips am Barren', () => {
    const plan = buildImportPlan(
      parseSheet(
        matrix([
          { date: '2023-11-16', values: { ...full('Dips', 3, 10, 40), ...full('Brust 2A'), ...full('Biz. Curls') } },
          { date: '2023-11-17', values: { ...full('Dips', 3, 8, 25), ...full('Brust 2A'), ...full('Biz. Curls') } },
        ]),
      ),
      CTX,
    )
    expect(plan.stats.perExercise).toMatchObject({ trizepsmaschine: 1, dips: 1 })
    // beide Tage gehören trotz Umstellung zu Training 1 (Zuordnung nach Excel-Name)
    expect(plan.sessions.map((s) => s.template_id)).toEqual(['tpl-1', 'tpl-1'])
  })

  it('teilt Schultern 3 am 06.01.2025 in Maschine und Kurzhantel (Seiten 1 bzw. 2)', () => {
    const plan = buildImportPlan(
      parseSheet(
        matrix([
          { date: '2025-01-05', values: { ...full('Schultern 3', 3, 10, 60), ...full('Brust 2A'), ...full('Rücken') } },
          { date: '2025-01-06', values: { ...full('Schultern 3', 3, 10, 14), ...full('Brust 2A'), ...full('Rücken') } },
        ]),
      ),
      CTX,
    )
    expect(plan.stats.perExercise).toMatchObject({ schulterdruecken_maschine: 1, schulterdruecken_kh: 1 })
    const sidesByDate = Object.fromEntries(
      plan.logs
        .filter((l) => plan.sessions.find((s) => s.id === l.session_id)?.date && l.weight_kg !== null && [60, 14].includes(l.weight_kg))
        .map((l) => [l.weight_kg, l.sides]),
    )
    expect(sidesByDate).toEqual({ 60: 1, 14: 2 })
  })

  it('setzt Seiten = 1 für Beine 3C vor dem 16.04.2023 und Beine 4C vor dem 25.02.2023', () => {
    const base = { ...full('Gesäss 1'), ...full('Gesäss 2') }
    const plan = buildImportPlan(
      parseSheet(
        matrix([
          { date: '2023-02-24', values: { ...base, ...full('Beine 3C', 3, 10, 100), ...full('Beine 4C', 3, 10, 80) } },
          { date: '2023-04-15', values: { ...base, ...full('Beine 3C', 3, 10, 101), ...full('Beine 4C', 3, 10, 81) } },
          { date: '2023-04-16', values: { ...base, ...full('Beine 3C', 3, 10, 102), ...full('Beine 4C', 3, 10, 82) } },
        ]),
      ),
      CTX,
    )
    const sides = (kg: number) => plan.logs.find((l) => l.weight_kg === kg)?.sides
    expect([sides(100), sides(80)]).toEqual([1, 1])
    expect([sides(101), sides(81)]).toEqual([1, 2]) // 3C erst ab 16.04.2023 einbeinig, 4C schon ab 25.02.2023
    expect([sides(102), sides(82)]).toEqual([2, 2])
  })

  it('liest Planken und seitliches Planken als Sekunden und ergänzt fehlende Sätze mit 3 samt Warnung', () => {
    const plan = buildImportPlan(
      parseSheet(
        matrix([
          {
            date: '2026-11-16',
            values: { 'seitl.Plan.|Set.': 3, 'seitl.Plan.|sek.': 75, ...full('Rücken'), ...full('Brust 2A'), 'Kniebeugen|Whg.': 11, 'Kniebeugen|kg': '34.' },
          },
        ]),
      ),
      CTX,
    )
    const plank = plan.logs.find((l) => l.seconds !== null)
    expect(plank).toMatchObject({ sets: 3, seconds: 75, reps: null, weight_kg: null, sides: 2 })
    const squat = plan.logs.find((l) => l.weight_kg === 34)
    expect(squat).toMatchObject({ sets: 3, reps: 11 })
    expect(plan.warnings.filter((w) => w.code === 'sets-missing')).toHaveLength(1)
  })

  it('nimmt die unbeschriftete Set.-Spalte von O.Schenk. als Sätze', () => {
    const plan = buildImportPlan(
      parseSheet(
        matrix([{ date: '2026-11-17', values: { 'O.Schenk.|Set.': 3, 'O.Schenk.|Whg.': 11, 'O.Schenk.|kg': 20, ...full('Gesäss 1'), ...full('Gesäss 2') } }]),
      ),
      CTX,
    )
    expect(plan.logs.find((l) => l.weight_kg === 20)).toMatchObject({ sets: 3, reps: 11, sides: 2 })
    expect(plan.warnings.filter((w) => w.code === 'sets-missing')).toHaveLength(0)
  })

  it('verwendet stabile IDs, sodass ein zweiter Import dieselben Zeilen trifft', () => {
    const m = matrix([{ date: '2026-11-16', values: { ...full('Biz. Curls'), ...full('Dips'), ...full('Brust 2A') } }])
    const a = buildImportPlan(parseSheet(m), CTX)
    const b = buildImportPlan(parseSheet(m), CTX)
    expect(a.sessions.map((s) => s.id)).toEqual(b.sessions.map((s) => s.id))
    expect(a.logs.map((l) => l.id)).toEqual(b.logs.map((l) => l.id))
    expect(a.sessions[0]).toMatchObject({ source: 'import', finished_at: '2026-11-16T12:00:00.000Z' })
  })

  it('fasst mehrere Zeilen mit demselben Datum zu einer Einheit zusammen', () => {
    const plan = buildImportPlan(
      parseSheet(
        matrix([
          { date: '2026-11-16', values: { ...full('Biz. Curls'), ...full('Dips') } },
          { date: '2026-11-16', values: { ...full('Brust 2A') } },
        ]),
      ),
      CTX,
    )
    expect(plan.stats.sessionCount).toBe(1)
    expect(plan.stats.logCount).toBe(3)
    expect(plan.warnings.some((w) => w.code === 'duplicate')).toBe(true)
  })
})

describe('Zuordnung zum Training', () => {
  it('braucht mindestens 2 Treffer und 60 % der Übungen des Tages', () => {
    expect(assignTraining({ 1: 7, 2: 0, 3: 0 }, 7)).toBe(1)
    expect(assignTraining({ 1: 0, 2: 5, 3: 0 }, 5)).toBe(2)
    expect(assignTraining({ 1: 1, 2: 0, 3: 0 }, 1)).toBeNull() // nur eine Übung
    expect(assignTraining({ 1: 3, 2: 0, 3: 2 }, 8)).toBeNull() // 3/8 = 37,5 %
    expect(assignTraining({ 1: 3, 2: 0, 3: 0 }, 5)).toBe(1) // 60 % genau
    expect(assignTraining({ 1: 0, 2: 0, 3: 0 }, 4)).toBeNull()
  })

  it('importiert Tage ohne passendes Training als Freitraining mit Hinweis', () => {
    const plan = buildImportPlan(
      parseSheet(
        matrix([
          {
            date: '2026-11-16',
            values: { ...full('Biz. Curls'), ...full('Bauch A4'), ...full('Seitheben'), ...full('Gesäss 1') },
            remark: 'Mix',
          },
        ]),
      ),
      CTX,
    )
    expect(plan.sessions[0]).toMatchObject({
      kind: 'free',
      template_id: null,
      note: 'Mix\nImport, keinem Training zugeordnet',
    })
    expect(plan.stats.byTraining.free).toBe(1)
  })

  it('importiert als Freitraining, wenn das Training in der App fehlt', () => {
    const plan = buildImportPlan(
      parseSheet(matrix([{ date: '2026-11-16', values: { ...full('Biz. Curls'), ...full('Dips'), ...full('Brust 2A') } }])),
      { ...CTX, templateIds: { 2: 'tpl-2', 3: 'tpl-3' } },
    )
    expect(plan.sessions[0]?.kind).toBe('free')
  })
})

describe('Prüfwerte', () => {
  it('meldet Abweichungen von den erwarteten Werten', () => {
    const plan = buildImportPlan(
      parseSheet(matrix([{ date: '2026-11-16', values: { ...full('Biz. Curls'), ...full('Dips'), ...full('Brust 2A') } }])),
      CTX,
    )
    const checks = checkAgainstExpected(plan)
    expect(checks.find((c) => c.label.startsWith('Trainingstage'))).toMatchObject({ expected: '699', actual: '1', ok: false })
  })
})

const REAL_FILE = new URL('../../private/Workouts.xlsx', import.meta.url)

describe.skipIf(!existsSync(REAL_FILE))('echte Datei private/Workouts.xlsx', () => {
  it('liefert die erwarteten Prüfwerte aus dem Auftrag', async () => {
    const buffer = readFileSync(REAL_FILE)
    const sheet = await readEingabeSheet(new Uint8Array(buffer))
    const parsed = parseSheet(sheet)
    const plan = buildImportPlan(parsed, CTX)
    const checks = checkAgainstExpected(plan)

    // Ausgabe zur Kontrolle
    const byCode: Record<string, number> = {}
    for (const w of plan.warnings) byCode[w.code] = (byCode[w.code] ?? 0) + 1
    console.log(
      JSON.stringify(
        {
          datedRows: parsed.datedRows,
          emptyDateRows: parsed.emptyDateRows,
          stats: { ...plan.stats, perExercise: undefined },
          perExercise: plan.stats.perExercise,
          warnings: byCode,
          checks: checks.map((c) => `${c.ok ? 'OK ' : 'FEHLER '}${c.label}: erwartet ${c.expected}, gefunden ${c.actual}`),
        },
        null,
        1,
      ),
    )

    // 699 Zeilen mit Übungen; Zeile 568 und 569 haben dasselbe Datum (06.10.2025) und werden zu einer Einheit.
    expect(plan.stats.sourceRows).toBe(IMPORT_EXPECTED.trainingDays)
    expect(plan.stats.sessionCount).toBe(IMPORT_EXPECTED.trainingDays - 1)
    expect(plan.warnings.filter((w) => w.code === 'duplicate').map((w) => w.date)).toEqual(['2025-10-06'])
    // Zeile 164 hat Einträge ohne Datum
    expect(plan.warnings.filter((w) => w.code === 'row-without-date')).toHaveLength(1)
    expect(plan.stats.firstDate).toBe(IMPORT_EXPECTED.firstDate)
    expect(plan.stats.lastDate).toBe(IMPORT_EXPECTED.lastDate)
    expect(parsed.remarksFound).toBe(IMPORT_EXPECTED.remarks)
    expect(checks.filter((c) => !c.ok)).toEqual([])
  }, 60_000)
})
