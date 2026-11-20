/** Clientseitig erzeugte UUID v4 (Offline-First: IDs entstehen auf dem Gerät). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback für sehr alte Browser ohne randomUUID (nicht für Kryptografie gedacht).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * Deterministische UUID aus einem Text (FNV-1a-ähnlicher 128-Bit-Hash).
 * Für Startdaten: Zwei Geräte, die beim ersten Start dieselben Übungen anlegen,
 * erzeugen dieselben IDs und damit keine Duplikate.
 */
export function stableId(input: string): string {
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b1, 0x85ebca6b]
  const parts = seeds.map((seed, i) => {
    let h = seed >>> 0
    for (let k = 0; k < input.length; k++) {
      h ^= input.charCodeAt(k) + i
      h = Math.imul(h, 0x01000193) >>> 0
      h ^= h >>> 15
    }
    return h >>> 0
  })
  const hex = parts.map((p) => p.toString(16).padStart(8, '0')).join('')
  // Version 4 und Variante 10xx setzen, damit das Ergebnis eine gültige UUID ist.
  const v = '4' + hex.slice(13, 16)
  const variant = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${v}-${variant}-${hex.slice(20, 32)}`
}
