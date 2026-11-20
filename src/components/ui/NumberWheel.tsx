import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

const ITEM_HEIGHT = 48
const VISIBLE_ROWS = 5

const round = (v: number) => Math.round(v * 100) / 100

/** Alle wählbaren Werte von min bis max; ein abweichender aktueller Wert (z. B. 7,3 bei Schritt 2,5) wird einsortiert. */
export function wheelValues(min: number, max: number, step: number, current: number): number[] {
  const count = Math.max(0, Math.floor((max - min) / step + 1e-9))
  const values: number[] = []
  for (let i = 0; i <= count; i++) values.push(round(min + i * step))
  if (!values.includes(current) && current >= min) {
    values.push(current)
    values.sort((a, b) => a - b)
  }
  return values
}

function nearestIndex(values: number[], value: number): number {
  let best = 0
  for (let i = 1; i < values.length; i++) {
    if (Math.abs((values[i] as number) - value) < Math.abs((values[best] as number) - value)) best = i
  }
  return best
}

interface NumberWheelProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  unit?: string
  format: (v: number) => string
}

/** Scrollbare Zahlenauswahl (Walze): Wert zur Mitte scrollen, er rastet ein und wird sofort übernommen. */
export function NumberWheel({ label, value, onChange, min, max, step, unit, format }: NumberWheelProps) {
  // Die Liste wird nur einmal beim Öffnen gebaut, damit sie sich beim Scrollen nicht verschiebt.
  const [values] = useState(() => wheelValues(min, max, step, value))
  const listRef = useRef<HTMLDivElement>(null)
  const index = nearestIndex(values, value)
  const indexRef = useRef(index)

  // Von außen geänderte Werte (Tastatur, Knöpfe) in die Walze übernehmen, ohne die eigene Bewegung zu stören.
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const shown = Math.round(el.scrollTop / ITEM_HEIGHT)
    indexRef.current = index
    if (shown !== index) el.scrollTop = index * ITEM_HEIGHT
  }, [index])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)))
    if (i !== indexRef.current) {
      indexRef.current = i
      onChange(values[i] as number)
    }
  }

  const goTo = (i: number) => {
    const next = Math.min(values.length - 1, Math.max(0, i))
    listRef.current?.scrollTo({ top: next * ITEM_HEIGHT, behavior: 'smooth' })
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      goTo(index + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      goTo(index - 1)
    }
  }

  const pad = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT

  return (
    <div className="relative mx-auto w-full max-w-xs" style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}>
      <div
        className="pointer-events-none absolute inset-x-0 rounded-2xl bg-zinc-100"
        style={{ top: pad, height: ITEM_HEIGHT }}
        aria-hidden
      />
      <div
        ref={listRef}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={values[values.length - 1]}
        aria-valuetext={`${format(value)}${unit ? ` ${unit}` : ''}`}
        onScroll={onScroll}
        onKeyDown={onKey}
        className="relative h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain outline-none [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-zinc-300 [&::-webkit-scrollbar]:hidden"
        style={{
          paddingTop: pad,
          paddingBottom: pad,
          maskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)',
        }}
      >
        {values.map((v, i) => (
          <button
            key={v}
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => goTo(i)}
            className={`flex w-full snap-center items-center justify-center gap-1.5 tabular-nums transition-colors ${
              i === index ? 'text-3xl font-bold text-ink' : 'text-xl font-medium text-zinc-400'
            }`}
            style={{ height: ITEM_HEIGHT }}
          >
            {format(v)}
            {i === index && unit && <span className="text-base font-medium text-zinc-400">{unit}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
