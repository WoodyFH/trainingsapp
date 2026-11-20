/** Farben pro Trainingsart (Design-System, Abschnitt 6.1). */
export const TRAINING_COLORS = {
  training1: '#F04E5E', // Koralle
  training2: '#3B82F6', // Kobaltblau
  training3: '#84CC16', // Limettengrün
  cardio: '#8B5CF6', // Violett
  free: '#F59E0B', // Bernstein
} as const

export type TrainingColorKey = keyof typeof TRAINING_COLORS

export const TRAINING_COLOR_LABELS: Record<TrainingColorKey, string> = {
  training1: 'Training 1',
  training2: 'Training 2',
  training3: 'Training 3',
  cardio: 'Cardio',
  free: 'Freitraining',
}
