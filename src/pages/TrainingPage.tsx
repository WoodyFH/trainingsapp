import { ChevronRight, HeartPulse, Play, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MuscleBodySVG } from '../components/muscle/MuscleBodySVG'
import { useActivity, useOpenSessionToday, useRotationInfo } from '../data/queries'
import { withAlpha } from '../lib/color'
import { addDays, formatShortDate, startOfWeek, todayIso } from '../lib/date'
import { getIcon } from '../lib/icons'
import { TRAINING_COLORS } from '../lib/trainingColors'
import { normalizeIntensity } from '../lib/volume'
import type { MuscleId } from '../types/muscles'

const HEATMAP_WEEKS = 14

function RotationButtons() {
  const info = useRotationInfo()

  if (!info) {
    return (
      <div className="grid grid-cols-3 gap-2" aria-label="Lädt" role="status">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl bg-white" />
        ))}
      </div>
    )
  }

  // Alle drei Kacheln haben denselben Aufbau (Hinweiszeile, Symbol, Titel, Name, zuletzt),
  // damit Symbole und Texte in einer Linie stehen. Die Hinweiszeile bleibt bei den anderen leer.
  return (
    <div className="grid grid-cols-3 gap-2">
      {info.templates.map((t) => {
        const isNext = t.id === info.nextId
        const Icon = getIcon(t.icon)
        const last = info.lastDate.get(t.id)
        return (
          <Link
            key={t.id}
            to={`/training/${t.id}`}
            aria-label={`Training ${t.rotation_order}, ${t.name}${isNext ? ', als Nächstes' : ''}`}
            className="relative flex min-w-0 flex-col gap-1 rounded-3xl p-2.5 text-left transition active:scale-[0.98]"
            style={
              isNext
                ? { background: t.color, color: '#fff', border: `3px solid ${withAlpha('#000000', 0.12)}` }
                : { background: withAlpha(t.color, 0.13), color: '#18181B', border: '3px solid transparent' }
            }
          >
            <span className="h-3 text-[10px] font-extrabold uppercase leading-3 tracking-wider opacity-90" aria-hidden>
              {isNext ? 'Als Nächstes' : ''}
            </span>
            <Icon className="size-7" style={isNext ? undefined : { color: t.color }} aria-hidden />
            <span className="mt-2 flex min-w-0 flex-col">
              <span className="truncate text-sm font-extrabold leading-tight">Training {t.rotation_order}</span>
              <span className={`truncate text-xs font-medium leading-tight ${isNext ? 'opacity-90' : 'text-zinc-600'}`}>{t.name}</span>
              <span className={`mt-1 truncate text-[11px] leading-tight ${isNext ? 'opacity-80' : 'text-zinc-500'}`}>
                {last ? `zuletzt ${formatShortDate(last)}` : 'noch nie'}
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function WideLink({
  to,
  color,
  Icon,
  title,
  subtitle,
}: {
  to: string
  color: string
  Icon: typeof Zap
  title: string
  subtitle: string
}) {
  return (
    <Link to={to} className="card flex items-center gap-3 px-3 py-2.5 transition active:scale-[0.99]">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: withAlpha(color, 0.14), color }}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-extrabold leading-tight text-ink">{title}</span>
        <span className="truncate text-sm leading-tight text-zinc-500">{subtitle}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-zinc-300" aria-hidden />
    </Link>
  )
}

function ContinueBanner({ today }: { today: string }) {
  const open = useOpenSessionToday(today)
  if (!open) return null
  const { session, template, logCount } = open
  const color = template?.color ?? TRAINING_COLORS.free
  const to = template ? `/training/${template.id}` : '/frei'
  const name = template
    ? `${template.rotation_order ? `Training ${template.rotation_order}` : 'Training'} · ${template.name}`
    : 'Freitraining'
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-3xl p-4 text-white shadow-sm transition active:scale-[0.99]"
      style={{ background: color }}
      aria-label={`Training fortsetzen: ${name}`}
      data-session={session.id}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
        <Play className="size-6" fill="currentColor" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-base font-extrabold">Training fortsetzen</span>
        <span className="truncate text-sm opacity-90">
          {name} · {logCount} {logCount === 1 ? 'Übung' : 'Übungen'} erledigt
        </span>
      </span>
    </Link>
  )
}

const HEAT_EMPTY = '#EFEFF2'

function WeekCard({ today }: { today: string }) {
  const fromDate = startOfWeek(addDays(today, -(HEATMAP_WEEKS - 1) * 7))
  const since = addDays(today, -6)
  const data = useActivity(fromDate, since)

  const intensity = data ? normalizeIntensity(data.muscleSets as Partial<Record<MuscleId, number>>) : {}
  const hasWeek = Object.keys(intensity).length > 0

  const cells: { date: string; color: string; future: boolean }[] = []
  for (let i = 0; i < HEATMAP_WEEKS * 7; i++) {
    const date = addDays(fromDate, i)
    const day = data?.activity.get(date)
    let color = HEAT_EMPTY
    if (day) {
      if (day.kinds.includes('strength')) color = day.templateColor ?? TRAINING_COLORS.training1
      else if (day.kinds.includes('free')) color = TRAINING_COLORS.free
      else color = TRAINING_COLORS.cardio
    }
    cells.push({ date, color, future: date > today })
  }
  const trainingDays = data?.activity.size ?? 0

  return (
    <section className="card flex flex-col gap-3 p-4 sm:gap-5 sm:p-5" aria-label="Diese Woche">
      <h2 className="label-caps m-0">Diese Woche</h2>
      <div className="flex flex-col items-center gap-2">
        <div className="sm:hidden">
          <MuscleBodySVG size="md" height={132} intensity={intensity} accentColor={TRAINING_COLORS.training1} />
        </div>
        <div className="hidden sm:block">
          <MuscleBodySVG size="lg" intensity={intensity} accentColor={TRAINING_COLORS.training1} />
        </div>
        {data && !hasWeek && (
          <p className="m-0 text-sm text-zinc-500">Noch keine Einheit in den letzten 7 Tagen.</p>
        )}
      </div>

      <div
        className="mx-auto grid grid-flow-col grid-rows-[repeat(7,10px)] auto-cols-[10px] gap-[3px] sm:grid-rows-[repeat(7,16px)] sm:auto-cols-[16px] sm:gap-1"
        role="img"
        aria-label={`${trainingDays} Trainingstage in den letzten ${HEATMAP_WEEKS} Wochen`}
      >
        {cells.map((c) => (
          <span
            key={c.date}
            title={c.future ? undefined : formatShortDate(c.date)}
            className="rounded-[3px] sm:rounded-md"
            style={{ background: c.color, opacity: c.future ? 0.35 : 1 }}
          />
        ))}
      </div>
    </section>
  )
}

export function TrainingPage() {
  const today = todayIso()
  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
      <div className="flex flex-col gap-3 lg:gap-4">
        <ContinueBanner today={today} />
        <RotationButtons />
        <WideLink
          to="/cardio"
          color={TRAINING_COLORS.cardio}
          Icon={HeartPulse}
          title="Cardio"
          subtitle="Dauer, Kalorien, Puls"
        />
        <WideLink
          to="/frei"
          color={TRAINING_COLORS.free}
          Icon={Zap}
          title="Freitraining"
          subtitle="Übungen frei wählen"
        />
      </div>
      <WeekCard today={today} />
    </div>
  )
}
