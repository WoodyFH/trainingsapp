import { CircleCheck, Plus, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ExerciseCard } from '../components/training/ExerciseCard'
import { FinishSummary } from '../components/training/FinishSummary'
import { LibrarySheet } from '../components/training/LibrarySheet'
import { MuscleBodySVG } from '../components/muscle/MuscleBodySVG'
import { DateField } from '../components/ui/DateField'
import { EmptyState } from '../components/ui/EmptyState'
import {
  useBodyweight,
  useExercises,
  useLastLogs,
  useSession,
  useSessionLogs,
  useTemplate,
  useTemplateExercises,
} from '../data/queries'
import { finishSession, findSession, saveExerciseLog, setSessionDate, undoExerciseLog, type LogInput } from '../data/sessions'
import { useDraft } from '../hooks/useDraft'
import { withAlpha } from '../lib/color'
import { todayIso } from '../lib/date'
import { getIcon } from '../lib/icons'
import { TRAINING_COLORS } from '../lib/trainingColors'
import { intensityFromExercises } from '../lib/volume'
import type { GymExercise } from '../types/db'

interface DraftState {
  /** Heute zusätzlich gewählte Übungen. */
  extra: string[]
  /** Heute ausgelassene Übungen des Plans. */
  skipped: string[]
}

const EMPTY_DRAFT: DraftState = { extra: [], skipped: [] }

