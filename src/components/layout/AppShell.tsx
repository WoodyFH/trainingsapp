import { ChevronLeft, Settings } from 'lucide-react'
import { Link, Outlet, matchPath, useLocation } from 'react-router-dom'
import { useSyncIndicator } from '../../sync/status'
import { APP_NAME } from '../ui/AppLogo'
import { BottomPill, SideRail } from './Navigation'
import { SyncStatus } from './SyncStatus'

interface RouteMeta {
  pattern: string
  title: string | ((params: Record<string, string | undefined>) => string)
  /** Ziel des Zurück-Pfeils; ohne Angabe gibt es keinen. */
  back?: string
}

const ROUTES: RouteMeta[] = [
  { pattern: '/', title: 'Training' },
  { pattern: '/training/:templateId', title: 'Training', back: '/' },
  { pattern: '/frei', title: 'Freitraining', back: '/' },
  { pattern: '/cardio', title: 'Cardio', back: '/' },
  { pattern: '/plaene', title: 'Pläne' },
  { pattern: '/plaene/uebungen', title: 'Übungen' },
  { pattern: '/plaene/training/:id', title: 'Training bearbeiten', back: '/plaene' },
  {
    pattern: '/plaene/uebung/:id',
    title: (p) => (p.id === 'neu' ? 'Neue Übung' : 'Übung bearbeiten'),
    back: '/plaene/uebungen',
  },
  { pattern: '/statistik', title: 'Statistik' },
  { pattern: '/statistik/uebungen', title: 'Statistik' },
  { pattern: '/statistik/cardio', title: 'Statistik' },
  { pattern: '/statistik/verlauf', title: 'Statistik' },
  { pattern: '/statistik/uebung/:id', title: 'Übung', back: '/statistik/uebungen' },
  { pattern: '/statistik/einheit/:id', title: 'Einheit', back: '/statistik/verlauf' },
  { pattern: '/einstellungen', title: 'Einstellungen', back: '/' },
  { pattern: '/einstellungen/import', title: 'Excel importieren', back: '/einstellungen' },
  { pattern: '/design', title: 'Design-System', back: '/' },
]

function metaFor(pathname: string): { title: string; back?: string } {
  for (const route of ROUTES) {
    const match = matchPath({ path: route.pattern, end: true }, pathname)
    if (match) {
      const title = typeof route.title === 'function' ? route.title(match.params) : route.title
      return { title, back: route.back }
    }
  }
  return { title: APP_NAME }
}

export function AppShell() {
  const { pathname } = useLocation()
  const sync = useSyncIndicator()
  const { title, back } = metaFor(pathname)

  return (
    <div className="min-h-dvh bg-canvas">
      <SideRail />
      <div className="lg:pl-24">
        <div className="mx-auto w-full max-w-md px-4 pb-32 lg:max-w-5xl lg:px-10 lg:pb-16">
          <header className="flex items-center justify-between gap-3 pb-4 pt-[max(env(safe-area-inset-top),1rem)] lg:pt-8">
            <div className="flex min-w-0 items-center gap-2">
              {back && (
                <Link
                  to={back}
                  aria-label="Zurück"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </Link>
              )}
              <h1 className="m-0 truncate text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <SyncStatus state={sync.state} pendingCount={sync.pendingCount} />
              <Link
                to="/einstellungen"
                aria-label="Einstellungen"
                className="flex size-11 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50"
              >
                <Settings className="size-5" aria-hidden />
              </Link>
            </div>
          </header>
          <main>
            <Outlet />
          </main>
        </div>
      </div>
      <BottomPill />
    </div>
  )
}
