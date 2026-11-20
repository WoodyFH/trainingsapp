import { Dumbbell, ListChecks, TrendingUp, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { AppLogo } from '../ui/AppLogo'

interface NavItem {
  to: string
  label: string
  Icon: LucideIcon
  end?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Training', Icon: Dumbbell, end: true },
  { to: '/plaene', label: 'Pläne', Icon: ListChecks },
  { to: '/statistik', label: 'Statistik', Icon: TrendingUp },
]

/** Schwebende Pill am unteren Rand (Handy). */
export function BottomPill() {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 lg:hidden"
    >
      <ul className="pointer-events-auto m-0 flex list-none items-center gap-1 rounded-full bg-white/90 p-1.5 shadow-lg shadow-zinc-900/10 ring-1 ring-black/5 backdrop-blur">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-5" aria-hidden />
                  {isActive ? <span>{label}</span> : <span className="sr-only">{label}</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Schmale Seitenleiste (Laptop, ab 1024 px). */
export function SideRail() {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center gap-2 border-r border-line bg-white py-8 lg:flex"
    >
      <AppLogo size={48} className="mb-6" />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex w-20 flex-col items-center gap-1 rounded-2xl py-3 text-[11px] font-semibold transition-colors ${
                  isActive ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                }`
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
