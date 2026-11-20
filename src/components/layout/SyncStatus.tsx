import { Cloud, CloudAlert, CloudOff, CloudUpload } from 'lucide-react'

export type SyncState = 'synced' | 'pending' | 'offline' | 'error'

interface SyncStatusProps {
  state?: SyncState
  /** Anzahl ausstehender Änderungen (nur bei state = 'pending'). */
  pendingCount?: number
}

const CONFIG = {
  synced: { Icon: Cloud, color: 'text-emerald-500', label: 'Synchron' },
  pending: { Icon: CloudUpload, color: 'text-amber-500', label: 'Ausstehend' },
  offline: { Icon: CloudOff, color: 'text-zinc-400', label: 'Offline' },
  error: { Icon: CloudAlert, color: 'text-red-500', label: 'Synchronisation fehlgeschlagen' },
} as const

/** Kleines Wolken-Symbol im Header. Die echte Sync-Engine folgt in Phase 2. */
export function SyncStatus({ state = 'synced', pendingCount = 0 }: SyncStatusProps) {
  const { Icon, color, label } = CONFIG[state]
  const text = state === 'pending' && pendingCount > 0 ? `${label} (${pendingCount})` : label
  return (
    <span
      className="relative flex size-11 items-center justify-center rounded-full bg-white shadow-sm"
      role="status"
      aria-label={`Sync-Status: ${text}`}
      title={text}
    >
      <Icon className={`size-5 ${color}`} strokeWidth={2} aria-hidden />
      {state === 'pending' && pendingCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold leading-5 text-white">
          {pendingCount}
        </span>
      )}
    </span>
  )
}
