import { CircleAlert, CircleCheck, FileSpreadsheet, LoaderCircle, TriangleAlert, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { formatDate, formatNumber } from '../lib/date'
import { readEingabeSheet } from '../import/excelReader'
import { buildImportPlan, checkAgainstExpected, type ExpectedCheck, type ImportPlan } from '../import/importMapping'
import { parseSheet, type ImportWarning, type WarningCode } from '../import/importParser'
import {
  applyImport,
  countImportedSessions,
  deleteImportedData,
  findAppSessionConflicts,
  loadImportContext,
  type ImportProgress,
  type ImportResult,
} from '../import/importWriter'
import { TRAINING_COLORS } from '../lib/trainingColors'

const WARNING_TITLES: Record<WarningCode, string> = {
  'sets-missing': 'Fehlende Sätze (es werden 3 angenommen)',
  'reps-missing': 'Fehlende Wiederholungen',
  'weight-missing': 'Fehlendes Gewicht',
  'seconds-missing': 'Fehlende Sekunden',
  unreadable: 'Werte, die keine Zahl sind',
  'unknown-column': 'Unbekannte Spalten',
  duplicate: 'Datum mehrfach vorhanden',
  'remark-without-exercises': 'Bemerkung an einem Tag ohne Übung',
  'row-without-date': 'Zeile ohne Datum',
  'existing-app-session': 'Schon in der App vorhandene Einheiten',
  'exercise-restored': 'Wiederhergestellte Übungen',
}

const PROGRESS_TEXT: Record<ImportProgress['phase'], string> = {
  exercises: 'Übungen vorbereiten',
  sessions: 'Einheiten schreiben',
  logs: 'Einträge schreiben',
}

type Step =
  | { name: 'idle' }
  | { name: 'reading'; fileName: string }
  | { name: 'preview'; fileName: string; plan: ImportPlan; checks: ExpectedCheck[]; warnings: ImportWarning[] }
  | { name: 'importing'; progress: ImportProgress | null }
  | { name: 'done'; result: ImportResult }
  | { name: 'error'; message: string }

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-zinc-50 p-4">
      <span className="label-caps">{label}</span>
      <span className="text-2xl font-extrabold tabular-nums text-ink">{value}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  )
}

