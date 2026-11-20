/** Zentrale Muskel-Definition (Abschnitt 6.2). Die IDs sind Teil des Datenmodells. */

export const MUSCLE_IDS = [
  'shoulders',
  'chest',
  'biceps',
  'abs',
  'obliques',
  'quads',
  'adductors',
  'upper_back',
  'triceps',
  'lower_back',
  'glutes',
  'hamstrings',
  'calves',
] as const

export type MuscleId = (typeof MUSCLE_IDS)[number]

export type BodyView = 'front' | 'back'

export interface MuscleInfo {
  id: MuscleId
  label: string
  views: readonly BodyView[]
}

export const MUSCLES: readonly MuscleInfo[] = [
  { id: 'shoulders', label: 'Schultern', views: ['front', 'back'] },
  { id: 'chest', label: 'Brust', views: ['front'] },
  { id: 'biceps', label: 'Bizeps', views: ['front'] },
  { id: 'abs', label: 'Bauch', views: ['front'] },
  { id: 'obliques', label: 'Seitliche Bauchmuskeln', views: ['front'] },
  { id: 'quads', label: 'Oberschenkel vorne', views: ['front'] },
  { id: 'adductors', label: 'Oberschenkel innen', views: ['front'] },
  { id: 'upper_back', label: 'Oberer Rücken & Latissimus', views: ['back'] },
  { id: 'triceps', label: 'Trizeps', views: ['back'] },
  { id: 'lower_back', label: 'Unterer Rücken', views: ['back'] },
  { id: 'glutes', label: 'Gesäß', views: ['back'] },
  { id: 'hamstrings', label: 'Beinbeuger', views: ['back'] },
  { id: 'calves', label: 'Waden', views: ['back'] },
]

export const MUSCLE_LABELS = Object.fromEntries(MUSCLES.map((m) => [m.id, m.label])) as Record<MuscleId, string>

export type MuscleSize = 'sm' | 'md' | 'lg'
