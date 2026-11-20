import {
  Activity,
  Bike,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  Heart,
  HeartPulse,
  Mountain,
  PersonStanding,
  Ship,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/** Icons, die in Trainings und Cardio-Arten gespeichert werden (als lucide-Name). */
export const ICONS: Record<string, LucideIcon> = {
  Activity,
  Bike,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  Heart,
  HeartPulse,
  Mountain,
  PersonStanding,
  Ship,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Waves,
  Wind,
  Zap,
}

export const ICON_NAMES = Object.keys(ICONS)

/** Icon zu einem gespeicherten Namen; unbekannte Namen fallen auf Activity zurück. */
export function getIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Activity
}
