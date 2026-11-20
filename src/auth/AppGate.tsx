import { CloudOff, LoaderCircle, LogOut, RefreshCw } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { AppLogo } from '../components/ui/AppLogo'
import { getMeta } from '../db/db'
import { setCurrentUserId } from '../db/repo'
import { ensureLocalUser } from '../db/session'
import { LoginPage } from '../pages/LoginPage'
import { ensureSeeded } from '../seed/seed'
import { INITIAL_PULL_META, runSync, startSyncLoop } from '../sync/engine'
import { syncStatus, useSyncSnapshot } from '../sync/status'
import { supabaseSyncClient } from '../sync/supabaseClient'
import { useAuth } from './AuthProvider'

function Splash({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <AppLogo size={64} />
      {children ?? <LoaderCircle className="size-6 animate-spin text-zinc-400" aria-label="Lädt" />}
    </div>
  )
}

/**
 * Meldet an, bereitet die lokale Datenbank vor und startet die Synchronisation.
 * Die App ist erst nutzbar, wenn mindestens einmal erfolgreich mit dem Server abgeglichen wurde
 * (danach funktioniert alles auch offline).
 */
function DataBoot({ userId, children }: { userId: string; children: ReactNode }) {
  const { signOut } = useAuth()
  const snap = useSyncSnapshot()
  const [phase, setPhase] = useState<'booting' | 'ready' | 'needs-connection'>('booting')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let stop: (() => void) | undefined

    void (async () => {
      setPhase('booting')
      await ensureLocalUser(userId)
      setCurrentUserId(userId)
      const alreadyPulled = (await getMeta<string>(INITIAL_PULL_META)) === userId
      syncStatus.set({ initialPullDone: alreadyPulled })

      const result = await runSync(supabaseSyncClient, userId)
      if (cancelled) return
      if (result.ok || alreadyPulled) {
        await ensureSeeded(userId)
        if (cancelled) return
        setPhase('ready')
        stop = startSyncLoop(supabaseSyncClient, userId)
      } else {
        setPhase('needs-connection')
      }
    })()

    return () => {
      cancelled = true
      stop?.()
    }
  }, [userId, attempt])

  if (phase === 'ready') return <>{children}</>
  if (phase === 'booting') return <Splash />

  return (
    <Splash>
      <div className="flex max-w-xs flex-col items-center gap-4">
        <CloudOff className="size-8 text-zinc-400" aria-hidden />
        <h1 className="m-0 text-xl font-bold text-ink">Erste Synchronisation nötig</h1>
        <p className="m-0 text-sm leading-relaxed text-zinc-500">
          Beim ersten Start muss die App einmal mit dem Server verbunden sein. Danach funktioniert sie auch ohne Netz.
        </p>
        {snap.error && (
          <div className="flex flex-col gap-1 rounded-2xl bg-red-50 p-3 text-xs text-red-700">
            <span>{snap.error}</span>
            {/permission denied/i.test(snap.error) && (
              <span className="text-red-600/80">
                Die Datenbank-Berechtigungen fehlen. Führe supabase/migrations/002_gym_grants.sql im SQL-Editor aus.
              </span>
            )}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="flex h-11 items-center gap-2 whitespace-nowrap rounded-2xl bg-zinc-900 px-5 text-sm font-semibold text-white"
          >
            <RefreshCw className="size-4" aria-hidden />
            Erneut versuchen
          </button>
          <button
            type="button"
            onClick={() => void signOut(true)}
            className="flex h-11 items-center gap-2 whitespace-nowrap rounded-2xl bg-white px-5 text-sm font-semibold text-zinc-600 shadow-sm"
          >
            <LogOut className="size-4" aria-hidden />
            Abmelden
          </button>
        </div>
      </div>
    </Splash>
  )
}

export function AppGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth.status === 'loading') return <Splash />
  if (auth.status === 'signedOut' || !auth.userId) return <LoginPage />
  return <DataBoot userId={auth.userId}>{children}</DataBoot>
}
