import { Dumbbell } from 'lucide-react'

export const APP_NAME = 'Trainings-App'

interface AppLogoProps {
  /** Kantenlänge der Kachel in Pixeln. */
  size?: number
  className?: string
}

/** App-Symbol: Hantel auf koralle Kachel (passend zum PWA-Icon). */
export function AppLogo({ size = 48, className = '' }: AppLogoProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-t1 text-white ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      aria-hidden
    >
      <Dumbbell style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.4} />
    </div>
  )
}
