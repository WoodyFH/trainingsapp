import type { KeyboardEvent } from 'react'
import { mixHex, pastel } from '../../lib/color'
import { MUSCLE_LABELS, MUSCLES, type BodyView, type MuscleId, type MuscleSize } from '../../types/muscles'
import { BODY_OUTLINE, FIGURE_ASPECT, FIGURE_VIEWBOX, HEAD, SHAPES_BY_VIEW } from './bodyShapes'

export const MUSCLE_INACTIVE = '#E5E5EA'
const OUTLINE = '#27272A'
const BODY_FILL = '#F8F8FA'

const SIZE_CONFIG: Record<MuscleSize, { height: number; stroke: number; labels: boolean; gap: string }> = {
  sm: { height: 56, stroke: 1.5, labels: false, gap: 'gap-1' },
  md: { height: 168, stroke: 2, labels: true, gap: 'gap-3' },
  lg: { height: 280, stroke: 2.5, labels: true, gap: 'gap-6' },
}

const VIEW_LABEL: Record<BodyView, { short: string; long: string }> = {
  front: { short: 'VORNE', long: 'Vorderansicht' },
  back: { short: 'HINTEN', long: 'Rückansicht' },
}

export interface MuscleBodySVGProps {
  primaryMuscles?: readonly MuscleId[]
  secondaryMuscles?: readonly MuscleId[]
  /** Akzentfarbe für primäre Muskeln (der Pastellton wird daraus berechnet). */
  accentColor?: string
  /** Muskel → 0…1. Hat Vorrang vor primär/sekundär und interpoliert zwischen Grau und Akzentfarbe. */
  intensity?: Partial<Record<MuscleId, number>>
  /** Macht die Zonen antippbar und per Tastatur erreichbar. */
  onMuscleClick?: (muscle: MuscleId) => void
  /** Meldet den Auswahlzustand an Screenreader (aria-pressed), z. B. im Übungseditor. */
  selectable?: boolean
  size?: MuscleSize
  views?: 'both' | BodyView
  /** Überschreibt die Standard-Beschriftung VORNE / HINTEN (Standard: ab Größe md). */
  showLabels?: boolean
  className?: string
  ariaLabel?: string
}

function describe(muscles: readonly MuscleId[]): string {
  return muscles.map((m) => MUSCLE_LABELS[m]).join(', ')
}

export function MuscleBodySVG({
  primaryMuscles = [],
  secondaryMuscles = [],
  accentColor = '#F04E5E',
  intensity,
  onMuscleClick,
  selectable = false,
  size = 'md',
  views = 'both',
  showLabels,
  className = '',
  ariaLabel,
}: MuscleBodySVGProps) {
  const cfg = SIZE_CONFIG[size]
  const interactive = Boolean(onMuscleClick)
  const labelsOn = showLabels ?? cfg.labels
  const secondaryColor = pastel(accentColor, 0.28)
  const shownViews: BodyView[] = views === 'both' ? ['front', 'back'] : [views]

  const stateOf = (id: MuscleId): 'primary' | 'secondary' | 'inactive' =>
    primaryMuscles.includes(id) ? 'primary' : secondaryMuscles.includes(id) ? 'secondary' : 'inactive'

  const fillFor = (id: MuscleId): string => {
    const level = intensity?.[id]
    if (level !== undefined) return mixHex(MUSCLE_INACTIVE, accentColor, level)
    const s = stateOf(id)
    return s === 'primary' ? accentColor : s === 'secondary' ? secondaryColor : MUSCLE_INACTIVE
  }

  const summary =
    ariaLabel ??
    [
      'Muskel-Übersicht',
      primaryMuscles.length ? `Primär: ${describe(primaryMuscles)}` : '',
      secondaryMuscles.length ? `Sekundär: ${describe(secondaryMuscles)}` : '',
    ]
      .filter(Boolean)
      .join('. ')

  const onKey = (e: KeyboardEvent, id: MuscleId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onMuscleClick?.(id)
    }
  }

  return (
    <div
      className={`inline-flex items-start justify-center ${cfg.gap} ${className}`}
      role={interactive ? 'group' : 'img'}
      aria-label={summary}
    >
      {shownViews.map((view) => {
        const shapes = SHAPES_BY_VIEW[view]
        return (
          <figure key={view} className="m-0 flex flex-col items-center">
            <svg
              viewBox={FIGURE_VIEWBOX}
              height={cfg.height}
              width={Math.round(cfg.height * FIGURE_ASPECT)}
              className="muscle-body block select-none"
              focusable="false"
              aria-hidden={interactive ? undefined : true}
              aria-label={interactive ? VIEW_LABEL[view].long : undefined}
              role={interactive ? 'group' : undefined}
            >
              <ellipse
                cx={HEAD.cx}
                cy={HEAD.cy}
                rx={HEAD.rx}
                ry={HEAD.ry}
                fill={BODY_FILL}
                stroke={OUTLINE}
                strokeWidth={cfg.stroke}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={BODY_OUTLINE}
                fill={BODY_FILL}
                stroke={OUTLINE}
                strokeWidth={cfg.stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {MUSCLES.filter((m) => m.views.includes(view)).map((m) => {
                const parts = shapes[m.id]
                if (!parts) return null
                const s = stateOf(m.id)
                const stateText = s === 'primary' ? 'primär' : s === 'secondary' ? 'sekundär' : 'nicht ausgewählt'
                return (
                  <g
                    key={m.id}
                    className={interactive ? 'muscle muscle-interactive' : 'muscle'}
                    fill={fillFor(m.id)}
                    data-muscle={m.id}
                    {...(interactive
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          'aria-label': `${m.label}, ${stateText}`,
                          'aria-pressed': selectable ? s !== 'inactive' : undefined,
                          onClick: () => onMuscleClick?.(m.id),
                          onKeyDown: (e: KeyboardEvent) => onKey(e, m.id),
                        }
                      : {})}
                  >
                    {parts.map((p, i) => (
                      <path key={i} d={p.d} transform={p.transform} />
                    ))}
                    {interactive &&
                      parts.map((p, i) => (
                        <path
                          key={`hit-${i}`}
                          d={p.d}
                          transform={p.transform}
                          fill="transparent"
                          stroke="transparent"
                          strokeWidth={6}
                          strokeLinejoin="round"
                        />
                      ))}
                  </g>
                )
              })}
            </svg>
            {labelsOn && (
              <figcaption className="mt-1 text-[11px] font-medium tracking-widest text-zinc-400">
                {VIEW_LABEL[view].short}
              </figcaption>
            )}
          </figure>
        )
      })}
    </div>
  )
}
