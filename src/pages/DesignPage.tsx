import { Check, Dumbbell, Footprints, Activity } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { MuscleBodySVG } from '../components/muscle/MuscleBodySVG'
import { Stepper } from '../components/ui/Stepper'
import { pastel, withAlpha } from '../lib/color'
import { TRAINING_COLORS, TRAINING_COLOR_LABELS, type TrainingColorKey } from '../lib/trainingColors'
import { MUSCLE_IDS, MUSCLE_LABELS, type MuscleId } from '../types/muscles'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2 className="label-caps m-0">{title}</h2>
      {children}
    </section>
  )
}

const DEMO_PRIMARY: MuscleId[] = ['chest', 'triceps', 'quads', 'glutes']
const DEMO_SECONDARY: MuscleId[] = ['shoulders', 'abs', 'hamstrings']

/** Deterministische Pseudo-Intensitäten für die Heatmap-Demo. */
const DEMO_INTENSITY: Partial<Record<MuscleId, number>> = {
  chest: 1,
  shoulders: 0.7,
  biceps: 0.45,
  abs: 0.3,
  obliques: 0.15,
  quads: 0.85,
  adductors: 0.25,
  upper_back: 0.6,
  triceps: 0.5,
  lower_back: 0.2,
  glutes: 0.75,
  hamstrings: 0.4,
  calves: 0.1,
}

const HEAT_KINDS: (TrainingColorKey | null)[] = [
  'training1', null, 'training2', 'training3', null, null, 'cardio', 'free', null, 'training1', 'training2', null,
]

function heatCells() {
  return Array.from({ length: 5 * 14 }, (_, i) => {
    const kind = HEAT_KINDS[(i * 7 + (i % 3) * 5) % HEAT_KINDS.length] ?? null
    return { id: i, kind }
  })
}

const TRAINING_ICONS = { training1: Dumbbell, training2: Footprints, training3: Activity } as const

