import { Archive, ArchiveRestore, Check, SearchX, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MuscleBodySVG } from '../components/muscle/MuscleBodySVG'
import { EmptyState } from '../components/ui/EmptyState'
import { Segmented } from '../components/ui/Segmented'
import { Stepper } from '../components/ui/Stepper'
import { useExercise, useExerciseHistoryCount } from '../data/planQueries'
import {
  createExercise,
  removeExercise,
  setExerciseArchived,
  updateExercise,
  validateExercise,
  type ExerciseInput,
} from '../data/plans'
import { TRAINING_COLORS } from '../lib/trainingColors'
import type { LoadType, Sides } from '../types/db'
import { MUSCLE_LABELS, type MuscleId } from '../types/muscles'

const COLOR = TRAINING_COLORS.training1

const EMPTY: ExerciseInput = {
  name: '',
  short_name: null,
  load_type: 'weight',
  sides: 1,
  weight_step: 5,
  notes: null,
  primary_muscles: [],
  secondary_muscles: [],
}

const DEFAULT_STEP: Record<LoadType, number> = { weight: 5, assisted: 5, bodyweight: 5, time: 15 }

const LOAD_OPTIONS: { value: LoadType; label: string; hint: string }[] = [
  { value: 'weight', label: 'Gewicht', hint: 'Sätze × Wiederholungen × kg' },
  { value: 'assisted', label: 'Unterstützung', hint: 'Gegengewicht am Unterstützungsgerät' },
  { value: 'bodyweight', label: 'Körpergewicht', hint: 'Wiederholungen mit optionalem Zusatzgewicht' },
  { value: 'time', label: 'Zeit', hint: 'Haltezeit in Sekunden' },
]

function toInput(e: {
  name: string
  short_name: string | null
  load_type: LoadType
  sides: Sides
  weight_step: number
  notes: string | null
  primary_muscles: MuscleId[]
  secondary_muscles: MuscleId[]
}): ExerciseInput {
  return {
    name: e.name,
    short_name: e.short_name,
    load_type: e.load_type,
    sides: e.sides,
    weight_step: e.weight_step,
    notes: e.notes,
    primary_muscles: [...e.primary_muscles],
    secondary_muscles: [...e.secondary_muscles],
  }
}

