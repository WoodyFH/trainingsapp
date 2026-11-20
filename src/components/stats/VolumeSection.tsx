import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber } from '../../lib/date'
import { TRAINING_COLORS, TRAINING_COLOR_LABELS } from '../../lib/trainingColors'
import {
  comparePeriods,
  statsInRange,
  totalVolume,
  volumeBars,
  type Granularity,
  type SessionStat,
  type VolumeBar,
} from '../../stats/compute'
import { DEFAULT_GRANULARITY, type DateRange, type PeriodKey } from '../../stats/period'
import { AXIS_TICK, CHART, ChartCard, ChartTooltip, MiniToggle, TableView, compactNumber } from './shared'

interface VolumeSectionProps {
  stats: SessionStat[]
  range: DateRange
  period: PeriodKey
  today: string
}

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'session', label: 'Einheit' },
  { value: 'week', label: 'Woche' },
  { value: 'month', label: 'Monat' },
]

function Hero({ stats, range }: Pick<VolumeSectionProps, 'stats' | 'range'>) {
  const cmp = comparePeriods(stats, range)
  const delta = cmp.deltaPercent
  const Icon = delta === null || Math.abs(delta) < 0.5 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight
  const tone =
    delta === null || Math.abs(delta) < 0.5
      ? 'bg-zinc-100 text-zinc-600'
      : delta > 0
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-amber-50 text-amber-800'
  const count = statsInRange(stats, range.from, range.to).length

  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Gesamtvolumen">
      <h2 className="label-caps m-0">Gesamtvolumen</h2>
      <p className="m-0 flex items-baseline gap-2">
        <span className="text-5xl font-extrabold leading-none tracking-tight text-ink">{formatNumber(cmp.current, 0)}</span>
        <span className="text-lg font-semibold text-zinc-400">kg</span>
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {range.prevFrom !== null && (
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${tone}`}>
            <Icon className="size-4" aria-hidden />
            {delta === null ? 'kein Vergleich' : `${delta > 0 ? '+' : ''}${formatNumber(delta, 1)} %`}
            <span className="sr-only"> gegenüber dem vorherigen Zeitraum</span>
          </span>
        )}
        <span className="text-sm text-zinc-500">
          {range.prevFrom !== null && cmp.previous !== null
            ? `vorher ${formatNumber(cmp.previous, 0)} kg · `
            : ''}
          {count} {count === 1 ? 'Einheit' : 'Einheiten'}
        </span>
      </div>
    </section>
  )
}

function VolumeTooltip({ active, payload }: { active?: boolean; payload?: { payload: VolumeBar }[] }) {
  const bar = payload?.[0]?.payload
  if (!active || !bar) return null
  return (
    <ChartTooltip
      title={bar.title}
      rows={[
        { color: bar.color, label: 'Volumen', value: `${formatNumber(bar.volume, 0)} kg` },
        ...(bar.sessions > 1 ? [{ color: '#A1A1AA', label: 'Einheiten', value: String(bar.sessions) }] : []),
      ]}
    />
  )
}

export function VolumeSection({ stats, range, period, today }: VolumeSectionProps) {
  const [chosen, setChosen] = useState<Granularity | null>(null)
  const granularity = chosen ?? DEFAULT_GRANULARITY[period]
  const bars = useMemo(() => volumeBars(stats, granularity, range, today), [stats, granularity, range, today])
  const total = totalVolume(statsInRange(stats, range.from, range.to))

  return (
    <>
      <Hero stats={stats} range={range} />
      <ChartCard
        title="Volumen"
        subtitle={granularity === 'session' ? 'Pro Einheit, gefärbt nach Training' : granularity === 'week' ? 'Summe pro Woche' : 'Summe pro Monat'}
        controls={<MiniToggle label="Darstellung" value={granularity} onChange={setChosen} options={GRANULARITY_OPTIONS} />}
        label={`Balkendiagramm des Volumens, Gesamt ${formatNumber(total, 0)} Kilogramm in ${bars.length} Balken`}
        table={
          bars.length > 0 ? (
            <TableView
              caption="Volumen"
              columns={['Zeitraum', 'Einheiten', 'Volumen (kg)']}
              rows={[...bars].reverse().map((b) => [b.title, b.sessions, formatNumber(b.volume, 0)])}
            />
          ) : undefined
        }
      >
        {bars.length === 0 ? (
          <p className="m-0 py-10 text-center text-sm text-zinc-500">Noch keine Einheit in diesem Zeitraum.</p>
        ) : (
          <>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={14} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={44} tickFormatter={compactNumber} />
                  <Tooltip cursor={{ fill: 'rgba(24,24,27,0.05)' }} content={<VolumeTooltip />} isAnimationActive={false} />
                  <Bar dataKey="volume" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {bars.map((b) => (
                      <Cell key={b.key} fill={b.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {granularity === 'session' && (
              <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-zinc-600">
                {(['training1', 'training2', 'training3', 'free'] as const).map((k) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: TRAINING_COLORS[k] }} aria-hidden />
                    {TRAINING_COLOR_LABELS[k]}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </ChartCard>
    </>
  )
}
