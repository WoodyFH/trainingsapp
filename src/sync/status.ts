import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import type { SyncState } from '../components/layout/SyncStatus'
import { db } from '../db/db'

export type SyncPhase = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncSnapshot {
  phase: SyncPhase
  error: string | null
  lastSyncAt: string | null
  /** true, sobald der erste vollständige Abgleich mit dem Server gelungen ist. */
  initialPullDone: boolean
}

let snapshot: SyncSnapshot = { phase: 'idle', error: null, lastSyncAt: null, initialPullDone: false }
const listeners = new Set<() => void>()

export const syncStatus = {
  get: (): SyncSnapshot => snapshot,
  set(partial: Partial<SyncSnapshot>): void {
    snapshot = { ...snapshot, ...partial }
    for (const l of listeners) l()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useSyncSnapshot(): SyncSnapshot {
  return useSyncExternalStore(syncStatus.subscribe, syncStatus.get, syncStatus.get)
}

/** Zustand für das Wolken-Symbol im Header. */
export function useSyncIndicator(): { state: SyncState; pendingCount: number; snapshot: SyncSnapshot } {
  const snap = useSyncSnapshot()
  const pendingCount = useLiveQuery(() => db.outbox.count(), [], 0) ?? 0
  let state: SyncState = 'synced'
  if (snap.phase === 'offline') state = 'offline'
  else if (snap.phase === 'error') state = 'error'
  else if (pendingCount > 0) state = 'pending'
  return { state, pendingCount, snapshot: snap }
}
