export type SyncState = 'synced' | 'pending' | 'offline' | 'error'

interface SyncStatusProps {
  state?: SyncState
  /** Anzahl ausstehender Änderungen (nur bei state = 'pending'). */
  pendingCount?: number
}

const CONFIG = {
  synced: { color: 'bg-emerald-500', label: 'Synchron' },
  pending: { color: 'bg-amber-500', label: 'Ausstehend' },
  offline: { color: 'bg-zinc-400', label: 'Offline' },
  error: { color: 'bg-red-500', label: 'Synchronisation fehlgeschlagen' },
} as const

/** Kleiner Status-Punkt im Header: grün = synchron, gelb = ausstehend, grau = offline, rot = Fehler. */
export function SyncStatus({ state = 'synced', pendingCount = 0 }: SyncStatusProps) {
  const { color, label } = CONFIG[state]
  const text = state === 'pending' && pendingCount > 0 ? `${label} (${pendingCount})` : label
  return (
    <span
      className="flex size-5 items-center justify-center"
      role="status"
      aria-label={`Sync-Status: ${text}`}
      title={text}
    >
      <span className={`size-2.5 rounded-full ${color}`} aria-hidden />
    </span>
  )
}