function WarningGroups({ warnings }: { warnings: ImportWarning[] }) {
  const groups = new Map<WarningCode, ImportWarning[]>()
  for (const w of warnings) groups.set(w.code, [...(groups.get(w.code) ?? []), w])
  if (groups.size === 0) {
    return <p className="m-0 text-sm text-zinc-500">Keine Warnungen.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {[...groups.entries()].map(([code, list]) => (
        <details key={code} className="rounded-2xl bg-zinc-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            {WARNING_TITLES[code]} ({list.length})
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-sm text-zinc-600">
            {list.slice(0, 100).map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
            {list.length > 100 && <li className="text-zinc-400">… und {list.length - 100} weitere</li>}
          </ul>
        </details>
      ))}
    </div>
  )
}

export function ImportPage() {
  const { userId } = useAuth()
  const [step, setStep] = useState<Step>({ name: 'idle' })
  const [undoMessage, setUndoMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = async (file: File) => {
    if (!userId) return
    setStep({ name: 'reading', fileName: file.name })
    try {
      const sheet = await readEingabeSheet(await file.arrayBuffer())
      const parsed = parseSheet(sheet)
      const ctx = await loadImportContext(userId)
      const plan = buildImportPlan(parsed, ctx)
      const conflicts = await findAppSessionConflicts(plan)
      setStep({
        name: 'preview',
        fileName: file.name,
        plan,
        checks: checkAgainstExpected(plan),
        warnings: [...plan.warnings, ...conflicts],
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setStep({
        name: 'error',
        message: /zip|corrupt|end of central directory|Can't find/i.test(message)
          ? 'Die Datei konnte nicht gelesen werden. Wähle eine Excel-Datei im Format .xlsx.'
          : message,
      })
    }
  }

  const runImport = async (plan: ImportPlan) => {
    if (!userId) return
    setStep({ name: 'importing', progress: null })
    try {
      const result = await applyImport(plan, userId, (progress) => setStep({ name: 'importing', progress }))
      setStep({ name: 'done', result })
    } catch (e) {
      setStep({ name: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const undo = async () => {
    const before = await countImportedSessions()
    if (before === 0) return
    const result = await deleteImportedData()
    setUndoMessage(`${result.sessions} Einheiten und ${result.logs} Einträge wurden gelöscht.`)
    setStep({ name: 'idle' })
  }

  return (
    <div className="flex flex-col gap-4 lg:max-w-2xl">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        aria-label="Excel-Datei auswählen"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void readFile(file)
        }}
      />

      {undoMessage && step.name === 'idle' && (
        <p role="status" className="m-0 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {undoMessage}
        </p>
      )}

      {(step.name === 'idle' || step.name === 'error') && (
        <section className="card flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
              <FileSpreadsheet className="size-6" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-lg font-extrabold text-ink">Alte Excel-Liste importieren</h2>
              <p className="m-0 text-sm leading-relaxed text-zinc-500">
                Die Datei wird nur in deinem Browser gelesen und nicht hochgeladen. Danach siehst du eine Vorschau, und erst
                nach deiner Bestätigung wird etwas gespeichert. Es zählt nur das Blatt „Eingabe“.
              </p>
            </div>
          </div>
          {step.name === 'error' && (
            <p role="alert" className="m-0 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {step.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-base font-bold text-white transition active:scale-[0.98]"
          >
            <Upload className="size-5" aria-hidden />
            Excel-Datei wählen
          </button>
        </section>
      )}

      {step.name === 'reading' && (
        <section className="card flex items-center gap-3 p-5" role="status">
          <LoaderCircle className="size-5 animate-spin text-zinc-400" aria-hidden />
          <span className="text-sm text-zinc-600">„{step.fileName}“ wird gelesen …</span>
        </section>
      )}

      {step.name === 'preview' && (
        <>
          <section className="card flex flex-col gap-4 p-5" aria-label="Vorschau">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-lg font-extrabold text-ink">Vorschau</h2>
              <p className="m-0 text-sm text-zinc-500">Datei: {step.fileName}. Noch nichts gespeichert.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Einheiten"
                value={String(step.plan.stats.sessionCount)}
                hint={
                  step.plan.stats.sourceRows !== step.plan.stats.sessionCount
                    ? `aus ${step.plan.stats.sourceRows} Zeilen`
                    : undefined
                }
              />
              <Stat label="Einträge" value={formatNumber(step.plan.stats.logCount, 0)} />
              <Stat
                label="Zeitraum"
                value={step.plan.stats.firstDate ? formatDate(step.plan.stats.firstDate) : '–'}
                hint={step.plan.stats.lastDate ? `bis ${formatDate(step.plan.stats.lastDate)}` : undefined}
              />
              <Stat label="Bemerkungen" value={`${step.plan.stats.remarksImported}`} hint={`von ${step.plan.stats.remarksFound} in der Datei`} />
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="label-caps m-0">Zuordnung</h3>
              <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 text-sm">
                {(['1', '2', '3'] as const).map((n) => {
                  const color = TRAINING_COLORS[`training${n}` as 'training1' | 'training2' | 'training3']
                  return (
                    <li key={n} className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <span className="size-3 rounded-full" style={{ background: color }} aria-hidden />
                        Training {n}
                      </span>
                      <span className="tabular-nums text-zinc-600">{step.plan.stats.byTraining[n]}</span>
                    </li>
                  )
                })}
                <li className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    <span className="size-3 rounded-full" style={{ background: TRAINING_COLORS.free }} aria-hidden />
                    Freitraining
                  </span>
                  <span className="tabular-nums text-zinc-600">{step.plan.stats.byTraining.free}</span>
                </li>
              </ul>
              <p className="m-0 text-xs leading-relaxed text-zinc-500">
                Ein Tag wird einem Training zugeordnet, wenn mindestens 2 Übungen und 60 % der Übungen des Tages dazu passen.
                Alle anderen Tage, zum Beispiel aus der Zeit mit anderer Aufteilung, kommen als Freitraining in die App.
              </p>
            </div>
          </section>

          <section className="card flex flex-col gap-3 p-5" aria-label="Prüfwerte">
            <h3 className="label-caps m-0">Prüfwerte</h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
              {step.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  {c.ok ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="stimmt" />
                  ) : (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="weicht ab" />
                  )}
                  <span className="text-zinc-700">
                    <strong className="font-semibold text-ink">{c.label}:</strong> {c.actual}
                    {!c.ok && <span className="text-amber-700"> (erwartet {c.expected})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card flex flex-col gap-3 p-5" aria-label="Warnungen">
            <h3 className="label-caps m-0">Warnungen ({step.warnings.length})</h3>
            <WarningGroups warnings={step.warnings} />
          </section>

          <p className="m-0 rounded-2xl bg-white p-4 text-xs leading-relaxed text-zinc-500 shadow-sm">
            Hinweis zum Volumen: Bei Übungen mit Kurzhanteln, einbeinigen Geräten oder seitlichen Übungen rechnet die App mit
            dem Seiten-Faktor. Das Volumen liegt dort bewusst über den Werten der alten Excel. Importierte Einheiten lassen
            sich jederzeit über „Alle importierten Daten löschen“ wieder entfernen.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runImport(step.plan)}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-6 text-base font-bold text-white transition active:scale-[0.98]"
            >
              {step.plan.stats.sessionCount} Einheiten importieren
            </button>
            <button
              type="button"
              onClick={() => setStep({ name: 'idle' })}
              className="h-14 rounded-2xl bg-white px-6 font-semibold text-zinc-600 shadow-sm"
            >
              Abbrechen
            </button>
          </div>
        </>
      )}

      {step.name === 'importing' && (
        <section className="card flex flex-col gap-3 p-5" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <LoaderCircle className="size-5 animate-spin text-zinc-400" aria-hidden />
            <span className="text-sm font-semibold text-ink">
              {step.progress ? PROGRESS_TEXT[step.progress.phase] : 'Import startet'} …
            </span>
          </div>
          {step.progress && step.progress.total > 0 && (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
                <div
                  className="h-full rounded-full bg-zinc-900 transition-all"
                  style={{ width: `${Math.round((step.progress.done / step.progress.total) * 100)}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-zinc-500">
                {step.progress.done} von {step.progress.total}
              </span>
            </>
          )}
        </section>
      )}

      {step.name === 'done' && (
        <section className="card flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CircleCheck className="size-6" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-lg font-extrabold text-ink">Import abgeschlossen</h2>
              <p className="m-0 text-sm leading-relaxed text-zinc-500">
                {step.result.sessions} Einheiten und {formatNumber(step.result.logs, 0)} Einträge sind gespeichert. Sie werden
                jetzt mit dem Server synchronisiert; das dauert bei so vielen Daten einen Moment. Den Stand siehst du an der
                Wolke oben rechts.
              </p>
              {step.result.restoredExercises.length > 0 && (
                <p className="m-0 text-sm text-zinc-500">
                  Wieder angelegt (archiviert): {step.result.restoredExercises.join(', ')}.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/" className="flex h-12 items-center rounded-2xl bg-zinc-900 px-5 font-bold text-white">
              Zur Startseite
            </Link>
            <button type="button" onClick={() => void undo()} className="h-12 rounded-2xl bg-zinc-100 px-5 font-semibold text-red-600">
              Import rückgängig machen
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
