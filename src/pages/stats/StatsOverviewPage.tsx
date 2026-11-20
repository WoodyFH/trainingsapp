import { BarChart3 } from 'lucide-react'
import { useMemo } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { ActivitySection } from '../../components/stats/ActivitySection'
import { MuscleSection } from '../../components/stats/MuscleSection'
import { Loading, PeriodFilter, StatsTabs, usePeriod } from '../../components/stats/shared'
import { VolumeSection } from '../../components/stats/VolumeSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { todayIso } from '../../lib/date'
import { buildActivity, buildSessionStats } from '../../stats/compute'
import { rangeFor } from '../../stats/period'
import { useStatsData } from '../../stats/useStatsData'

/** Statistik, Übersicht: Gesamtvolumen, Volumen-Balken, Trainingstage, Muskelgruppen. */
export default function StatsOverviewPage() {
  const { userId } = useAuth()
  const input = useStatsData(userId)
  const [period, setPeriod] = usePeriod()
  const today = todayIso()
  const range = useMemo(() => rangeFor(period, today), [period, today])
  const stats = useMemo(() => (input ? buildSessionStats(input) : []), [input])
  const activity = useMemo(() => (input ? buildActivity(input, stats) : new Map()), [input, stats])

  return (
    <div className="flex flex-col gap-4">
      <StatsTabs />
      <PeriodFilter value={period} onChange={setPeriod} />
      {!input ? (
        <Loading />
      ) : stats.length === 0 ? (
        <EmptyState Icon={BarChart3} title="Noch keine Einheit">
          Sobald du ein Training abhakst oder deine alte Excel importierst, erscheinen hier Volumen, Trainingstage und
          Muskelgruppen.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-4">
            <VolumeSection stats={stats} range={range} period={period} today={today} />
            <ActivitySection stats={stats} activity={activity} range={range} today={today} />
          </div>
          <MuscleSection input={input} range={range} />
        </div>
      )}
    </div>
  )
}
