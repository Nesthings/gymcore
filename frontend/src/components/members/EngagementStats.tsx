import { Flame, CalendarCheck, Clock3, Trophy } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface EngagementStatsData {
  checkin_count: number
  current_streak: number
  best_streak: number
  visits_30d: number
  avg_visits_per_week: number
  total_training_min: number
  weight_records?: {
    id: string
    weight_kg: number
    notes?: string | null
    recorded_at: string
  }[]
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          accent ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-lg font-semibold leading-none tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export function EngagementStats({
  data,
  className,
}: {
  data: EngagementStatsData | null
  className?: string
}) {
  if (!data) return null
  const fmtMin = (min: number) =>
    min >= 60 ? `${Math.round(min / 60)} h` : `${min} min`

  return (
    <div className={cn('grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4', className)}>
      <Stat icon={Flame} label="Racha actual" value={`${data.current_streak} días`} accent />
      <Stat icon={Trophy} label="Mejor racha" value={`${data.best_streak} días`} />
      <Stat
        icon={CalendarCheck}
        label={`Visitas (30 días) · ${data.avg_visits_per_week}/sem`}
        value={data.visits_30d}
      />
      <Stat icon={Clock3} label="Tiempo entrenado" value={fmtMin(data.total_training_min)} />
    </div>
  )
}

export function EngagementCard({ data }: { data: EngagementStatsData | null }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="pt-5">
        <EngagementStats data={data} />
      </CardContent>
    </Card>
  )
}