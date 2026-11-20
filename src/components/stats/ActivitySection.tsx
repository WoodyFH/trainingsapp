import { useEffect, useRef } from 'react'
import { formatDate, formatMonthShort, formatNumber } from '../../lib/date'
import { addDays } from '../../lib/date'
import { TRAINING_COLORS } from '../../lib/trainingColors'
import {
  averagePerWeek,
  currentStreak,
  heatmapWeeks,
  statsInRange,
  weekCounts,
  type ActivityDay,
  type SessionStat,
} from '../../stats/compute'
import type { DateRange } from '../../stats/period'
import { ChartCard, TableView } from './shared'

interface ActivitySectionProps {
  stats: SessionStat[]
  activity: Map<string, ActivityDay>
  range: DateRange
  today: string
}

const EMPTY = '#EFEFF2'
const CELL = 14
const GAP = 3

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-zinc-50 p-4">
      <span className="label-caps">{label}</span>
      <span className="text-3xl font-extrabold leading-none text-ink">{value}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  )
}

/** Kalender-Heatmap der Trainingstage (Squircles, Farbe nach Trainingsart) plus Wochen-Kennzahlen. */
export function ActivitySection({ stats, activity, range, today }: ActivitySectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const firstDate = stats[0]?.date ?? null
  const weeks = heatmapWeeks(range, today, firstDate)
  const counts = weekCounts(stats)
  const streak = currentStreak(counts, today, 2)
  const perWeek = averagePerWeek(stats, range, today)
  const inRangeDays = [...activity.values()].filter(
    (d) => (range.from === null || d.date >= range.from) && d.date <= range.to,
  )
  const strengthInRange = statsInRange(stats, range.from, range.to).length

  // Auf dem Handy zuerst die jüngsten Wochen zeigen
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [weeks.length])

  const monthLabels = weeks.map((w, i) => {
    const prev = weeks[i - 1]
    return !prev || prev.slice(0, 7) !== w.slice(0, 7) ? formatMonthShort(w) : ''
  })

  return (
    <ChartCard
      title="Trainingstage"
      subtitle={weeks.length >= 53 && range.from === null ? 'Die letzten 12 Monate' : undefined}
      label={`Kalender mit ${inRangeDays.length} Trainingstagen im Zeitraum`}
      table={
        <TableView
          caption="Trainingstage"
          columns={['Datum', 'Einheiten']}
          rows={inRangeDays
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((d) => [formatDate(d.date), d.names.join(', ')])}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Aktive Tage" value={String(inRangeDays.length)} hint="mit Training oder Cardio" />
          <Tile label="Pro Woche" value={formatNumber(perWeek, 1)} hint="Ø Einheiten" />
          <Tile
            label="Serie"
            value={String(streak)}
            hint={streak === 1 ? 'Woche mit 2+ Einheiten' : 'Wochen mit 2+ Einheiten'}
          />
        </div>

        <div ref={scrollRef} className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="inline-flex flex-col gap-1">
            <div className="flex" style={{ gap: GAP }} aria-hidden>
              {monthLabels.map((label, i) => (
                <span key={weeks[i]} className="shrink-0 overflow-visible whitespace-nowrap text-[10px] text-zinc-400" style={{ width: CELL }}>
                  {label}
                </span>
              ))}
            </div>
            <div className="flex" style={{ gap: GAP }}>
              {weeks.map((weekStart) => (
                <div key={weekStart} className="flex flex-col" style={{ gap: GAP }}>
                  {Array.from({ length: 7 }, (_, d) => {
                    const date = addDays(weekStart, d)
                    const day = activity.get(date)
                    const future = date > today
                    const outside = (range.from !== null && date < range.from) || future
                    const active = day && !outside
                    return (
                      <span
                        key={date}
                        title={active ? `${formatDate(date)}: ${day.names.join(', ')}` : future ? undefined : formatDate(date)}
                        className="rounded-md"
                        style={{
                          width: CELL,
                          height: CELL,
                          background: active ? day.color : EMPTY,
                          opacity: outside ? 0.35 : 1,
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-zinc-600">
          {(
            [
              ['Training 1', TRAINING_COLORS.training1],
              ['Training 2', TRAINING_COLORS.training2],
              ['Training 3', TRAINING_COLORS.training3],
              ['Freitraining', TRAINING_COLORS.free],
              ['Cardio', TRAINING_COLORS.cardio],
            ] as const
          ).map(([name, color]) => (
            <li key={name} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-md" style={{ background: color }} aria-hidden />
              {name}
            </li>
          ))}
        </ul>
        <p className="m-0 text-xs text-zinc-500">
          {strengthInRange} {strengthInRange === 1 ? 'Kraft- oder Freitraining' : 'Kraft- und Freitrainings'} im Zeitraum. Die Serie zählt
          Kraft- und Freitrainings.
        </p>
      </div>
    </ChartCard>
  )
}
