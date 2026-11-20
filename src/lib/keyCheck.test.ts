import { describe, expect, it } from 'vitest'
import { isSecretKey } from './keyCheck'

const jwt = (role: string) => `x.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.y`

describe('isSecretKey', () => {
  it('erkennt geheime Schlüssel', () => {
    expect(isSecretKey('sb_secret_abc123')).toBe(true)
    expect(isSecretKey(jwt('service_role'))).toBe(true)
  })

  it('lässt öffentliche Schlüssel zu', () => {
    expect(isSecretKey('sb_publishable_abc123')).toBe(false)
    expect(isSecretKey(jwt('anon'))).toBe(false)
    expect(isSecretKey('')).toBe(false)
    expect(isSecretKey(undefined)).toBe(false)
    expect(isSecretKey('kein-schluessel')).toBe(false)
  })
})
