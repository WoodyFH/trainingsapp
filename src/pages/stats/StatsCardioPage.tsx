import { HeartPulse } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../../auth/AuthProvider'
import { AXIS_TICK, CHART, ChartCard, ChartTooltip, Loading, MiniToggle, PeriodFilter, StatsTabs, TableView, compactNumber, usePeriod } from '../../components/stats/shared'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatNumber, formatShortDate, todayIso } from '../../lib/date'
import { CARDIO_METRICS, cardioStats, type CardioMetric, type CardioWeek } from '../../stats/compute'
import { rangeFor } from '../../stats/period'
import { useStatsData } from '../../stats/useStatsData'

/** Statistik, Cardio: Minuten, Kalorien oder Distanz pro Woche, aufgeteilt nach Art. */
export default function StatsCardioPage() {
  const { userId } = useAuth()
  const input = useStatsData(userId)
  const [period, setPeriod] = usePeriod()
  const [metric, setMetric] = useState<CardioMetric>('duration')
  const today = todayIso()
  const range = useMemo(() => rangeFor(period, today), [period, today])
  const stats = useMemo(() => (input ? cardioStats(input, range, today, metric) : null), [input, range, today, metric])
  const info = CARDIO_METRICS.find((m) => m.key === metric) ?? CARDIO_METRICS[0]
  const unit = info?.unit ?? ''
  const digits = metric === 'distance' ? 1 : 0

  // Tabellen-/Diagrammzeilen: eine Spalte je Art
  const data = (stats?.weeks ?? []).map((w: CardioWeek) => ({
    weekStart: w.weekStart,
    label: formatShortDate(w.weekStart),
    total: w.total,
    ...w.byType,
  }))

  return (
    <div className="flex flex-col gap-4">
      <StatsTabs />
      <PeriodFilter value={period} onChange={setPeriod} />
      {!input || !stats ? (
        <Loading />
      ) : stats.weeks.length === 0 ? (
        <EmptyState Icon={HeartPulse} title="Noch kein Cardio in diesem Zeitraum">
          Trage unter „Cardio“ auf der Startseite Dauer, Kalorien, Puls oder Distanz (beim Stairmaster Etagen) ein.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4 lg:max-w-3xl">
          <section className="card flex flex-col gap-1 p-5" aria-label="Summe">
            <h2 className="label-caps m-0">Summe im Zeitraum</h2>
            <p className="m-0 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold leading-none tracking-tight text-ink">{formatNumber(stats.total, digits)}</span>
              <span className="text-lg font-semibold text-zinc-400">{unit}</span>
            </p>
          </section>

          <ChartCard
            title={`${info?.label ?? ''} pro Woche`}
            subtitle="Aufgeteilt nach Art"
            controls={
              <MiniToggle
                label="Messgröße"
                value={metric}
                onChange={setMetric}
                options={CARDIO_METRICS.map((m) => ({ value: m.key, label: m.label }))}
              />
            }
            label={`Gestapeltes Balkendiagramm: ${info?.label} pro Woche, Summe ${formatNumber(stats.total, digits)} ${unit}`}
            table={
              <TableView
                caption={`${info?.label} pro Woche`}
                columns={['Woche ab', ...stats.series.map((s) => s.name), 'Summe']}
                rows={[...stats.weeks].reverse().map((w) => [
                  formatShortDate(w.weekStart),
                  ...stats.series.map((s) => formatNumber(w.byType[s.key] ?? 0, digits)),
                  formatNumber(w.total, digits),
                ])}
              />
            }
          >
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={14} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={44} tickFormatter={compactNumber} />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ fill: 'rgba(24,24,27,0.05)' }}
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as (typeof data)[number] | undefined
                      if (!active || !row) return null
                      const rows = stats.series
                        .map((s) => ({ color: s.color, label: s.name, v: (row as Record<string, unknown>)[s.key] as number | undefined }))
                        .filter((r) => (r.v ?? 0) > 0)
                        .map((r) => ({ color: r.color, label: r.label, value: `${formatNumber(r.v ?? 0, digits)} ${unit}` }))
                      return <ChartTooltip title={`Woche ab ${row.label}`} rows={rows} />
                    }}
                  />
                  {stats.series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      stackId="week"
                      fill={s.color}
                      stroke={CHART.surface}
                      strokeWidth={1}
                      maxBarSize={24}
                      radius={i === stats.series.length - 1 ? [4, 4, 0, 0] : 0}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-zinc-600">
              {stats.series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
                  {s.name}
                </li>
              ))}
            </ul>
          </ChartCard>
        </div>
      )}
    </div>
  )
}
