import type { BodyView, MuscleId } from '../../types/muscles'

/**
 * Geometrie des Muskel-Männchens. Koordinatensystem 0…140 × 0…228, Mitte bei x = 70.
 * Silhouette: schlanke, glatte Außenkontur, oben am Hals offen, damit der Kopf ohne Trennlinie sitzt.
 */

export interface Shape {
  d: string
  transform?: string
}

/** Pfad eines abgerundeten Rechtecks. */
function rr(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} ` +
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
    `V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  )
}

export const HEAD = { cx: 70, cy: 23, rx: 10.5, ry: 13.5 } as const

export const BODY_OUTLINE =
  'M 65 36 L 65 42 C 55 44, 44 47, 39 54 C 35 60, 31 76, 26 95 C 23 105, 21 114, 22 119 ' +
  'C 23 123, 27 124, 29 120 C 33 112, 37 97, 41 82 L 45 68 C 47 82, 50 95, 52 106 ' +
  'C 50 118, 49 138, 50 162 C 51 184, 52 204, 53 216 C 54 221, 61 221, 62 216 ' +
  'C 64 198, 66 172, 68.5 138 C 69.2 133, 70.8 133, 71.5 138 C 74 172, 76 198, 78 216 ' +
  'C 79 221, 86 221, 87 216 C 88 204, 89 184, 90 162 C 91 138, 90 118, 88 106 ' +
  'C 90 95, 93 82, 95 68 L 99 82 C 103 97, 107 112, 111 120 C 113 124, 117 123, 118 119 ' +
  'C 119 114, 117 105, 114 95 C 109 76, 105 60, 101 54 C 96 47, 85 44, 75 42 L 75 36'

/** Sichtbarer Ausschnitt (schneidet leeren Rand ab). */
export const FIGURE_VIEWBOX = '16 6 108 220'
export const FIGURE_ASPECT = 108 / 220

const SHOULDERS: Shape[] = [
  { d: 'M 50 48 C 43 50, 39 56, 39 63 C 44 63, 48 58, 51 52 Z' },
  { d: 'M 90 48 C 97 50, 101 56, 101 63 C 96 63, 92 58, 89 52 Z' },
]

const ARMS: Shape[] = [
  { d: rr(34.5, 66, 6.5, 18, 3.25), transform: 'rotate(14 37.75 75)' },
  { d: rr(99, 66, 6.5, 18, 3.25), transform: 'rotate(-14 102.25 75)' },
]

export const FRONT_SHAPES: Partial<Record<MuscleId, Shape[]>> = {
  shoulders: SHOULDERS,
  chest: [
    { d: 'M 53 51 L 68.5 51 L 68.5 67 C 60 68, 52 66, 50 60 C 49 55, 51 52, 53 51 Z' },
    { d: 'M 87 51 L 71.5 51 L 71.5 67 C 80 68, 88 66, 90 60 C 91 55, 89 52, 87 51 Z' },
  ],
  biceps: ARMS,
  abs: [
    { d: rr(57.5, 71, 11, 8, 3) },
    { d: rr(71.5, 71, 11, 8, 3) },
    { d: rr(57.5, 81.5, 11, 8, 3) },
    { d: rr(71.5, 81.5, 11, 8, 3) },
    { d: 'M 57.5 92 L 68.5 92 L 68.5 103 C 62.5 103, 58.5 99, 57.5 92 Z' },
    { d: 'M 71.5 92 L 82.5 92 C 81.5 99, 77.5 103, 71.5 103 Z' },
  ],
  obliques: [
    { d: 'M 54.5 72 L 54.5 99 C 52 98, 50.5 93, 50 86 C 49.5 80, 51 75, 54.5 72 Z' },
    { d: 'M 85.5 72 L 85.5 99 C 88 98, 89.5 93, 90 86 C 90.5 80, 89 75, 85.5 72 Z' },
  ],
  quads: [
    { d: 'M 55 113 C 58.5 112, 61 115, 61 123 L 60 152 C 59 157, 55 157, 54 152 L 52.5 123 C 52.5 117, 53 114, 55 113 Z' },
    { d: 'M 85 113 C 81.5 112, 79 115, 79 123 L 80 152 C 81 157, 85 157, 86 152 L 87.5 123 C 87.5 117, 87 114, 85 113 Z' },
  ],
  adductors: [
    { d: 'M 63 118 C 65 118, 66 120, 66 124 L 66 146 C 66 149, 63 149, 62.8 146 L 62.5 124 C 62.5 120, 62.8 118, 63 118 Z' },
    { d: 'M 77 118 C 75 118, 74 120, 74 124 L 74 146 C 74 149, 77 149, 77.2 146 L 77.5 124 C 77.5 120, 77.2 118, 77 118 Z' },
  ],
}

export const BACK_SHAPES: Partial<Record<MuscleId, Shape[]>> = {
  shoulders: SHOULDERS,
  upper_back: [
    { d: 'M 64 43 L 76 43 L 82 51 L 70 59 L 58 51 Z' },
    { d: 'M 52 54 L 68.5 62 L 68.5 82 L 55 74 Z' },
    { d: 'M 88 54 L 71.5 62 L 71.5 82 L 85 74 Z' },
  ],
  triceps: ARMS,
  lower_back: [
    { d: 'M 56 78 L 68.5 85 L 68.5 96 L 57.5 96 Z' },
    { d: 'M 84 78 L 71.5 85 L 71.5 96 L 82.5 96 Z' },
  ],
  glutes: [{ d: rr(54.5, 100, 14, 16, 7) }, { d: rr(71.5, 100, 14, 16, 7) }],
  hamstrings: [
    { d: 'M 55 120 C 61 119, 66 122, 66 129 L 64 152 C 63 157, 56 157, 55 152 L 53 129 C 53 124, 53 121, 55 120 Z' },
    { d: 'M 85 120 C 79 119, 74 122, 74 129 L 76 152 C 77 157, 84 157, 85 152 L 87 129 C 87 124, 87 121, 85 120 Z' },
  ],
  calves: [{ d: rr(54, 168, 8.5, 34, 4.25) }, { d: rr(77.5, 168, 8.5, 34, 4.25) }],
}

export const SHAPES_BY_VIEW: Record<BodyView, Partial<Record<MuscleId, Shape[]>>> = {
  front: FRONT_SHAPES,
  back: BACK_SHAPES,
}