/** Trainingsansicht für ein Training aus dem Plan (mode = template) oder das Freitraining (mode = free). */
export function TrainingSessionPage({ mode }: { mode: 'template' | 'free' }) {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const bodyweight = useBodyweight(userId)

  const kind = mode === 'free' ? 'free' : 'strength'
  const tplId = mode === 'free' ? null : (templateId ?? null)
  const today = todayIso()

  const [date, setDate] = useState(today)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [showSkipped, setShowSkipped] = useState(false)

  const template = useTemplate(mode === 'template' ? tplId ?? undefined : undefined)
  const planExercises = useTemplateExercises(mode === 'template' ? tplId ?? undefined : undefined)
  const activeExercises = useExercises(false)
  const allExercises = useExercises(true)
  const session = useSession(kind, date, tplId)
  const logs = useSessionLogs(session?.id)
  const [draft, setDraft] = useDraft<DraftState>(`draft:${kind}:${tplId ?? ''}:${date}`, EMPTY_DRAFT)

  const color = template?.color ?? TRAINING_COLORS.free

  const logByExercise = useMemo(() => new Map((logs ?? []).map((l) => [l.exercise_id, l])), [logs])

  /** Übungen dieser Ansicht: Plan, heute zusätzlich Gewähltes, alles bereits Abgehakte. Erledigte ans Ende. */
  const { visible, skippedList } = useMemo(() => {
    const byId = new Map((allExercises ?? []).map((e) => [e.id, e]))
    const ordered: GymExercise[] = []
    const seen = new Set<string>()
    const add = (e: GymExercise | undefined) => {
      if (e && !seen.has(e.id)) {
        seen.add(e.id)
        ordered.push(e)
      }
    }
    for (const e of planExercises ?? []) add(e)
    for (const id of draft.extra) add(byId.get(id))
    for (const l of logs ?? []) add(byId.get(l.exercise_id))

    const skipped = ordered.filter((e) => draft.skipped.includes(e.id) && !logByExercise.has(e.id))
    const shown = ordered.filter((e) => !skipped.includes(e))
    const rank = (e: GymExercise) => (logByExercise.has(e.id) ? 1 : 0)
    const sorted = [...shown].sort((a, b) => {
      const r = rank(a) - rank(b)
      if (r !== 0) return r
      if (rank(a) === 1) return (logByExercise.get(a.id)?.sort ?? 0) - (logByExercise.get(b.id)?.sort ?? 0)
      return shown.indexOf(a) - shown.indexOf(b)
    })
    return { visible: sorted, skippedList: skipped }
  }, [allExercises, planExercises, draft, logs, logByExercise])

  const lastLogs = useLastLogs(
    useMemo(() => visible.map((e) => e.id), [visible]),
    date,
    session?.id,
  )

  const loading =
    planExercises === undefined ||
    allExercises === undefined ||
    activeExercises === undefined ||
    session === undefined ||
    logs === undefined ||
    (mode === 'template' && template === undefined)

  if (mode === 'template' && template === null) {
    return (
      <EmptyState Icon={SearchX} title="Training nicht gefunden">
        Dieses Training gibt es nicht mehr. Wähle auf der Startseite ein anderes.
      </EmptyState>
    )
  }

  if (loading) {
    return <div className="card h-48 animate-pulse" aria-label="Lädt" role="status" />
  }

  const target = { kind, templateId: tplId, date } as const
  const doneCount = visible.filter((e) => logByExercise.has(e.id)).length
  const title =
    mode === 'free'
      ? 'Freitraining'
      : template
        ? `${template.rotation_order ? `Training ${template.rotation_order}` : 'Training'} · ${template.name}`
        : ''
  const Icon = getIcon(mode === 'free' ? 'Zap' : template?.icon)
  const includedIds = new Set(visible.map((e) => e.id))

  const changeDate = async (next: string) => {
    if (next > today || next === date) return
    if (session && (logs?.length ?? 0) > 0) {
      const taken = await findSession(kind, next, tplId)
      if (!taken) await setSessionDate(session.id, next)
    }
    setExpandedId(null)
    setDate(next)
  }

  const saveLog = async (exercise: GymExercise, input: LogInput) => {
    await saveExerciseLog(target, exercise, input)
    setExpandedId(null)
  }

  const undoLog = async (exercise: GymExercise) => {
    const log = logByExercise.get(exercise.id)
    if (log) await undoExerciseLog(log.id)
    setExpandedId(null)
  }

  const skip = (exercise: GymExercise) => {
    setDraft((d) => ({ ...d, skipped: [...new Set([...d.skipped, exercise.id])] }))
    setExpandedId(null)
  }

  const restore = (exercise: GymExercise) => {
    setDraft((d) => ({ ...d, skipped: d.skipped.filter((id) => id !== exercise.id) }))
  }

  const pick = (exercise: GymExercise) => {
    setDraft((d) => ({
      extra: d.extra.includes(exercise.id) ? d.extra : [...d.extra, exercise.id],
      skipped: d.skipped.filter((id) => id !== exercise.id),
    }))
  }

  const finish = async () => {
    if (!session || (logs?.length ?? 0) === 0) return
    if (!session.finished_at) await finishSession(session.id)
    setSummaryOpen(true)
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <aside className="card order-first flex flex-col gap-4 p-5 lg:sticky lg:top-6 lg:order-2">
        <div className="flex items-center gap-3">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: withAlpha(color, 0.14), color }}
          >
            <Icon className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="m-0 truncate text-lg font-extrabold text-ink">{title}</h2>
            <p className="m-0 text-xs text-zinc-500">
              {doneCount} von {visible.length} erledigt
            </p>
          </div>
        </div>
        <DateField value={date} onChange={(d) => void changeDate(d)} />
        <div className="flex justify-center">
          <MuscleBodySVG
            size="md"
            intensity={intensityFromExercises(visible)}
            accentColor={color}
            ariaLabel="Vorschau der trainierten Muskeln dieser Einheit"
          />
        </div>
      </aside>

      <section className="flex flex-col gap-3 lg:order-1" aria-label="Übungen">
        {visible.length === 0 ? (
          <EmptyState Icon={Plus} title="Noch keine Übung">
            Füge Übungen aus der Bibliothek hinzu, um die Einheit zu starten.
          </EmptyState>
        ) : (
          visible.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              log={logByExercise.get(exercise.id)}
              last={lastLogs?.get(exercise.id)}
              color={color}
              expanded={expandedId === exercise.id}
              onToggle={() => setExpandedId((cur) => (cur === exercise.id ? null : exercise.id))}
              onSave={(input) => saveLog(exercise, input)}
              onUndo={() => undoLog(exercise)}
              onSkip={() => skip(exercise)}
            />
          ))
        )}

        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="flex h-14 items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-zinc-300 font-semibold text-zinc-500 transition active:scale-[0.99]"
        >
          <Plus className="size-5" aria-hidden />
          Übung
        </button>

        {skippedList.length > 0 && (
          <div className="flex flex-col gap-2 px-1">
            <button
              type="button"
              onClick={() => setShowSkipped((v) => !v)}
              className="self-start text-sm font-semibold text-zinc-500 underline underline-offset-4"
            >
              {skippedList.length} heute ausgelassen {showSkipped ? '· ausblenden' : '· anzeigen'}
            </button>
            {showSkipped &&
              skippedList.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm">
                  <span className="truncate font-semibold text-zinc-600">{e.name}</span>
                  <button type="button" onClick={() => restore(e)} className="shrink-0 font-semibold" style={{ color }}>
                    Wieder aufnehmen
                  </button>
                </div>
              ))}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void finish()}
            disabled={(logs?.length ?? 0) === 0}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: color }}
          >
            <CircleCheck className="size-5" aria-hidden />
            {session?.finished_at ? 'Zusammenfassung anzeigen' : 'Training beenden'}
          </button>
          {(logs?.length ?? 0) === 0 && (
            <p className="m-0 text-center text-xs text-zinc-400">Hake mindestens eine Übung ab, um die Einheit zu beenden.</p>
          )}
        </div>
      </section>

      <LibrarySheet
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        exercises={activeExercises ?? []}
        includedIds={includedIds}
        onPick={pick}
        accentColor={color}
      />
      <FinishSummary
        open={summaryOpen}
        onClose={() => {
          setSummaryOpen(false)
          navigate('/')
        }}
        sessionId={session?.id}
        bodyweightKg={bodyweight}
        title={title}
        color={color}
      />
    </div>
  )
}
