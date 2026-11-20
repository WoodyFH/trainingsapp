import { ChevronRight, History } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Loading, MiniToggle, StatsTabs } from '../../components/stats/shared'
import { EmptyState } from '../../components/ui/EmptyState'
import { withAlpha } from '../../lib/color'
import { formatDate, formatMonthShort, weekdayName } from '../../lib/date'
import { buildHistory, buildSessionStats } from '../../stats/compute'
import { useStatsData } from '../../stats/useStatsData'

type Filter = 'all' | 'strength' | 'cardio'

const PAGE = 50

/** Statistik, Verlauf: chronologische Liste aller Einheiten (jüngste zuerst). */
export default function StatsHistoryPage() {
  const { userId } = useAuth()
  const input = useStatsData(userId)
  const [filter, setFilter] = useState<Filter>('all')
  const [shown, setShown] = useState(PAGE)

  const items = useMemo(() => {
    if (!input) return []
    const all = buildHistory(input, buildSessionStats(input))
    if (filter === 'all') return all
    return all.filter((i) => (filter === 'cardio' ? i.kind === 'cardio' : i.kind !== 'cardio'))
  }, [input, filter])

  const visible = items.slice(0, shown)
  const groups: { month: string; rows: typeof visible }[] = []
  for (const item of visible) {
    const month = item.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.rows.push(item)
    else groups.push({ month, rows: [item] })
  }

  return (
    <div className="flex flex-col gap-4 lg:max-w-2xl">
      <StatsTabs />
      {!input ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MiniToggle
              label="Art der Einheiten"
              value={filter}
              onChange={(f) => {
                setFilter(f)
                setShown(PAGE)
              }}
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'strength', label: 'Kraft' },
                { value: 'cardio', label: 'Cardio' },
              ]}
            />
            <span className="text-sm text-zinc-500">{items.length} Einheiten</span>
          </div>

          {items.length === 0 ? (
            <EmptyState Icon={History} title="Noch keine Einheit">
              Hier erscheinen alle deine Einheiten, sobald du trainiert oder importiert hast.
            </EmptyState>
          ) : (
            <>
              {groups.map((g) => (
                <section key={g.month} className="flex flex-col gap-2" aria-label={formatMonthShort(`${g.month}-01`)}>
                  <h2 className="label-caps m-0 px-1">{formatMonthShort(`${g.month}-01`)}</h2>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {g.rows.map((i) => (
                      <li key={i.id}>
                        <Link to={`/statistik/einheit/${i.id}`} className="card flex items-center gap-3 p-3 transition active:scale-[0.99]">
                          <span
                            className="flex w-14 shrink-0 flex-col items-center rounded-2xl py-1.5 text-center"
                            style={{ background: withAlpha(i.color, 0.14) }}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              {weekdayName(i.date).slice(0, 2)}
                            </span>
                            <span className="text-lg font-extrabold leading-none text-ink">{i.date.slice(8)}</span>
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex items-center gap-2">
                              <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden />
                              <span className="truncate font-bold text-ink">{i.name}</span>
                            </span>
                            <span className="truncate text-xs text-zinc-500">
                              {formatDate(i.date)} · {i.subtitle}
                              {i.imported ? ' · importiert' : ''}
                            </span>
                            {i.note && <span className="truncate text-xs text-zinc-400">{i.note}</span>}
                          </span>
                          <ChevronRight className="size-5 shrink-0 text-zinc-300" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {items.length > shown && (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="h-12 rounded-2xl bg-white font-semibold text-zinc-600 shadow-sm"
                >
                  Mehr anzeigen ({items.length - shown} weitere)
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
