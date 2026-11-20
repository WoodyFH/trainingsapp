import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Archive, ArchiveRestore, GripVertical, Plus, SearchX, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { MuscleBodySVG } from '../components/muscle/MuscleBodySVG'
import { LibrarySheet } from '../components/training/LibrarySheet'
import { ColorPicker, IconPicker } from '../components/ui/Pickers'
import { EmptyState } from '../components/ui/EmptyState'
import { useTemplateLinks } from '../data/planQueries'
import { useExercises, useTemplate } from '../data/queries'
import {
  addExerciseToTemplate,
  removeTemplateLink,
  reorderTemplateLinks,
  setInRotation,
  setTemplateArchived,
  updateTemplate,
} from '../data/plans'
import { withAlpha } from '../lib/color'
import { getIcon } from '../lib/icons'
import { intensityFromExercises } from '../lib/volume'

function SortableRow({
  id,
  onMove,
  children,
}: {
  id: string
  /** Verschiebt die Zeile per Pfeiltaste um eine Position (−1 hoch, +1 runter). */
  onMove: (direction: -1 | 1) => void
  children: (handle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const button = e.currentTarget
          onMove(e.key === 'ArrowUp' ? -1 : 1)
          // Nach dem Umsortieren den Fokus auf dem Griff behalten.
          requestAnimationFrame(() => button.focus())
          return
        }
        listeners?.onKeyDown?.(e)
      }}
      aria-label="Sortieren: ziehen oder Pfeiltasten hoch und runter"
      className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-zinc-400 active:cursor-grabbing"
    >
      <GripVertical className="size-5" aria-hidden />
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? 'z-10 opacity-90 shadow-xl' : ''}`}
    >
      {children(handle)}
    </li>
  )
}

export function TemplateEditorPage() {
  const { id } = useParams()
  const template = useTemplate(id)
  const links = useTemplateLinks(id)
  const activeExercises = useExercises(false)

  const [name, setName] = useState('')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [order, setOrder] = useState<string[]>([])

  useEffect(() => {
    if (template) setName(template.name)
    // Name nur beim Laden bzw. Wechsel des Trainings übernehmen, nicht bei jedem Tastendruck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id])

  const linkKey = (links ?? []).map((l) => l.link.id).join(',')
  useEffect(() => {
    setOrder((links ?? []).map((l) => l.link.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  const byLinkId = useMemo(() => new Map((links ?? []).map((l) => [l.link.id, l])), [links])
  const orderedLinks = order.map((linkId) => byLinkId.get(linkId)).filter((l) => l !== undefined)
  const previewExercises = orderedLinks.map((l) => l.exercise).filter((e) => !e.archived)

  if (template === null) {
    return (
      <EmptyState Icon={SearchX} title="Training nicht gefunden">
        Dieses Training gibt es nicht mehr.
      </EmptyState>
    )
  }
  if (!template || !links || !id) {
    return <div className="card h-48 animate-pulse" role="status" aria-label="Lädt" />
  }

  const Icon = getIcon(template.icon)

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = order.indexOf(String(active.id))
    const to = order.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    const next = arrayMove(order, from, to)
    setOrder(next)
    void reorderTemplateLinks(id, next)
  }

  const moveBy = (linkId: string, direction: -1 | 1) => {
    const from = order.indexOf(linkId)
    const to = from + direction
    if (from === -1 || to < 0 || to >= order.length) return
    const next = arrayMove(order, from, to)
    setOrder(next)
    void reorderTemplateLinks(id, next)
  }

  const commitName = () => {
    if (name.trim() && name.trim() !== template.name) void updateTemplate(id, { name })
    else setName(template.name)
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <aside className="card order-first flex flex-col items-center gap-3 p-5 lg:sticky lg:top-6 lg:order-2">
        <h2 className="label-caps m-0 self-start">Vorschau</h2>
        <MuscleBodySVG
          size="md"
          intensity={intensityFromExercises(previewExercises)}
          accentColor={template.color}
          ariaLabel="Vorschau der trainierten Muskeln dieses Trainings"
        />
        <p className="m-0 text-center text-xs text-zinc-500">
          {previewExercises.length === 0
            ? 'Füge Übungen hinzu, um die Vorschau zu sehen.'
            : 'Je dunkler, desto häufiger wird der Muskel in diesem Training trainiert.'}
        </p>
      </aside>

      <div className="flex flex-col gap-4 lg:order-1">
        <section className="card flex flex-col gap-4 p-5" aria-label="Eigenschaften">
          <div className="flex items-center gap-3">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: withAlpha(template.color, 0.14), color: template.color }}
            >
              <Icon className="size-6" aria-hidden />
            </span>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="label-caps">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
                className="h-12 w-full rounded-2xl bg-zinc-100 px-4 text-lg font-bold text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
              />
            </label>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={template.in_rotation}
            disabled={template.archived}
            onClick={() => void setInRotation(template.id, !template.in_rotation)}
            className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-4 py-3 text-left disabled:opacity-50"
          >
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-ink">In der Rotation</span>
              <span className="text-xs text-zinc-500">
                {template.in_rotation
                  ? `Training ${template.rotation_order}, kommt der Reihe nach dran`
                  : 'Wird nicht automatisch vorgeschlagen'}
              </span>
            </span>
            <span
              className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
              style={{ background: template.in_rotation ? template.color : '#D4D4D8' }}
              aria-hidden
            >
              <span
                className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${
                  template.in_rotation ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </span>
          </button>

          <details className="rounded-2xl bg-zinc-50 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Farbe und Symbol</summary>
            <div className="mt-4 flex flex-col gap-4">
              <ColorPicker value={template.color} onChange={(color) => void updateTemplate(template.id, { color })} />
              <IconPicker
                value={template.icon}
                color={template.color}
                onChange={(icon) => void updateTemplate(template.id, { icon })}
              />
            </div>
          </details>
        </section>

        <section className="flex flex-col gap-3" aria-label="Übungen">
          <h2 className="label-caps m-0 px-1">Übungen ({orderedLinks.length})</h2>
          {orderedLinks.length === 0 ? (
            <p className="card m-0 px-5 py-6 text-center text-sm text-zinc-500">Noch keine Übung in diesem Training.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              accessibility={{
                screenReaderInstructions: {
                  draggable: 'Ziehe die Übung mit der Maus oder dem Finger, oder verschiebe sie mit den Pfeiltasten hoch und runter.',
                },
                announcements: {
                  onDragStart: () => 'Übung gegriffen.',
                  onDragOver: () => undefined,
                  onDragEnd: () => 'Übung abgelegt.',
                  onDragCancel: () => 'Verschieben abgebrochen.',
                },
              }}
            >
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {orderedLinks.map(({ link, exercise }) => (
                    <SortableRow key={link.id} id={link.id} onMove={(d) => moveBy(link.id, d)}>
                      {(handle) => (
                        <div className="card flex items-center gap-2 py-2 pl-2 pr-3">
                          {handle}
                          <MuscleBodySVG
                            size="sm"
                            primaryMuscles={exercise.primary_muscles}
                            secondaryMuscles={exercise.secondary_muscles}
                            accentColor={template.color}
                          />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-bold text-ink">{exercise.name}</span>
                            <span className="truncate text-xs text-zinc-500">
                              {[exercise.short_name, exercise.archived ? 'archiviert, wird nicht angezeigt' : null]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          <button
                            type="button"
                            aria-label={`${exercise.name} aus dem Training entfernen`}
                            onClick={() => void removeTemplateLink(link.id)}
                            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100"
                          >
                            <X className="size-5" aria-hidden />
                          </button>
                        </div>
                      )}
                    </SortableRow>
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="flex h-14 items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-zinc-300 font-semibold text-zinc-500 transition active:scale-[0.99]"
          >
            <Plus className="size-5" aria-hidden />
            Übung hinzufügen
          </button>
        </section>

        <button
          type="button"
          onClick={() => void setTemplateArchived(template.id, !template.archived)}
          className="flex h-12 items-center justify-center gap-2 self-start rounded-2xl bg-white px-5 text-sm font-semibold text-zinc-600 shadow-sm"
        >
          {template.archived ? (
            <ArchiveRestore className="size-4" aria-hidden />
          ) : (
            <Archive className="size-4" aria-hidden />
          )}
          {template.archived ? 'Training wiederherstellen' : 'Training archivieren'}
        </button>
      </div>

      <LibrarySheet
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        exercises={activeExercises ?? []}
        includedIds={new Set(orderedLinks.map((l) => l.exercise.id))}
        onPick={(e) => void addExerciseToTemplate(template.id, e.id)}
        accentColor={template.color}
      />
    </div>
  )
}
