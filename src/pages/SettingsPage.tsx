import { ChevronRight, LogOut, Palette, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { DataSection } from '../components/settings/DataSection'
import { Stepper } from '../components/ui/Stepper'
import { useBodyweight } from '../data/queries'
import { setBodyweight } from '../data/settings'
import { runSync } from '../sync/engine'
import { useSyncIndicator } from '../sync/status'
import { supabaseSyncClient } from '../sync/supabaseClient'

const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'medium' })

const STATE_TEXT = {
  synced: 'Alles synchron',
  pending: 'Änderungen warten auf den Upload',
  offline: 'Offline, Änderungen werden später übertragen',
  error: 'Synchronisation fehlgeschlagen',
} as const

function SectionTitle({ children }: { children: string }) {
  return <h2 className="label-caps m-0 px-1">{children}</h2>
}

export function SettingsPage() {
  const { email, userId, signOut } = useAuth()
  const { state, pendingCount, snapshot } = useSyncIndicator()
  const bodyweight = useBodyweight(userId)
  const [syncing, setSyncing] = useState(false)
  const [signOutMessage, setSignOutMessage] = useState<string | null>(null)

  const syncNow = async () => {
    if (!userId) return
    setSyncing(true)
    await runSync(supabaseSyncClient, userId)
    setSyncing(false)
  }

  const logout = async () => {
    setSignOutMessage(null)
    const res = await signOut(false)
    if (!res.ok) {
      setSignOutMessage(
        `${res.pending} Änderung${res.pending === 1 ? '' : 'en'} konnte${res.pending === 1 ? '' : 'n'} noch nicht synchronisiert werden. Beim Abmelden gehen sie verloren.`,
      )
    }
  }

  return (
    <div className="flex flex-col gap-5 lg:max-w-xl">
      <div className="flex flex-col gap-3">
        <SectionTitle>Konto und Synchronisation</SectionTitle>
        <section className="card divide-y divide-line">
          <div className="flex items-center justify-between gap-3 px-5 py-4 text-sm">
            <span className="text-zinc-500">Konto</span>
            <span className="truncate font-semibold text-ink">{email ?? '–'}</span>
          </div>
          <div className="flex flex-col gap-1 px-5 py-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-500">Synchronisation</span>
              <span className="text-right font-semibold text-ink">
                {STATE_TEXT[state]}
                {state === 'pending' ? ` (${pendingCount})` : ''}
              </span>
            </div>
            {snapshot.lastSyncAt && (
              <span className="text-xs text-zinc-400">Zuletzt: {dateTime.format(new Date(snapshot.lastSyncAt))}</span>
            )}
            {snapshot.error && <span className="text-xs text-red-600">{snapshot.error}</span>}
          </div>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncing}
            className="flex w-full items-center gap-3 px-5 py-4 text-left disabled:opacity-60"
          >
            <RefreshCw className={`size-5 text-zinc-400 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
            <span className="font-semibold text-ink">Jetzt synchronisieren</span>
          </button>
        </section>
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle>Körpergewicht</SectionTitle>
        <section className="card flex flex-col gap-3 p-5">
          <Stepper
            label="Körpergewicht"
            value={bodyweight}
            onChange={(kg) => userId && void setBodyweight(userId, kg)}
            step={0.5}
            min={30}
            max={250}
            unit="kg"
          />
          <p className="m-0 text-xs leading-relaxed text-zinc-500">
            Wird nur für das Volumen von Übungen mit Gegengewicht (Klimmzüge, Dips) verwendet: Sätze × Wdh × (Körpergewicht
            − Gegengewicht).
          </p>
        </section>
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle>Daten</SectionTitle>
        <DataSection userId={userId} />
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle>App</SectionTitle>
        <section className="card divide-y divide-line">
          <Link to="/design" className="flex items-center justify-between gap-3 px-5 py-4">
            <span className="flex items-center gap-3 font-semibold text-ink">
              <Palette className="size-5 text-zinc-400" aria-hidden />
              Design-System
            </span>
            <ChevronRight className="size-5 text-zinc-300" aria-hidden />
          </Link>
          <div className="flex items-center justify-between gap-3 px-5 py-4 text-sm">
            <span className="text-zinc-500">App-Version</span>
            <span className="font-semibold tabular-nums text-ink">{__APP_VERSION__}</span>
          </div>
        </section>
      </div>

      <section className="card">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 px-5 py-4 text-left font-semibold text-red-600"
        >
          <LogOut className="size-5" aria-hidden />
          Abmelden
        </button>
        {signOutMessage && (
          <div className="flex flex-col gap-3 border-t border-line px-5 py-4 text-sm text-zinc-600">
            <p className="m-0">{signOutMessage}</p>
            <button
              type="button"
              onClick={() => void signOut(true)}
              className="h-11 self-start rounded-2xl bg-red-600 px-5 font-semibold text-white"
            >
              Trotzdem abmelden
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
