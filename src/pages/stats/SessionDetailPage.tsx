import { Check, ChevronDown, SearchX, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Loading } from '../../components/stats/shared'
import { ExerciseCard } from '../../components/training/ExerciseCard'
import { DateField } from '../../components/ui/DateField'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  deleteCardioLog,
  deleteSession,
  hasCardioValue,
  moveSessionDate,
  saveExerciseLog,
  setSessionNote,
  undoExerciseLog,
  updateCardioLog,
  type CardioInput,
  type LogInput,
} from '../../data/sessions'
import { distanceFieldUnit, distanceLabel, formatDistance } from '../../lib/cardio'
import { withAlpha } from '../../lib/color'
import { formatDate, formatNumber } from '../../lib/date'
import { TRAINING_COLORS } from '../../lib/trainingColors'
import { buildSessionStats } from '../../stats/compute'
import { useStatsData } from '../../stats/useStatsData'
import type { GymCardioLog, GymCardioType, GymExercise } from '../../types/db'

function parseField(text: string): number | null {
  const v = Number.parseFloat(text.replace(',', '.'))
  return Number.isNaN(v) ? null : v
}

const toText = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))

function CardioRow({ log, type }: { log: GymCardioLog; type: GymCardioType | undefined }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    duration: toText(log.duration_min),
    kcal: toText(log.kcal),
    hr: toText(log.avg_hr),
    distance: toText(log.distance),
    note: log.note ?? '',
  })

  const save = async () => {
    const intOrNull = (t: string) => {
      const v = parseField(t)
      return v === null ? null : Math.round(v)
    }
    const input: CardioInput = {
      duration_min: parseField(form.duration),
      kcal: intOrNull(form.kcal),
      avg_hr: intOrNull(form.hr),
      distance: parseField(form.distance),
      note: form.note.trim() ? form.note.trim() : null,
    }
    if (!hasCardioValue(input)) {
      setError('Fülle mindestens einen Wert aus.')
      return
    }
    setError(null)
    await updateCardioLog(log.id, input)
    setOpen(false)
  }

  const summary = [
    log.duration_min !== null ? `${formatNumber(log.duration_min)} min` : null,
    log.kcal !== null ? `${log.kcal} kcal` : null,
    log.avg_hr !== null ? `Ø ${log.avg_hr} bpm` : null,
    log.distance !== null ? formatDistance(log.distance, type?.distance_unit) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const field = (label: string, key: keyof typeof form, unit: string) => (
    <label className="flex flex-col gap-1">
      <span className="label-caps">{label}</span>
      <span className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="h-11 w-full rounded-xl bg-zinc-100 pl-3 pr-12 font-semibold tabular-nums text-ink outline-none focus:bg-white focus:ring-2 focus:ring-zinc-300"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-zinc-400">{unit}</span>
      </span>
    </label>
  )

  return (
    <li className="card flex flex-col gap-3 p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-3 text-left">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-bold text-ink">{type?.name ?? 'Cardio'}</span>
          <span className="truncate text-sm text-zinc-500">{summary}</span>
          {log.note && <span className="truncate text-xs text-zinc-400">{log.note}</span>}
        </span>
        <ChevronDown className={`size-5 shrink-0 text-zinc-300 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-3">
            {field('Dauer', 'duration', 'min')}
            {field('Kalorien', 'kcal', 'kcal')}
            {field('Ø Puls', 'hr', 'bpm')}
            {field(distanceLabel(type?.distance_unit), 'distance', distanceFieldUnit(type?.distance_unit))}
          </div>
          <label className="flex flex-col gap-1">
            <span className="label-caps">Notiz</span>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="h-11 rounded-xl bg-zinc-100 px-3 text-ink outline-none focus:bg-white focus:ring-2 focus:ring-zinc-300"
            />
          </label>
          {error && (
            <p role="alert" className="m-0 rounded-xl bg-red-50 p-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save()}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 font-bold text-white"
              style={{ background: TRAINING_COLORS.cardio }}
            >
              <Check className="size-4" aria-hidden />
              Speichern
            </button>
            {confirm ? (
              <button type="button" onClick={() => void deleteCardioLog(log.id)} className="h-11 rounded-xl bg-red-600 px-4 font-semibold text-white">
                Wirklich löschen
              </button>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="h-11 rounded-xl bg-zinc-100 px-4 font-semibold text-red-600">
                Löschen
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

/** Statistik, Einheit: ansehen, Werte, Datum und Notiz bearbeiten, Einträge oder die ganze Einheit löschen. */
export default function SessionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const input = useStatsData(userId)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const session = input?.sessions.find((s) => s.id === id)
  useEffect(() => {
    setNote(session?.note ?? '')
    // nur beim Laden bzw. Wechsel der Einheit übernehmen, nicht bei jedem Tastendruck
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  const stat = useMemo(() => (input && session ? buildSessionStats(input).find((s) => s.id === session.id) : undefined), [input, session])

  if (!input) return <Loading />
  if (!session) {
    return (
      <EmptyState Icon={SearchX} title="Einheit nicht gefunden">
        Diese Einheit gibt es nicht mehr.
      </EmptyState>
    )
  }

  const isCardio = session.kind === 'cardio'
  const color = isCardio ? TRAINING_COLORS.cardio : (stat?.color ?? TRAINING_COLORS.training1)
  const name = isCardio ? 'Cardio' : (stat?.name ?? 'Freitraining')
  const logs = input.logs.filter((l) => l.session_id === session.id).sort((a, b) => a.sort - b.sort)
  const cardioLogs = input.cardioLogs.filter((l) => l.session_id === session.id)
  const empty = isCardio ? cardioLogs.length === 0 : logs.length === 0

  const changeDate = async (date: string) => {
    setDateError(null)
    const result = await moveSessionDate(session.id, date)
    if (result === 'conflict') {
      setDateError(`Am ${formatDate(date)} gibt es schon eine gleichartige Einheit. Lösche oder verschiebe zuerst diese.`)
    }
  }

  const saveLog = async (exercise: GymExercise, values: LogInput) => {
    if (session.kind === 'cardio') return
    await saveExerciseLog({ kind: session.kind, templateId: session.template_id, date: session.date }, exercise, values)
    setExpandedId(null)
  }

  const remove = async () => {
    await deleteSession(session.id)
    navigate('/statistik/verlauf', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4 lg:max-w-2xl">
      <section className="card flex flex-col gap-4 p-5" aria-label="Einheit">
        <div className="flex items-center gap-3">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold"
            style={{ background: withAlpha(color, 0.14), color }}
            aria-hidden
          >
            {session.date.slice(8)}
          </span>
          <div className="min-w-0">
            <h2 className="m-0 truncate text-lg font-extrabold text-ink">{name}</h2>
            <p className="m-0 text-xs text-zinc-500">
              {isCardio
                ? `${cardioLogs.length} ${cardioLogs.length === 1 ? 'Eintrag' : 'Einträge'}`
                : `${stat?.exerciseCount ?? 0} Übungen · ${formatNumber(stat?.volume ?? 0, 0)} kg`}
              {session.source === 'import' ? ' · importiert' : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-caps">Datum</span>
          <div>
            <DateField value={session.date} onChange={(d) => void changeDate(d)} label="Datum der Einheit" />
          </div>
          {dateError && (
            <p role="alert" className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {dateError}
            </p>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Notiz</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if ((note.trim() || null) !== (session.note ?? null)) void setSessionNote(session.id, note)
            }}
            rows={2}
            placeholder="z. B. Schulter gezwickt"
            className="resize-y rounded-2xl bg-zinc-100 px-4 py-3 text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
          />
        </label>
      </section>

      {empty ? (
        <p className="card m-0 px-5 py-6 text-center text-sm text-zinc-500">Diese Einheit hat keine Einträge mehr.</p>
      ) : isCardio ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Cardio-Einträge">
          {cardioLogs.map((l) => (
            <CardioRow key={l.id} log={l} type={input.cardioTypes.get(l.cardio_type_id)} />
          ))}
        </ul>
      ) : (
        <section className="flex flex-col gap-3" aria-label="Übungen">
          {logs.map((l) => {
            const exercise = input.exercises.get(l.exercise_id)
            if (!exercise) return null
            return (
              <ExerciseCard
                key={l.id}
                exercise={exercise}
                log={l}
                last={undefined}
                color={color}
                expanded={expandedId === l.id}
                onToggle={() => setExpandedId((cur) => (cur === l.id ? null : l.id))}
                onSave={(values) => saveLog(exercise, values)}
                onUndo={async () => {
                  await undoExerciseLog(l.id)
                  setExpandedId(null)
                }}
                undoLabel="Eintrag löschen"
                doneLabel=""
              />
            )
          })}
        </section>
      )}

      <section className="card flex flex-col gap-3 p-5" aria-label="Einheit löschen">
        {confirmDelete ? (
          <>
            <p className="m-0 text-sm text-zinc-600">
              Die Einheit vom {formatDate(session.date)} wird mit allen Einträgen gelöscht, auch auf deinen anderen Geräten.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void remove()} className="h-11 rounded-2xl bg-red-600 px-5 font-semibold text-white">
                Endgültig löschen
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-11 rounded-2xl bg-zinc-100 px-5 font-semibold text-zinc-600">
                Abbrechen
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex h-11 items-center gap-2 self-start rounded-2xl bg-zinc-100 px-5 text-sm font-semibold text-red-600"
          >
            <Trash2 className="size-4" aria-hidden />
            Einheit löschen
          </button>
        )}
      </section>
    </div>
  )
}