export function DesignPage() {
  const [accent, setAccent] = useState<TrainingColorKey>('training1')
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState(12)
  const [kg, setKg] = useState(85)
  const [primary, setPrimary] = useState<MuscleId[]>(['chest'])
  const [secondary, setSecondary] = useState<MuscleId[]>(['shoulders'])

  const accentHex = TRAINING_COLORS[accent]

  /** Einmal tippen primär, zweimal sekundär, dreimal aus (Übungseditor, Abschnitt 6.3 E). */
  const cycleMuscle = (id: MuscleId) => {
    if (primary.includes(id)) {
      setPrimary(primary.filter((m) => m !== id))
      setSecondary([...secondary, id])
    } else if (secondary.includes(id)) {
      setSecondary(secondary.filter((m) => m !== id))
    } else {
      setPrimary([...primary, id])
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      <Section title="Muskel-Männchen · Zustände">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Akzentfarbe wählen">
          {(Object.keys(TRAINING_COLORS) as TrainingColorKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={accent === key}
              onClick={() => setAccent(key)}
              className={`flex h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold transition ${
                accent === key ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              <span className="size-3 rounded-full" style={{ background: TRAINING_COLORS[key] }} />
              {TRAINING_COLOR_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="flex justify-center py-2">
          <MuscleBodySVG size="lg" primaryMuscles={DEMO_PRIMARY} secondaryMuscles={DEMO_SECONDARY} accentColor={accentHex} />
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-zinc-500">
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: accentHex }} /> primär
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: pastel(accentHex, 0.28) }} /> sekundär
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-[#E5E5EA]" /> inaktiv
          </li>
        </ul>
      </Section>

      <Section title="Größen">
        <div className="flex items-end justify-around gap-4">
          {(['sm', 'md'] as const).map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <MuscleBodySVG
                size={s}
                primaryMuscles={['chest', 'quads']}
                secondaryMuscles={['shoulders', 'abs']}
                accentColor={accentHex}
              />
              <span className="label-caps">{s}</span>
            </div>
          ))}
        </div>
        <p className="m-0 text-sm text-zinc-500">
          <code>sm</code> sitzt in den Übungskarten, <code>md</code> in Vorschauen, <code>lg</code> (oben) in der Statistik
          und im Übungseditor.
        </p>
      </Section>

      <Section title="Intensität (Heatmap)">
        <div className="flex justify-center">
          <MuscleBodySVG size="md" intensity={DEMO_INTENSITY} accentColor={accentHex} />
        </div>
        <div
          className="h-2.5 rounded-full"
          style={{ background: `linear-gradient(to right, #E5E5EA, ${accentHex})` }}
          aria-hidden
        />
        <div className="flex justify-between text-xs text-zinc-400">
          <span>kaum trainiert</span>
          <span>viel trainiert</span>
        </div>
      </Section>

      <Section title="Auswahl (Übungseditor)">
        <div className="flex justify-center">
          <MuscleBodySVG
            size="lg"
            selectable
            primaryMuscles={primary}
            secondaryMuscles={secondary}
            accentColor={accentHex}
            onMuscleClick={cycleMuscle}
            className="scale-90 origin-top -mb-6"
          />
        </div>
        <p className="m-0 text-sm text-zinc-500">
          Einmal tippen primär, zweimal sekundär, dreimal aus. Auch per Tab-Taste und Enter bedienbar.
        </p>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-semibold text-ink">Primär</dt>
          <dd className="m-0 text-zinc-600">{primary.length ? primary.map((m) => MUSCLE_LABELS[m]).join(', ') : '–'}</dd>
          <dt className="font-semibold text-ink">Sekundär</dt>
          <dd className="m-0 text-zinc-600">
            {secondary.length ? secondary.map((m) => MUSCLE_LABELS[m]).join(', ') : '–'}
          </dd>
        </dl>
      </Section>

      <Section title="Alle Muskelzonen">
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
          {MUSCLE_IDS.map((id) => (
            <li key={id} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2">
              <MuscleBodySVG
                size="sm"
                views={id === 'shoulders' ? 'front' : ['upper_back', 'triceps', 'lower_back', 'glutes', 'hamstrings', 'calves'].includes(id) ? 'back' : 'front'}
                primaryMuscles={[id]}
                accentColor={accentHex}
              />
              <span className="text-xs font-medium leading-tight text-zinc-600">{MUSCLE_LABELS[id]}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Farben pro Trainingsart">
        <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
          {(Object.keys(TRAINING_COLORS) as TrainingColorKey[]).map((key) => (
            <li key={key} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: withAlpha(TRAINING_COLORS[key], 0.13) }}>
              <span className="size-9 rounded-xl" style={{ background: TRAINING_COLORS[key] }} />
              <span className="flex flex-col">
                <span className="text-sm font-bold text-ink">{TRAINING_COLOR_LABELS[key]}</span>
                <span className="text-xs tabular-nums text-zinc-500">{TRAINING_COLORS[key]}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Trainings-Buttons (Rotation)">
        <div className="grid grid-cols-3 gap-2">
          {(['training1', 'training2', 'training3'] as const).map((key, i) => {
            const Icon = TRAINING_ICONS[key]
            const next = i === 0
            const color = TRAINING_COLORS[key]
            return (
              <button
                key={key}
                type="button"
                className="relative flex min-h-32 flex-col items-start justify-between rounded-3xl p-3 text-left transition active:scale-[0.98]"
                style={
                  next
                    ? { background: color, color: '#fff', boxShadow: `0 0 0 3px ${withAlpha(color, 0.35)}` }
                    : { background: withAlpha(color, 0.13), color: '#18181B' }
                }
              >
                {next && <span className="text-[10px] font-extrabold tracking-wider opacity-90">ALS NÄCHSTES</span>}
                <Icon className="size-6" style={next ? undefined : { color }} aria-hidden />
                <span className="flex flex-col">
                  <span className="text-sm font-bold">{TRAINING_COLOR_LABELS[key]}</span>
                  <span className="text-[11px] opacity-70">16.11.2026</span>
                </span>
              </button>
            )
          })}
        </div>
        <p className="m-0 text-sm text-zinc-500">Vorschau der Rotation. Die echte Startseite folgt in Phase 3.</p>
      </Section>

      <Section title="Stepper">
        <div className="grid grid-cols-1 gap-4">
          <Stepper label="Sätze" value={sets} onChange={setSets} min={1} max={10} />
          <Stepper label="Wiederholungen" value={reps} onChange={setReps} min={1} max={100} />
          <Stepper label="Gewicht" value={kg} onChange={setKg} step={2.5} unit="kg" />
        </div>
        <button
          type="button"
          className="flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition active:scale-[0.98]"
          style={{ background: accentHex }}
        >
          <Check className="size-5" aria-hidden />
          Wie letztes Mal
        </button>
      </Section>

      <Section title="Heatmap">
        <div className="grid grid-flow-col grid-rows-5 gap-1">
          {heatCells().map(({ id, kind }) => (
            <span
              key={id}
              className="aspect-square rounded-md"
              style={{ background: kind ? TRAINING_COLORS[kind] : '#EFEFF2', opacity: kind ? 1 : 0.8 }}
            />
          ))}
        </div>
        <p className="m-0 text-sm text-zinc-500">Abgerundete Quadrate, Farbe nach Trainingsart.</p>
      </Section>
    </div>
  )
}
