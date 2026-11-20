import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clearLocalData, db } from '../db/db'
import { setCurrentUserId } from '../db/repo'
import { supabase } from '../lib/supabase'
import { runSync } from '../sync/engine'
import { supabaseSyncClient } from '../sync/supabaseClient'

type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

interface AuthState {
  status: AuthStatus
  userId: string | null
  email: string | null
  /** true, wenn die Sitzung nur aus dem lokalen Zwischenspeicher stammt (Start ohne Netz). */
  offlineSession: boolean
}

export interface AuthContextValue extends AuthState {
  /** Gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  signIn: (email: string, password: string) => Promise<string | null>
  /** Mit force = true wird auch abgemeldet, wenn noch nicht synchronisierte Änderungen existieren. */
  signOut: (force?: boolean) => Promise<{ ok: boolean; pending: number }>
}

const LAST_USER_KEY = 'trainingsapp:lastUser'

interface CachedUser {
  id: string
  email: string | null
}

function readCachedUser(): CachedUser | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY)
    return raw ? (JSON.parse(raw) as CachedUser) : null
  } catch {
    return null
  }
}

function writeCachedUser(user: CachedUser | null): void {
  try {
    if (user) localStorage.setItem(LAST_USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(LAST_USER_KEY)
  } catch {
    // Zwischenspeicher nicht verfügbar (z. B. privater Modus): App läuft trotzdem.
  }
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth braucht einen AuthProvider')
  return ctx
}

function friendlyError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-Mail oder Passwort stimmt nicht.'
  if (/email not confirmed/i.test(message)) return 'Die E-Mail-Adresse ist noch nicht bestätigt.'
  if (/failed to fetch|network|load failed/i.test(message)) return 'Keine Verbindung zum Server. Prüfe dein Netz und versuche es erneut.'
  if (/rate limit|too many/i.test(message)) return 'Zu viele Versuche. Warte kurz und versuche es erneut.'
  return `Anmeldung fehlgeschlagen: ${message}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', userId: null, email: null, offlineSession: false })

  const offlineRef = useRef(false)

  const applySession = useCallback((user: { id: string; email?: string | null } | null, offlineSession = false) => {
    offlineRef.current = offlineSession
    if (user) {
      writeCachedUser({ id: user.id, email: user.email ?? null })
      setCurrentUserId(user.id)
      setState({ status: 'signedIn', userId: user.id, email: user.email ?? null, offlineSession })
    } else {
      setCurrentUserId(null)
      setState({ status: 'signedOut', userId: null, email: null, offlineSession: false })
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        applySession(data.session.user)
        return
      }
      // Ohne Netz kann ein abgelaufenes Token nicht erneuert werden. Die App soll trotzdem offen bleiben.
      const cached = readCachedUser()
      if (cached && typeof navigator !== 'undefined' && navigator.onLine === false) {
        applySession({ id: cached.id, email: cached.email }, true)
        return
      }
      applySession(null)
    }
    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') applySession(null)
      else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        applySession(session.user)
      }
    })

    // Kommt das Netz zurück, wird eine Offline-Sitzung gegen den Server geprüft.
    const onOnline = () => {
      if (offlineRef.current) void init()
    }
    window.addEventListener('online', onOnline)

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
      window.removeEventListener('online', onOnline)
    }
  }, [applySession])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return friendlyError(error.message)
      if (data.user) applySession(data.user)
      return null
    } catch (e) {
      return friendlyError(e instanceof Error ? e.message : String(e))
    }
  }, [applySession])

  const signOut = useCallback(async (force = false) => {
    if (!force && state.userId) {
      await runSync(supabaseSyncClient, state.userId)
      const pending = await db.outbox.count()
      if (pending > 0) return { ok: false, pending }
    }
    await supabase.auth.signOut().catch(() => undefined)
    await clearLocalData()
    writeCachedUser(null)
    applySession(null)
    return { ok: true, pending: 0 }
  }, [applySession, state.userId])

  const value = useMemo<AuthContextValue>(() => ({ ...state, signIn, signOut }), [state, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
