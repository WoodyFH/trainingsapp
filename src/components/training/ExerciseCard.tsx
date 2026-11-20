import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { LastLog } from '../../data/queries'
import type { LogInput } from '../../data/sessions'
import { withAlpha } from '../../lib/color'
import { describeLog } from '../../lib/volume'
import type { GymExercise, GymExerciseLog } from '../../types/db'
import { MuscleBodySVG } from '../muscle/MuscleBodySVG'
import { Stepper } from '../ui/Stepper'

interface ExerciseCardProps {
  exercise: GymExercise
  /** Eintrag dieser Einheit (falls die Übung schon abgehakt ist). */
  log: GymExerciseLog | undefined
  /** Werte vom letzten Mal. */
  last: LastLog | undefined
  color: string
  expanded: boolean
  onToggle: () => void
  onSave: (input: LogInput) => Promise<void>
  onUndo: () => Promise<void>
  onSkip?: () => void
  /** Beschriftung des Rückgängig-Knopfs (Standard: "Rückgängig"). */
  undoLabel?: string
  /** Vorsatz vor den Werten eines erledigten Eintrags (Standard: "Heute"; leer = ohne Vorsatz). */
  doneLabel?: string
}

const DEFAULTS = { sets: 3, reps: 10, seconds: 60 }

function initialValues(exercise: GymExercise, log: GymExerciseLog | undefined, last: LastLog | undefined): LogInput {
  const source = log ?? last?.log
  const isTime = exercise.load_type === 'time'
  return {
    sets: source?.sets ?? DEFAULTS.sets,
    reps: isTime ? null : (source?.reps ?? DEFAULTS.reps),
    weight_kg: isTime ? null : (source?.weight_kg ?? 0),
    seconds: isTime ? (source?.seconds ?? DEFAULTS.seconds) : null,
    increase_next: log?.increase_next ?? false,
    note: log?.note ?? null,
  }
}

function weightLabel(exercise: GymExercise): string {
  if (exercise.load_type === 'assisted') return 'Unterstützung'
  if (exercise.load_type === 'bodyweight') return 'Zusatzgewicht'
  return exercise.sides === 2 ? 'Gewicht pro Seite' : 'Gewicht'
}

function vibrate(): void {
  if ('vibrate' in navigator) navigator.vibrate?.(12)
}

