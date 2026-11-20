import type { DistanceUnit } from '../types/db'
import { formatNumber } from './date'

/** Beschriftung des Distanzfelds: bei Etagen "Etagen", sonst "Distanz". */
export function distanceLabel(unit: DistanceUnit | undefined): string {
  return unit === 'floors' ? 'Etagen' : 'Distanz'
}

/** Einheit neben dem Eingabefeld (bei Etagen leer, die Beschriftung sagt es schon). */
export function distanceFieldUnit(unit: DistanceUnit | undefined): string {
  return unit === 'floors' ? '' : (unit ?? 'km')
}

/** Wert mit Einheit für Listen, z. B. "5,2 km", "1.500 m" oder "40 Etagen". */
export function formatDistance(value: number, unit: DistanceUnit | undefined): string {
  if (unit === 'floors') return `${formatNumber(value, 0)} Etagen`
  return `${formatNumber(value, 2)} ${unit ?? 'km'}`
}
