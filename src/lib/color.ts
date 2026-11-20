/** Kleine Farbhelfer ohne Abhängigkeiten (Hex ⇄ RGB, Mischen). */

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = Number.parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [0, 0, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase()
}

/** Mischt `from` und `to`; t = 0 ergibt `from`, t = 1 ergibt `to`. */
export function mixHex(from: string, to: string, t: number): string {
  const k = Math.min(1, Math.max(0, t))
  const [r1, g1, b1] = hexToRgb(from)
  const [r2, g2, b2] = hexToRgb(to)
  return rgbToHex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k)
}

/** Pastellton einer Akzentfarbe (Anteil der Akzentfarbe auf Weiß). */
export function pastel(accent: string, amount = 0.2): string {
  return mixHex('#FFFFFF', accent, amount)
}

/** Akzentfarbe mit Deckkraft als rgba-String (z. B. für Icon-Hintergründe). */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
