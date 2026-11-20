import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatNumber } from '../../lib/date'
import { TRAINING_COLORS } from '../../lib/trainingColors'
import { normalizeIntensity } from '../../lib/volume'
import { muscleStats, type MuscleMetric, type StatsInput } from '../../stats/compute'
import type { DateRange } from '../../stats/period'
import { MUSCLE_LABELS, MUSCLES, type MuscleId } from '../../types/muscles'
import { MuscleBodySVG } from '../muscle/MuscleBodySVG'
import { ChartCard, MiniToggle, TableView } from './shared'

interface MuscleSectionProps {
  input: StatsInput
  range: DateRange
}

const METRIC_OPTIONS: { value: MuscleMetric; label: string }[] = [
  { value: 'volume', label: 'Volumen' },
  { value: 'sets', label: 'Sätze' },
]

const COLOR = TRAINING_COLORS.training1

/** Muskelgruppen: großes Männchen mit Intensität, sortierte Balkenliste, Tipp auf einen Muskel zeigt die beteiligten Übungen. */
export function MuscleSection({ input, range }: MuscleSectionProps) {
  const [metric, setMetric] = useState<MuscleMetric>('volume')
  const [selected, setSelected] = useState<MuscleId | null>(null)

  const { totals, byMuscle } = useMemo(
    () => muscleStats(input, range.from, range.to, metric),
    [input, range.from, range.to, metric],
  )
  const intensity = useMemo(() => normalizeIntensity(totals), [totals])
  const rows = MUSCLES.map((m) => ({ id: m.id, label: m.label, value: totals[m.id] ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
  const max = rows[0]?.value ?? 1
  const unit = metric === 'volume' ? 'kg' : 'Sätze'
  const fmt = (v: number) => `${formatNumber(v, metric === 'volume' ? 0 : 1)} ${unit}`

  const toggle = (id: MuscleId) => setSelected((cur) => (cur === id ? null : id))
  const contributions = selected ? (byMuscle[selected] ?? []) : []

  return (
    <ChartCard
      title="Muskelgruppen"
      subtitle={
        metric === 'volume'
          ? 'Volumen im Zeitraum, primäre Muskeln zählen 100 %, sekundäre 50 %'
          : 'Gewichtete Sätze im Zeitraum, primäre Muskeln zählen 100 %, sekundäre 50 %'
      }
      controls={<MiniToggle label="Messgröße" value={metric} onChange={setMetric} options={METRIC_OPTIONS} />}
      label={rows.length ? `Muskelgruppen nach ${metric === 'volume' ? 'Volumen' : 'Sätzen'}, am stärksten: ${rows[0]?.label}` : 'Keine Daten'}
      table={
        rows.length > 0 ? (
          <TableView
            caption="Muskelgruppen"
            columns={['Muskelgruppe', metric === 'volume' ? 'Volumen (kg)' : 'Sätze']}
            rows={rows.map((r) => [r.label, formatNumber(r.value, metric === 'volume' ? 0 : 1)])}
          />
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="m-0 py-10 text-center text-sm text-zinc-500">Noch keine Einheit in diesem Zeitraum.</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex justify-center">
            <div className="sm:hidden">
              <MuscleBodySVG
                size="md"
                intensity={intensity}
                accentColor={COLOR}
                selectable
                primaryMuscles={selected ? [selected] : []}
                onMuscleClick={toggle}
                ariaLabel="Muskelgruppen nach Belastung, antippen für Details"
              />
            </div>
            <div className="hidden sm:block">
              <MuscleBodySVG
                size="lg"
                intensity={intensity}
                accentColor={COLOR}
                selectable
                primaryMuscles={selected ? [selected] : []}
                onMuscleClick={toggle}
                ariaLabel="Muskelgruppen nach Belastung, antippen für Details"
              />
            </div>
          </div>

          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  aria-pressed={selected === r.id}
                  className={`flex w-full flex-col gap-1 rounded-2xl px-3 py-2 text-left transition ${
                    selected === r.id ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-ink">{r.label}</span>
                    <span className="tabular-nums text-zinc-600">{fmt(r.value)}</span>
                  </span>
                  <span className="h-2 w-full overflow-hidden rounded-full bg-zinc-100" aria-hidden>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: COLOR }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <section className="flex flex-col gap-2 rounded-2xl bg-zinc-50 p-4" aria-label={`Übungen für ${MUSCLE_LABELS[selected]}`}>
              <h3 className="m-0 text-sm font-extrabold text-ink">Übungen für {MUSCLE_LABELS[selected]}</h3>
              {contributions.length === 0 ? (
                <p className="m-0 text-sm text-zinc-500">Keine Übung im Zeitraum.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {contributions.map((c) => (
                    <li key={c.exercise.id}>
                      <Link
                        to={`/statistik/uebung/${c.exercise.id}`}
                        className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-white"
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-semibold text-ink">{c.exercise.name}</span>
                          <span className="text-xs text-zinc-500">{c.role === 'primary' ? 'primär (100 %)' : 'sekundär (50 %)'}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-700">{fmt(c.value)}</span>
                        <ChevronRight className="size-4 shrink-0 text-zinc-300" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </ChartCard>
  )
}
