import { useCallback, useEffect, useState } from 'react'

/**
 * Kleiner Zwischenspeicher im Browser (localStorage) für Dinge, die noch nicht in der Datenbank stehen,
 * z. B. "heute zusätzlich gewählte Übungen". Fällt ohne Speicher (privater Modus) auf reinen Zustand zurück.
 */
export function useDraft<T>(key: string, initial: T): [T, (update: T | ((prev: T) => T)) => void] {
  const read = useCallback((): T => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? ({ ...initial, ...(JSON.parse(raw) as object) } as T) : initial
    } catch {
      return initial
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const [value, setValue] = useState<T>(read)

  useEffect(() => {
    setValue(read())
  }, [read])

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // Speicher nicht verfügbar: Zustand bleibt nur im Speicher.
        }
        return resolved
      })
    },
    [key],
  )

  return [value, update]
}
