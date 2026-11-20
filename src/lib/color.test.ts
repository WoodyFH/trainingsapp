import { describe, expect, it } from 'vitest'
import { hexToRgb, mixHex, pastel, rgbToHex } from './color'

describe('color', () => {
  it('wandelt Hex in RGB und zurück', () => {
    expect(hexToRgb('#F04E5E')).toEqual([240, 78, 94])
    expect(hexToRgb('#fff')).toEqual([255, 255, 255])
    expect(rgbToHex(240, 78, 94)).toBe('#F04E5E')
  })

  it('mischt linear und begrenzt t auf 0…1', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000')
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF')
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080')
    expect(mixHex('#000000', '#FFFFFF', 7)).toBe('#FFFFFF')
    expect(mixHex('#000000', '#FFFFFF', -3)).toBe('#000000')
  })

  it('erzeugt einen helleren Pastellton', () => {
    expect(pastel('#000000', 0.2)).toBe('#CCCCCC')
  })
})
