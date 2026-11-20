import { ChevronRight, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MuscleBodySVG } from '../components/muscle/MuscleBodySVG'
import { useExercises } from '../data/queries'
import { filterExercises } from '../lib/exerciseFilter'
import { TRAINING_COLORS } from '../lib/trainingColors'
import type { LoadType } from '../types/db'
import { MUSCLE_LABELS, type MuscleId } from '../types/muscles'
import { PlansTabs } from './PlansPage'

export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  weight: 'Gewicht',
  assisted: 'Unterstützung',
  bodyweight: 'Körpergewicht',
  time: 'Zeit',
}

export function ExerciseLibraryPage() {
  const exercises = useExercises(true)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleId | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const results = useMemo(() => {
    const visible = (exercises ?? []).filter((e) => showArchived || !e.archived)
    return filterExercises(visible, query, muscle)
  }, [exercises, query, muscle, showArchived])

  const archivedCount = (exercises ?? []).filter((e) => e.archived).length

  return (
    <div className="flex flex-col gap-4">
      <PlansTabs />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <aside className="card flex flex-col items-center gap-3 p-5 lg:sticky lg:top-6">
          <h2 className="label-caps m-0 self-start">Nach Muskel filtern</h2>
          <MuscleBodySVG
            size="md"
            selectable
            primaryMuscles={muscle ? [muscle] : []}
            accentColor={TRAINING_COLORS.training1}
            onMuscleClick={(m) => setMuscle((cur) => (cur === m ? null : m))}
          />
          {muscle ? (
            <button
              type="button"
              onClick={() => setMuscle(null)}
              className="flex h-9 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-sm font-semibold text-ink"
            >
              {MUSCLE_LABELS[muscle]}
              <X className="size-4 text-zinc-400" aria-hidden />
            </button>
          ) : (
            <p className="m-0 text-xs text-zinc-500">Tippe einen Muskel an.</p>
          )}
        </aside>

        <section className="flex flex-col gap-3" aria-label="Übungen">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Übung oder Gerät suchen"
              aria-label="Übung oder Gerät suchen"
              className="h-12 w-full rounded-2xl bg-white pl-12 pr-4 text-ink shadow-sm outline-none transition focus:ring-2 focus:ring-zinc-300"
            />
          </div>

          <Link
            to="/plaene/uebung/neu"
            className="flex h-14 items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-zinc-300 font-semibold text-zinc-500 transition active:scale-[0.99]"
          >
            <Plus className="size-5" aria-hidden />
            Neue Übung
          </Link>

          {!exercises ? (
            <div className="card h-32 animate-pulse" role="status" aria-label="Lädt" />
          ) : results.length === 0 ? (
            <p className="card m-0 px-5 py-8 text-center text-sm text-zinc-500">Keine passende Übung gefunden.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {results.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/plaene/uebung/${e.id}`}
                    className={`card flex items-center gap-3 p-3 transition active:scale-[0.99] ${e.archived ? 'opacity-60' : ''}`}
                  >
                    <MuscleBodySVG
                      size="sm"
                      primaryMuscles={e.primary_muscles}
                      secondaryMuscles={e.secondary_muscles}
                      accentColor={TRAINING_COLORS.training1}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-bold text-ink">{e.name}</span>
                      <span className="truncate text-xs text-zinc-500">
                        {[e.short_name, LOAD_TYPE_LABELS[e.load_type], e.sides === 2 ? 'pro Seite' : null, e.archived ? 'archiviert' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span className="truncate text-xs text-zinc-400">
                        {e.primary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-zinc-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="self-start px-1 text-sm font-semibold text-zinc-500 underline underline-offset-4"
            >
              {showArchived ? 'Archivierte ausblenden' : `Archivierte anzeigen (${archivedCount})`}
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