export function ExerciseCard({
  exercise,
  log,
  last,
  color,
  expanded,
  onToggle,
  onSave,
  onUndo,
  onSkip,
  undoLabel = 'Rückgängig',
  doneLabel = 'Heute',
}: ExerciseCardProps) {
  const done = Boolean(log)
  const isTime = exercise.load_type === 'time'
  const [draft, setDraft] = useState<LogInput>(() => initialValues(exercise, log, last))
  const [busy, setBusy] = useState(false)

  // Beim Aufklappen mit den aktuellen Werten (heute, sonst letztes Mal) vorbelegen.
  useEffect(() => {
    if (expanded) setDraft(initialValues(exercise, log, last))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  const quickSave = () => {
    if (done || !last) {
      onToggle()
      return
    }
    vibrate()
    void run(() =>
      onSave({
        sets: last.log.sets,
        reps: last.log.reps,
        weight_kg: last.log.weight_kg,
        seconds: last.log.seconds,
        increase_next: false,
        note: null,
      }),
    )
  }

  const save = () => {
    vibrate()
    void run(() =>
      onSave({ ...draft, note: draft.note?.trim() ? draft.note.trim() : null }),
    )
  }

  const valuesText = done && log
    ? `${doneLabel ? `${doneLabel}: ` : ''}${describeLog(log, exercise.load_type)}`
    : last
      ? describeLog(last.log, exercise.load_type)
      : 'Noch nicht trainiert'

  const checkLabel = done ? 'Erledigt, Details öffnen' : last ? 'Wie letztes Mal speichern' : 'Werte eingeben'
  const panelId = `exercise-${exercise.id}`

  return (
    <article
      className={`card overflow-hidden p-4 transition-opacity ${done && !expanded ? 'opacity-60' : ''}`}
      aria-label={exercise.name}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <MuscleBodySVG
            size="sm"
            primaryMuscles={exercise.primary_muscles}
            secondaryMuscles={exercise.secondary_muscles}
            accentColor={color}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-base font-bold leading-snug text-ink">{exercise.name}</span>
            {exercise.short_name && (
              <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {exercise.short_name}
              </span>
            )}
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-zinc-500">
              <span>{valuesText}</span>
              {!done && last?.log.increase_next && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-extrabold leading-none"
                  style={{ background: withAlpha(color, 0.16), color }}
                >
                  ↑ steigern
                </span>
              )}
            </span>
          </span>
          <ChevronDown
            className={`size-5 shrink-0 text-zinc-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        <button
          type="button"
          onClick={quickSave}
          disabled={busy}
          aria-label={checkLabel}
          className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90"
          style={
            done
              ? { background: color, borderColor: color, color: '#fff' }
              : { borderColor: withAlpha(color, 0.45), color }
          }
        >
          <Check className="size-6" strokeWidth={3} aria-hidden />
        </button>
      </div>

      {expanded && (
        <div id={panelId} className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
          <div className={`grid gap-4 ${isTime ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
            <Stepper label="Sätze" value={draft.sets} min={1} max={20} onChange={(sets) => setDraft((d) => ({ ...d, sets }))} />
            {isTime ? (
              <Stepper
                label={exercise.sides === 2 ? 'Sekunden pro Seite' : 'Sekunden'}
                value={draft.seconds ?? 0}
                step={exercise.weight_step}
                max={3600}
                unit="s"
                onChange={(seconds) => setDraft((d) => ({ ...d, seconds }))}
              />
            ) : (
              <>
                <Stepper
                  label="Wiederholungen"
                  value={draft.reps ?? 0}
                  min={1}
                  max={200}
                  onChange={(reps) => setDraft((d) => ({ ...d, reps }))}
                />
                <Stepper
                  label={weightLabel(exercise)}
                  value={draft.weight_kg ?? 0}
                  step={exercise.weight_step}
                  max={999}
                  unit="kg"
                  onChange={(weight_kg) => setDraft((d) => ({ ...d, weight_kg }))}
                />
              </>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={draft.increase_next}
            onClick={() => setDraft((d) => ({ ...d, increase_next: !d.increase_next }))}
            className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-ink">↑ Nächstes Mal steigern</span>
            <span
              className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
              style={{ background: draft.increase_next ? color : '#D4D4D8' }}
              aria-hidden
            >
              <span
                className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${
                  draft.increase_next ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </span>
          </button>

          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Notiz</span>
            <input
              type="text"
              value={draft.note ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              placeholder="z. B. Einstellung 7"
              className="h-12 rounded-2xl bg-zinc-100 px-4 text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
            />
          </label>

          {exercise.notes && (
            <details className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              <summary className="cursor-pointer font-semibold text-ink">Ausführung und Einstellung</summary>
              <p className="m-0 mt-2 whitespace-pre-line leading-relaxed">{exercise.notes}</p>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-5 font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
              style={{ background: color }}
            >
              <Check className="size-5" aria-hidden />
              {done ? 'Aktualisieren' : 'Abhaken'}
            </button>
            {done && (
              <button
                type="button"
                onClick={() => void run(onUndo)}
                disabled={busy}
                className="h-12 rounded-2xl bg-zinc-100 px-5 font-semibold text-red-600"
              >
                {undoLabel}
              </button>
            )}
            {!done && onSkip && (
              <button type="button" onClick={onSkip} className="h-12 rounded-2xl bg-zinc-100 px-5 font-semibold text-zinc-600">
                Heute auslassen
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
