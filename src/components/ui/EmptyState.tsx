import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  Icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
        <Icon className="size-7" aria-hidden />
      </div>
      <h2 className="m-0 text-lg font-bold text-ink">{title}</h2>
      {children && <p className="m-0 max-w-xs text-sm leading-relaxed text-zinc-500">{children}</p>}
      {action}
    </div>
  )
}
