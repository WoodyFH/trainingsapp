import { ChevronRight, Dumbbell, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { MuscleBodySVG } from '../../components/muscle/MuscleBodySVG'
import { Loading, StatsTabs } from '../../components/stats/shared'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDate } from '../../lib/date'
import { TRAINING_COLORS } from '../../lib/trainingColors'
import { exercisesWithHistory } from '../../stats/compute'
import { useStatsData } from '../../stats/useStatsData'

/** Statistik, Übungen: Auswahl einer Übung mit Historie. */
export default function StatsExercisesPage() {
  const { userId } = useAuth()
  const input = useStatsData(userId)
  const [query, setQuery] = useState('')

  const items = useMemo(() => (input ? exercisesWithHistory(input) : []), [input])
  const q = query.trim().toLowerCase()
  const filtered = items.filter(
    (i) => !q || i.exercise.name.toLowerCase().includes(q) || (i.exercise.short_name ?? '').toLowerCase().includes(q),
  )

  return (
    <div className="flex flex-col gap-4 lg:max-w-2xl">
      <StatsTabs />
      {!input ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState Icon={Dumbbell} title="Noch keine Übung mit Verlauf">
          Sobald du Einträge hast, siehst du hier für jede Übung Gewicht, Volumen und Bestwerte.
        </EmptyState>
      ) : (
        <>
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
          {filtered.length === 0 ? (
            <p className="card m-0 px-5 py-8 text-center text-sm text-zinc-500">Keine passende Übung gefunden.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {filtered.map(({ exercise, count, lastDate }) => (
                <li key={exercise.id}>
                  <Link to={`/statistik/uebung/${exercise.id}`} className="card flex items-center gap-3 p-3 transition active:scale-[0.99]">
                    <MuscleBodySVG
                      size="sm"
                      primaryMuscles={exercise.primary_muscles}
                      secondaryMuscles={exercise.secondary_muscles}
                      accentColor={TRAINING_COLORS.training1}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-bold text-ink">{exercise.name}</span>
                      <span className="truncate text-xs text-zinc-500">
                        {count} {count === 1 ? 'Eintrag' : 'Einträge'} · zuletzt {formatDate(lastDate)}
                        {exercise.archived ? ' · archiviert' : ''}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-zinc-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
