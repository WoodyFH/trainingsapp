import { ChevronRight, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { AXIS_TICK, CHART, ChartCard, ChartTooltip, Loading, TableView, compactNumber } from '../../components/stats/shared'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDate, formatNumber, formatShortDate } from '../../lib/date'
import { TRAINING_COLORS } from '../../lib/trainingColors'
import { describeLog } from '../../lib/volume'
import {
  chartSpec,
  exerciseHistory,
  mainValue,
  secondValue,
  summarizeExercise,
  type ExerciseEntry,
} from '../../stats/compute'
import { useStatsData } from '../../stats/useStatsData'
import type { GymExercise } from '../../types/db'

interface Point {
  key: string
  date: string
  label: string
  value: number
}

const MAX_DOTS = 60

function TrendChart({ points, name, unit, color }: { points: Point[]; name: string; unit: string; color: string }) {
  const withDots = points.length <= MAX_DOTS
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={24} interval="preserveStartEnd" />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={44}
            tickFormatter={compactNumber}
            domain={[(min: number) => Math.max(0, Math.floor(min * 0.9)), (max: number) => Math.ceil(max * 1.05) || 1]}
          />
          <Tooltip
            isAnimationActive={false}
            cursor={{ stroke: CHART.axisText, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Point | undefined
              if (!active || !p) return null
              return <ChartTooltip title={formatDate(p.date)} rows={[{ color, label: name, value: `${formatNumber(p.value, 1)}${unit ? ` ${unit}` : ''}` }]} />
            }}
          />
          <Line
            type="linear"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={withDots ? { r: 4, fill: color, stroke: CHART.surface, strokeWidth: 2 } : false}
            activeDot={{ r: 6, fill: color, stroke: CHART.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-zinc-50 p-4">
      <span className="label-caps">{label}</span>
      <span className="text-xl font-extrabold leading-tight text-ink">{value}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  )
}

function bestText(entry: ExerciseEntry, exercise: GymExercise): string {
  const v = mainValue(entry, exercise.load_type)
  const spec = chartSpec(exercise.load_type, exercise.sides)
  return `${formatNumber(v, 1)}${spec.main.unit ? ` ${spec.main.unit}` : ''}`
}

/** Statistik, Übung: Verlauf von Gewicht und Volumen, Bestwert, erster und letzter Eintrag, alle Einträge. */
export default function StatsExerciseDetailPage() {
  const { id } = useParams()
  const { userId } = useAuth()
  const input = useStatsData(userId)

  const exercise = id ? input?.exercises.get(id) : undefined
  const entries = useMemo(() => (input && id ? exerciseHistory(id, input) : []), [input, id])

  if (!input) return <Loading />
  if (!exercise) {
    return (
      <EmptyState Icon={SearchX} title="Übung nicht gefunden">
        Diese Übung gibt es nicht mehr.
      </EmptyState>
    )
  }

  const spec = chartSpec(exercise.load_type, exercise.sides)
  const summary = summarizeExercise(entries, exercise.load_type)
  const toPoints = (value: (e: ExerciseEntry) => number): Point[] =>
    entries.map((e) => ({ key: e.log.id, date: e.date, label: formatShortDate(e.date), value: value(e) }))
  const mainPoints = toPoints((e) => mainValue(e, exercise.load_type))
  const secondPoints = toPoints((e) => secondValue(e, exercise.load_type))
  const newestFirst = [...entries].reverse()

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-1 p-5">
        <h2 className="m-0 text-xl font-extrabold text-ink">{exercise.name}</h2>
        <p className="m-0 text-sm text-zinc-500">
          {[exercise.short_name, exercise.archived ? 'archiviert' : null, `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </section>

      {entries.length === 0 ? (
        <EmptyState Icon={SearchX} title="Noch kein Eintrag">
          Für diese Übung gibt es noch keinen Verlauf.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile
              label="Bestwert"
              value={summary.best ? bestText(summary.best, exercise) : '–'}
              hint={summary.best ? formatDate(summary.best.date) : undefined}
            />
            <Tile
              label="Erster Eintrag"
              value={summary.first ? formatDate(summary.first.date) : '–'}
              hint={summary.first ? describeLog(summary.first.log, exercise.load_type) : undefined}
            />
            <Tile
              label="Letzter Eintrag"
              value={summary.last ? formatDate(summary.last.date) : '–'}
              hint={summary.last ? describeLog(summary.last.log, exercise.load_type) : undefined}
            />
          </div>

          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
            <ChartCard
              title={spec.main.label}
              subtitle={exercise.load_type === 'assisted' ? 'Weniger Unterstützung ist besser' : undefined}
              label={`Liniendiagramm: ${spec.main.label} über ${entries.length} Einträge`}
              table={
                <TableView
                  caption={spec.main.label}
                  columns={['Datum', spec.main.unit ? `${spec.main.label} (${spec.main.unit})` : spec.main.label]}
                  rows={[...mainPoints].reverse().map((p) => [formatDate(p.date), formatNumber(p.value, 1)])}
                />
              }
            >
              <TrendChart points={mainPoints} name={spec.main.label} unit={spec.main.unit} color={TRAINING_COLORS.training1} />
            </ChartCard>

            <ChartCard
              title={spec.second.label}
              label={`Liniendiagramm: ${spec.second.label} über ${entries.length} Einträge`}
              table={
                <TableView
                  caption={spec.second.label}
                  columns={['Datum', spec.second.unit ? `${spec.second.label} (${spec.second.unit})` : spec.second.label]}
                  rows={[...secondPoints].reverse().map((p) => [formatDate(p.date), formatNumber(p.value, 0)])}
                />
              }
            >
              <TrendChart points={secondPoints} name={spec.second.label} unit={spec.second.unit} color={TRAINING_COLORS.training2} />
            </ChartCard>
          </div>

          <section className="card flex flex-col gap-1 p-5" aria-label="Alle Einträge">
            <h2 className="label-caps m-0 mb-2">Alle Einträge</h2>
            <ul className="m-0 flex list-none flex-col p-0">
              {newestFirst.map((e) => (
                <li key={e.log.id} className="border-t border-line first:border-t-0">
                  <Link
                    to={`/statistik/einheit/${e.sessionId}`}
                    className="flex items-center gap-3 py-3 text-sm"
                  >
                    <span className="w-24 shrink-0 font-semibold tabular-nums text-ink">{formatDate(e.date)}</span>
                    <span className="min-w-0 flex-1 text-zinc-600">
                      {describeLog(e.log, exercise.load_type)}
                      {e.log.note && <span className="block truncate text-xs text-zinc-400">{e.log.note}</span>}
                    </span>
                    {e.volume > 0 && (
                      <span className="shrink-0 tabular-nums text-zinc-500">{formatNumber(e.volume, 0)} kg</span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-zinc-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
