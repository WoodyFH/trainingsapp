import { Eye, EyeOff, LogIn, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { AppLogo, APP_NAME } from '../components/ui/AppLogo'
import { supabaseConfigured, supabaseKeyIsSecret } from '../lib/supabase'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Bitte E-Mail und Passwort eingeben.')
      return
    }
    setBusy(true)
    setError(null)
    const message = await signIn(email, password)
    if (message) setError(message)
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 pb-safe pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <AppLogo size={64} className="shadow-lg shadow-t1/30" />
          <h1 className="m-0 text-3xl font-extrabold tracking-tight text-ink">{APP_NAME}</h1>
          <p className="m-0 text-sm text-zinc-500">Melde dich mit deinem Konto an.</p>
        </div>

        <form onSubmit={submit} className="card flex flex-col gap-4 p-6" noValidate>
          {!supabaseConfigured && (
            <p
              role="alert"
              className="m-0 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {supabaseKeyIsSecret
                ? 'Der hinterlegte Schlüssel ist ein geheimer Schlüssel und wird nicht verwendet. Trage in VITE_SUPABASE_ANON_KEY den Publishable-Key ein.'
                : 'Supabase ist nicht konfiguriert. Setze VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY.'}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="label-caps">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-2xl bg-zinc-100 px-4 text-ink outline-none ring-0 transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="label-caps">
              Passwort
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-2xl bg-zinc-100 pl-4 pr-12 text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-zinc-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-zinc-400"
              >
                {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="m-0 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !supabaseConfigured}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            <LogIn className="size-5" aria-hidden />
            {busy ? 'Anmelden …' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
