import { Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { filterExercises } from '../../lib/exerciseFilter'
import { MUSCLE_LABELS, type MuscleId } from '../../types/muscles'
import type { GymExercise } from '../../types/db'
import { MuscleBodySVG } from '../muscle/MuscleBodySVG'
import { Sheet } from '../ui/Sheet'

interface LibrarySheetProps {
  open: boolean
  onClose: () => void
  exercises: GymExercise[]
  /** IDs, die schon in der Einheit sind (werden als "In der Liste" markiert). */
  includedIds: ReadonlySet<string>
  onPick: (exercise: GymExercise) => void
  accentColor: string
}

/** Durchsuchbare Übungsbibliothek. Filter per Antippen eines Muskels am Männchen. */
export function LibrarySheet({ open, onClose, exercises, includedIds, onPick, accentColor }: LibrarySheetProps) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleId | null>(null)

  const results = useMemo(() => filterExercises(exercises, query, muscle), [exercises, query, muscle])

  return (
    <Sheet open={open} onClose={onClose} title="Übung hinzufügen">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Übung oder Gerät suchen"
            aria-label="Übung oder Gerät suchen"
            className="h-12 w-full rounded-2xl bg-zinc-100 pl-12 pr-4 text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
          />
        </div>

        <div className="flex flex-col items-center gap-2 rounded-2xl bg-zinc-50 p-3">
          <MuscleBodySVG
            size="md"
            selectable
            primaryMuscles={muscle ? [muscle] : []}
            accentColor={accentColor}
            onMuscleClick={(m) => setMuscle((cur) => (cur === m ? null : m))}
          />
          <p className="m-0 text-xs text-zinc-500">Tippe einen Muskel an, um die Liste zu filtern.</p>
          {muscle && (
            <button
              type="button"
              onClick={() => setMuscle(null)}
              className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-ink shadow-sm"
            >
              {MUSCLE_LABELS[muscle]}
              <X className="size-4 text-zinc-400" aria-hidden />
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <p className="m-0 py-6 text-center text-sm text-zinc-500">Keine passende Übung gefunden.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {results.map((e) => {
              const included = includedIds.has(e.id)
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={included}
                    onClick={() => {
                      onPick(e)
                      onClose()
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-50"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-bold text-ink">{e.name}</span>
                      <span className="truncate text-xs text-zinc-500">
                        {[e.short_name, e.primary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ')].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {included ? (
                      <span className="shrink-0 text-xs font-semibold text-zinc-400">In der Liste</span>
                    ) : (
                      <Plus className="size-5 shrink-0 text-zinc-400" aria-hidden />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
