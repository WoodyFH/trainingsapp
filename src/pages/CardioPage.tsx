import { Check, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { DateField } from '../components/ui/DateField'
import { Sheet } from '../components/ui/Sheet'
import { useCardioLogsForDate, useCardioTypes } from '../data/queries'
import { createCardioType, deleteCardioLog, hasCardioValue, saveCardioLog, type CardioInput } from '../data/sessions'
import { withAlpha } from '../lib/color'
import { distanceFieldUnit, distanceLabel, formatDistance } from '../lib/cardio'
import { formatNumber, todayIso } from '../lib/date'
import { getIcon, ICON_NAMES } from '../lib/icons'
import { TRAINING_COLORS } from '../lib/trainingColors'
import type { DistanceUnit, GymCardioType } from '../types/db'

const COLOR = TRAINING_COLORS.cardio

/** Zahl aus einem Textfeld (Komma oder Punkt), leer = null. */
function parseField(text: string): number | null {
  const v = Number.parseFloat(text.replace(',', '.'))
  return Number.isNaN(v) ? null : v
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  inputMode = 'decimal',
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  inputMode?: 'decimal' | 'numeric'
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-caps">{label}</span>
      <span className="relative">
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-12 w-full rounded-2xl bg-zinc-100 pl-4 text-lg font-semibold tabular-nums text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300 ${unit ? 'pr-14' : 'pr-4'}`}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-zinc-400">
            {unit}
          </span>
        )}
      </span>
    </label>
  )
}

function NewTypeSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (t: GymCardioType) => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Activity')
  const [unit, setUnit] = useState<DistanceUnit>('km')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Bitte einen Namen eingeben.')
      return
    }
    const created = await createCardioType({ name, icon, distance_unit: unit })
    setName('')
    setIcon('Activity')
    setUnit('km')
    setError(null)
    onCreated(created)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Eigene Cardio-Art">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Skilanglauf"
            className="h-12 rounded-2xl bg-zinc-100 px-4 text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
          />
        </label>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="label-caps mb-1.5 p-0">Symbol</legend>
          <div className="grid grid-cols-6 gap-2">
            {ICON_NAMES.map((n) => {
              const Icon = getIcon(n)
              const active = icon === n
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={n}
                  aria-pressed={active}
                  onClick={() => setIcon(n)}
                  className="flex aspect-square items-center justify-center rounded-2xl transition"
                  style={active ? { background: COLOR, color: '#fff' } : { background: '#F4F4F5', color: '#71717A' }}
                >
                  <Icon className="size-5" aria-hidden />
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="label-caps mb-1.5 p-0">Distanzeinheit</legend>
          <div className="flex gap-2">
            {(['km', 'm', 'floors'] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => setUnit(u)}
                className="h-11 flex-1 rounded-2xl font-semibold transition"
                style={unit === u ? { background: COLOR, color: '#fff' } : { background: '#F4F4F5', color: '#52525B' }}
              >
                {u === 'km' ? 'Kilometer' : u === 'm' ? 'Meter' : 'Etagen'}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="m-0 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" className="h-12 rounded-2xl font-bold text-white" style={{ background: COLOR }}>
          Anlegen
        </button>
      </form>
    </Sheet>
  )
}

const EMPTY_FORM = { duration: '', kcal: '', hr: '', distance: '', note: '' }

export function CardioPage() {
  const types = useCardioTypes()
  const [date, setDate] = useState(todayIso())
  const logs = useCardioLogsForDate(date)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [newTypeOpen, setNewTypeOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (!types) return <div className="card h-48 animate-pulse" role="status" aria-label="Lädt" />

  const selected = types.find((t) => t.id === selectedId) ?? null
  const typeById = new Map(types.map((t) => [t.id, t]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    const input: CardioInput = {
      duration_min: parseField(form.duration),
      kcal: parseField(form.kcal) === null ? null : Math.round(parseField(form.kcal) as number),
      avg_hr: parseField(form.hr) === null ? null : Math.round(parseField(form.hr) as number),
      distance: parseField(form.distance),
      note: form.note.trim() ? form.note.trim() : null,
    }
    if (!hasCardioValue(input)) {
      setError(`Fülle mindestens einen Wert aus: Dauer, Kalorien, Puls oder ${distanceLabel(selected.distance_unit)}.`)
      return
    }
    setError(null)
    if ('vibrate' in navigator) navigator.vibrate?.(12)
    await saveCardioLog(date, selected.id, input)
    setForm(EMPTY_FORM)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <section className="flex flex-col gap-4" aria-label="Cardio-Art wählen">
        <div className="flex items-center justify-between gap-3">
          <h2 className="label-caps m-0">Art</h2>
          <DateField value={date} onChange={setDate} label="Datum des Cardio-Trainings (zum Nachtragen ändern)" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {types.map((t) => {
            const Icon = getIcon(t.icon)
            const active = t.id === selectedId
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelectedId(t.id)
                  setError(null)
                }}
                className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl p-3 text-center transition active:scale-[0.97]"
                style={active ? { background: COLOR, color: '#fff' } : { background: '#FFFFFF', color: '#18181B' }}
              >
                <Icon className="size-7" style={active ? undefined : { color: COLOR }} aria-hidden />
                <span className="text-sm font-bold leading-tight">{t.name}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setNewTypeOpen(true)}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-zinc-300 p-3 text-center text-zinc-500 transition active:scale-[0.97]"
          >
            <Plus className="size-7" aria-hidden />
            <span className="text-sm font-bold leading-tight">Eigene Art</span>
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        {selected ? (
          <form onSubmit={(e) => void submit(e)} className="card flex flex-col gap-4 p-5" noValidate>
            <h2 className="m-0 flex items-center gap-2 text-lg font-extrabold text-ink">
              <span className="size-3 rounded-full" style={{ background: COLOR }} aria-hidden />
              {selected.name}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Dauer" unit="min" value={form.duration} onChange={(v) => setForm((f) => ({ ...f, duration: v }))} />
              <NumberField label="Kalorien" unit="kcal" inputMode="numeric" value={form.kcal} onChange={(v) => setForm((f) => ({ ...f, kcal: v }))} />
              <NumberField label="Ø Puls" unit="bpm" inputMode="numeric" value={form.hr} onChange={(v) => setForm((f) => ({ ...f, hr: v }))} />
              <NumberField
                label={distanceLabel(selected.distance_unit)}
                unit={distanceFieldUnit(selected.distance_unit)}
                inputMode={selected.distance_unit === 'floors' ? 'numeric' : 'decimal'}
                value={form.distance}
                onChange={(v) => setForm((f) => ({ ...f, distance: v }))}
              />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="label-caps">Notiz</span>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="h-12 rounded-2xl bg-zinc-100 px-4 text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
              />
            </label>
            {error && (
              <p role="alert" className="m-0 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition active:scale-[0.98]"
              style={{ background: COLOR }}
            >
              <Check className="size-5" aria-hidden />
              {saved ? 'Gespeichert' : 'Speichern'}
            </button>
            <p className="m-0 text-center text-xs text-zinc-400">Alle Felder sind optional, mindestens eines muss ausgefüllt sein.</p>
          </form>
        ) : (
          <div className="card px-6 py-10 text-center text-sm text-zinc-500">Wähle oben eine Cardio-Art, um einen Eintrag anzulegen.</div>
        )}

        {logs && logs.length > 0 && (
          <section className="card flex flex-col gap-1 p-5" aria-label="Einträge dieses Tages">
            <h2 className="label-caps m-0 mb-2">Einträge dieses Tages</h2>
            {logs.map((l) => {
              const type = typeById.get(l.cardio_type_id)
              const Icon = getIcon(type?.icon)
              const parts = [
                l.duration_min !== null ? `${formatNumber(l.duration_min)} min` : null,
                l.kcal !== null ? `${l.kcal} kcal` : null,
                l.avg_hr !== null ? `Ø ${l.avg_hr} bpm` : null,
                l.distance !== null ? formatDistance(l.distance, type?.distance_unit) : null,
              ].filter(Boolean)
              return (
                <div key={l.id} className="flex items-center gap-3 border-t border-line py-3 first-of-type:border-t-0">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: withAlpha(COLOR, 0.14), color: COLOR }}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-bold text-ink">{type?.name ?? 'Cardio'}</span>
                    <span className="truncate text-sm text-zinc-500">{parts.join(' · ')}</span>
                    {l.note && <span className="truncate text-xs text-zinc-400">{l.note}</span>}
                  </span>
                  {confirmDeleteId === l.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        void deleteCardioLog(l.id)
                        setConfirmDeleteId(null)
                      }}
                      className="h-10 shrink-0 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white"
                    >
                      Wirklich löschen
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Eintrag löschen"
                      onClick={() => setConfirmDeleteId(l.id)}
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100"
                    >
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        )}
      </div>

      <NewTypeSheet open={newTypeOpen} onClose={() => setNewTypeOpen(false)} onCreated={(t) => setSelectedId(t.id)} />
    </div>
  )
}
