/** Kleiner Ereignisverteiler: Das Repo meldet lokale Änderungen, die Sync-Engine hört zu. */

type Listener = () => void

const listeners = new Set<Listener>()

export function onLocalChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyLocalChange(): void {
  for (const l of listeners) l()
}
