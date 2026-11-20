import { ArrowDown, ArrowUp, ChevronRight, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ColorPicker, IconPicker } from '../components/ui/Pickers'
import { Sheet } from '../components/ui/Sheet'
import { useAllTemplates, useTemplateExerciseCounts } from '../data/planQueries'
import { createTemplate, moveInRotation } from '../data/plans'
import { withAlpha } from '../lib/color'
import { getIcon } from '../lib/icons'
import { TRAINING_COLORS } from '../lib/trainingColors'
import type { GymTemplate } from '../types/db'

/** Umschalter zwischen Trainings und Übungsbibliothek (beide im Reiter "Pläne"). */
export function PlansTabs() {
  const base = 'flex h-11 flex-1 items-center justify-center rounded-2xl text-sm font-semibold transition'
  return (
    <nav aria-label="Bereich" className="flex gap-2 rounded-3xl bg-white p-1.5 shadow-sm">
      <NavLink
        to="/plaene"
        end
        className={({ isActive }) => `${base} ${isActive ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
      >
        Trainings
      </NavLink>
      <NavLink
        to="/plaene/uebungen"
        className={({ isActive }) => `${base} ${isActive ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
      >
        Übungen
      </NavLink>
    </nav>
  )
}

function TemplateRow({
  template,
  count,
  rotationIndex,
  rotationSize,
}: {
  template: GymTemplate
  count: number
  rotationIndex?: number
  rotationSize?: number
}) {
  const Icon = getIcon(template.icon)
  const inRotation = rotationIndex !== undefined
  return (
    <li className="flex items-center gap-2">
      <Link
        to={`/plaene/training/${template.id}`}
        className="card flex min-w-0 flex-1 items-center gap-4 p-4 transition active:scale-[0.99]"
      >
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: withAlpha(template.color, 0.14), color: template.color }}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          {template.rotation_order && inRotation && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Training {template.rotation_order}
            </span>
          )}
          <span className="truncate text-base font-extrabold text-ink">{template.name}</span>
          <span className="text-sm text-zinc-500">
            {count} {count === 1 ? 'Übung' : 'Übungen'}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-zinc-300" aria-hidden />
      </Link>
      {inRotation && (
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            aria-label={`${template.name} in der Rotation nach vorn`}
            disabled={rotationIndex === 0}
            onClick={() => void moveInRotation(template.id, -1)}
            className="flex size-10 items-center justify-center rounded-xl bg-white text-zinc-500 shadow-sm disabled:opacity-30"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`${template.name} in der Rotation nach hinten`}
            disabled={rotationIndex === (rotationSize ?? 1) - 1}
            onClick={() => void moveInRotation(template.id, 1)}
            className="flex size-10 items-center justify-center rounded-xl bg-white text-zinc-500 shadow-sm disabled:opacity-30"
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </li>
  )
}

function NewTemplateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(TRAINING_COLORS.training2)
  const [icon, setIcon] = useState('Dumbbell')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Bitte einen Namen eingeben.')
      return
    }
    const created = await createTemplate({ name, color, icon })
    setName('')
    setError(null)
    onClose()
    navigate(`/plaene/training/${created.id}`)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Neues Training">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Schultern & Arme"
            className="h-12 rounded-2xl bg-zinc-100 px-4 text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
          />
        </label>
        <div className="flex flex-col gap-2">
          <span className="label-caps">Farbe</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="label-caps">Symbol</span>
          <IconPicker value={icon} onChange={setIcon} color={color} />
        </div>
        {error && (
          <p role="alert" className="m-0 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" className="h-12 rounded-2xl font-bold text-white" style={{ background: color }}>
          Anlegen
        </button>
      </form>
    </Sheet>
  )
}

export function PlansPage() {
  const templates = useAllTemplates()
  const counts = useTemplateExerciseCounts()
  const [newOpen, setNewOpen] = useState(false)

  if (!templates || !counts) {
    return (
      <div className="flex flex-col gap-4">
        <PlansTabs />
        <div className="card h-40 animate-pulse" role="status" aria-label="Lädt" />
      </div>
    )
  }

  const rotation = templates
    .filter((t) => t.in_rotation && !t.archived)
    .sort((a, b) => (a.rotation_order ?? 999) - (b.rotation_order ?? 999))
  const others = templates.filter((t) => !t.in_rotation && !t.archived).sort((a, b) => a.sort - b.sort)
  const archived = templates.filter((t) => t.archived).sort((a, b) => a.sort - b.sort)

  return (
    <div className="flex flex-col gap-5 lg:max-w-2xl">
      <PlansTabs />

      <section className="flex flex-col gap-3" aria-label="Rotation">
        <div className="flex flex-col gap-1 px-1">
          <h2 className="label-caps m-0">Rotation</h2>
          <p className="m-0 text-sm text-zinc-500">Diese Trainings kommen der Reihe nach dran.</p>
        </div>
        {rotation.length === 0 ? (
          <p className="card m-0 px-5 py-6 text-center text-sm text-zinc-500">Noch kein Training in der Rotation.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {rotation.map((t, i) => (
              <TemplateRow
                key={t.id}
                template={t}
                count={counts.get(t.id) ?? 0}
                rotationIndex={i}
                rotationSize={rotation.length}
              />
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Weitere Trainings">
          <h2 className="label-caps m-0 px-1">Weitere Trainings</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {others.map((t) => (
              <TemplateRow key={t.id} template={t} count={counts.get(t.id) ?? 0} />
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => setNewOpen(true)}
        className="flex h-14 items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-zinc-300 font-semibold text-zinc-500 transition active:scale-[0.99]"
      >
        <Plus className="size-5" aria-hidden />
        Neues Training
      </button>

      {archived.length > 0 && (
        <details className="flex flex-col gap-3">
          <summary className="label-caps cursor-pointer px-1">Archiviert ({archived.length})</summary>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {archived.map((t) => (
              <TemplateRow key={t.id} template={t} count={counts.get(t.id) ?? 0} />
            ))}
          </ul>
        </details>
      )}

      <NewTemplateSheet open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}
