import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useDraft } from '../../hooks/useDraft'
import { formatNumber } from '../../lib/date'
import { PERIODS, type PeriodKey } from '../../stats/period'

/** Gemeinsame Bausteine der Statistik-Seiten. */

// Diagramm-Farben (Text und Raster bleiben leise, die Daten sind das Laute)
export const CHART = {
  surface: '#FFFFFF',
  grid: '#EFEFF2',
  axisText: '#71717A',
  ink: '#27272A',
  accent: '#F04E5E',
} as const

export const AXIS_TICK = { fill: CHART.axisText, fontSize: 11 } as const

/** 0 / 1.500 / 12K: ab 10.000 kompakt, darunter ausgeschrieben. */
export function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)} Mio.`
  if (Math.abs(value) >= 10_000) return `${formatNumber(value / 1000, 0)}K`
  return formatNumber(value, 0)
}

export function usePeriod(): [PeriodKey, (p: PeriodKey) => void] {
  const [state, setState] = useDraft<{ key: PeriodKey }>('stats:period', { key: '3m' })
  const key = PERIODS.some((p) => p.key === state.key) ? state.key : '3m'
  return [key, (p) => setState({ key: p })]
}

/** Zeitraumfilter in einer Zeile über allem, was er betrifft. */
export function PeriodFilter({ value, onChange }: { value: PeriodKey; onChange: (p: PeriodKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Zeitraum" className="flex gap-1.5 rounded-3xl bg-white p-1.5 shadow-sm">
      {PERIODS.map((p) => {
        const active = p.key === value
        return (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p.key)}
            className={`h-10 flex-1 whitespace-nowrap rounded-2xl px-2 text-sm font-semibold transition ${
              active ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'
            }`}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

const TAB_BASE = 'flex h-11 flex-1 items-center justify-center whitespace-nowrap rounded-2xl px-2 text-sm font-semibold transition'

export function StatsTabs() {
  const tabs = [
    { to: '/statistik', label: 'Übersicht', end: true },
    { to: '/statistik/uebungen', label: 'Übungen', end: false },
    { to: '/statistik/cardio', label: 'Cardio', end: false },
    { to: '/statistik/verlauf', label: 'Verlauf', end: false },
  ]
  return (
    <nav aria-label="Bereich der Statistik" className="flex gap-1.5 rounded-3xl bg-white p-1.5 shadow-sm">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => `${TAB_BASE} ${isActive ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Karte um ein Diagramm: Titel, Untertitel, optionale Bedienelemente rechts, Tabellenansicht darunter. */
export function ChartCard({
  title,
  subtitle,
  controls,
  children,
  table,
  label,
}: {
  title: string
  subtitle?: string
  controls?: ReactNode
  children: ReactNode
  /** Tabellenansicht (gleiche Werte wie das Diagramm, ohne Hover erreichbar). */
  table?: ReactNode
  /** Kurzbeschreibung des Diagramms für Screenreader. */
  label?: string
}) {
  return (
    <section className="card flex flex-col gap-4 p-5" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="label-caps m-0">{title}</h2>
          {subtitle && <p className="m-0 text-sm text-zinc-500">{subtitle}</p>}
        </div>
        {controls}
      </div>
      <div role={label ? 'img' : undefined} aria-label={label}>
        {children}
      </div>
      {table}
    </section>
  )
}

/** Auswahl aus wenigen Werten im Kopf einer Karte (z. B. Einheit, Woche, Monat). */
export function MiniToggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-zinc-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-xl px-3 text-xs font-semibold transition ${
            o.value === value ? 'bg-white text-ink shadow-sm' : 'text-zinc-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Tabellenansicht zu einem Diagramm. Die Werte sind so auch ohne Hover und ohne Farbunterscheidung lesbar. */
export function TableView({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <details className="rounded-2xl bg-zinc-50 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-600">Tabelle anzeigen</summary>
      <div className="mt-3 max-h-72 overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={`sticky top-0 bg-zinc-50 pb-2 pr-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 ${i > 0 ? 'text-right' : ''}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-line">
                {r.map((cell, ci) => (
                  <td key={ci} className={`py-1.5 pr-3 ${ci > 0 ? 'text-right tabular-nums' : ''} text-zinc-700`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export interface TooltipRow {
  color: string
  label: string
  value: string
}

/** Tooltip: der Wert führt, der Name folgt (Liniensymbol statt Kästchen). */
export function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/5">
      <p className="m-0 mb-1 font-semibold text-zinc-500">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="m-0 flex items-center gap-2">
          <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
          <span className="text-sm font-bold text-ink">{r.value}</span>
          <span className="text-zinc-500">{r.label}</span>
        </p>
      ))}
    </div>
  )
}

export function Loading() {
  return <div className="card h-48 animate-pulse" role="status" aria-label="Lädt" />
}
