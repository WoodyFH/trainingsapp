import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Dialog: auf dem Handy von unten, am Laptop mittig. Escape und Klick auf den Hintergrund schließen. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Schließen"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-zinc-900/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="pb-safe relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-xl outline-none sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="m-0 text-lg font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>
  )
}