/** Übung anlegen (id = "neu") oder bearbeiten. Muskeln werden am großen Männchen gewählt. */
export function ExerciseEditorPage() {
  const { id } = useParams()
  const isNew = id === 'neu'
  const navigate = useNavigate()
  const exercise = useExercise(isNew ? undefined : id)
  const historyCount = useExerciseHistoryCount(isNew ? undefined : id)

  const [form, setForm] = useState<ExerciseInput>(EMPTY)
  const [loaded, setLoaded] = useState(isNew)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (exercise && !loaded) {
      setForm(toInput(exercise))
      setLoaded(true)
    }
  }, [exercise, loaded])

  if (!isNew && exercise === null) {
    return (
      <EmptyState Icon={SearchX} title="Übung nicht gefunden">
        Diese Übung gibt es nicht mehr.
      </EmptyState>
    )
  }
  if (!loaded) return <div className="card h-48 animate-pulse" role="status" aria-label="Lädt" />

  const set = <K extends keyof ExerciseInput>(key: K, value: ExerciseInput[K]) => {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: value }))
  }

  /** Einmal tippen primär, zweimal sekundär, dreimal aus. */
  const cycleMuscle = (m: MuscleId) => {
    setSaved(false)
    setForm((f) => {
      if (f.primary_muscles.includes(m)) {
        return {
          ...f,
          primary_muscles: f.primary_muscles.filter((x) => x !== m),
          secondary_muscles: [...f.secondary_muscles, m],
        }
      }
      if (f.secondary_muscles.includes(m)) {
        return { ...f, secondary_muscles: f.secondary_muscles.filter((x) => x !== m) }
      }
      return { ...f, primary_muscles: [...f.primary_muscles, m] }
    })
  }

  const changeLoadType = (loadType: LoadType) => {
    setSaved(false)
    setForm((f) => ({
      ...f,
      load_type: loadType,
      // Schritt auf den Standard des neuen Lasttyps setzen, solange er nicht selbst angepasst wurde.
      weight_step: f.weight_step === DEFAULT_STEP[f.load_type] ? DEFAULT_STEP[loadType] : f.weight_step,
    }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = validateExercise(form)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    if (isNew) {
      const created = await createExercise(form)
      navigate(`/plaene/uebung/${created.id}`, { replace: true })
    } else if (id) {
      await updateExercise(id, form)
    }
    setSaved(true)
  }

  const remove = async () => {
    if (!id) return
    const result = await removeExercise(id)
    if (result === 'deleted') navigate('/plaene/uebungen', { replace: true })
    setConfirmRemove(false)
  }

  const isTime = form.load_type === 'time'
  const hasHistory = (historyCount ?? 0) > 0

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start"
      noValidate
    >
      <section className="card flex flex-col items-center gap-3 p-5 lg:order-2" aria-label="Muskeln">
        <h2 className="label-caps m-0 self-start">Muskeln</h2>
        <MuscleBodySVG
          size="lg"
          selectable
          primaryMuscles={form.primary_muscles}
          secondaryMuscles={form.secondary_muscles}
          accentColor={COLOR}
          onMuscleClick={cycleMuscle}
        />
        <p className="m-0 text-center text-xs text-zinc-500">
          Einmal tippen primär, zweimal sekundär, dreimal aus.
        </p>
        <dl className="m-0 grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-semibold text-ink">Primär</dt>
          <dd className="m-0 text-zinc-600">
            {form.primary_muscles.length ? form.primary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ') : '–'}
          </dd>
          <dt className="font-semibold text-ink">Sekundär</dt>
          <dd className="m-0 text-zinc-600">
            {form.secondary_muscles.length ? form.secondary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ') : '–'}
          </dd>
        </dl>
      </section>

      <div className="flex flex-col gap-4 lg:order-1">
        <section className="card flex flex-col gap-4 p-5" aria-label="Eigenschaften">
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="z. B. Beinpresse liegend"
              className="h-12 rounded-2xl bg-zinc-100 px-4 text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Gerätebezeichnung</span>
            <input
              type="text"
              value={form.short_name ?? ''}
              onChange={(e) => set('short_name', e.target.value)}
              placeholder="z. B. Beine 3C"
              className="h-12 rounded-2xl bg-zinc-100 px-4 text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="label-caps">Lasttyp</span>
            <Segmented
              label="Lasttyp"
              value={form.load_type}
              onChange={changeLoadType}
              color={COLOR}
              options={LOAD_OPTIONS.map((o) => ({ value: o.value, label: o.label, hint: o.hint }))}
            />
            <p className="m-0 text-xs text-zinc-500">{LOAD_OPTIONS.find((o) => o.value === form.load_type)?.hint}</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="label-caps">Seiten</span>
            <Segmented
              label="Seiten"
              value={form.sides}
              onChange={(v) => set('sides', v)}
              color={COLOR}
              options={[
                { value: 1, label: 'Beidseitig', hint: 'Gesamtgewicht, ohne Seitenbezug' },
                { value: 2, label: 'Pro Seite', hint: 'kg pro Hand oder Bein, Wdh. pro Seite' },
              ]}
            />
            <p className="m-0 text-xs text-zinc-500">
              {form.sides === 2
                ? 'Kurzhanteln, einbeinige Maschinen oder seitliche Übungen: das Volumen wird mit 2 multipliziert.'
                : 'Beide Seiten gleichzeitig mit Gesamtgewicht.'}
            </p>
          </div>

          <Stepper
            label={isTime ? 'Schritt (Sekunden)' : 'Schritt (kg)'}
            value={form.weight_step}
            onChange={(v) => set('weight_step', v)}
            step={isTime ? 5 : 0.5}
            min={0.5}
            max={isTime ? 300 : 50}
            unit={isTime ? 's' : 'kg'}
          />

          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Notiz (Ausführung, Geräteeinstellung)</span>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={5}
              placeholder="z. B. Einstellung 7. Sitzend, Beine starten gestreckt …"
              className="resize-y rounded-2xl bg-zinc-100 px-4 py-3 text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
            />
          </label>
        </section>

        {error && (
          <p role="alert" className="m-0 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition active:scale-[0.98]"
          style={{ background: COLOR }}
        >
          <Check className="size-5" aria-hidden />
          {saved ? 'Gespeichert' : isNew ? 'Übung anlegen' : 'Speichern'}
        </button>

        {!isNew && exercise && (
          <section className="card flex flex-col gap-3 p-5" aria-label="Archivieren und Löschen">
            <p className="m-0 text-sm text-zinc-500">
              {hasHistory
                ? `Diese Übung hat ${historyCount} ${historyCount === 1 ? 'Eintrag' : 'Einträge'} in der Historie. Sie wird archiviert statt gelöscht, die Einträge bleiben erhalten.`
                : 'Diese Übung hat noch keine Historie und kann gelöscht werden.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void setExerciseArchived(exercise.id, !exercise.archived)}
                className="flex h-11 items-center gap-2 rounded-2xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-700"
              >
                {exercise.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
                {exercise.archived ? 'Wiederherstellen' : 'Archivieren'}
              </button>
              {confirmRemove ? (
                <button
                  type="button"
                  onClick={() => void remove()}
                  className="h-11 rounded-2xl bg-red-600 px-4 text-sm font-semibold text-white"
                >
                  {hasHistory ? 'Wirklich archivieren' : 'Wirklich löschen'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="flex h-11 items-center gap-2 rounded-2xl bg-zinc-100 px-4 text-sm font-semibold text-red-600"
                >
                  <Trash2 className="size-4" aria-hidden />
                  {hasHistory ? 'Entfernen' : 'Löschen'}
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </form>
  )
}
