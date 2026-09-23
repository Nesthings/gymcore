import { Scale } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export interface WeightRecord {
  id: string
  weight_kg: number
  notes?: string | null
  recorded_at: string
}

const AXIS_TICK = { fontSize: 11, fill: 'var(--muted-foreground)' }

export function WeightChart({
  records,
  className,
}: {
  records: WeightRecord[]
  className?: string
}) {
  const data = records
    .slice()
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((r) => ({
      label: new Date(r.recorded_at).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
      }),
      peso: r.weight_kg,
    }))

  return (
    <Card className={cn('rounded-2xl', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="size-4 text-primary" /> Progreso de peso
        </CardTitle>
        <CardDescription>
          {records.length === 0
            ? 'El socio aún no comparte su peso.'
            : `${records.length} registro${records.length === 1 ? '' : 's'} · última medición ${data[data.length - 1]?.label ?? '—'}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <EmptyState
            title="Sin mediciones compartidas"
            description="El socio puede registrar y compartir su peso desde su portal."
            icon={Scale}
            className="border border-dashed"
          />
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin - 2', 'dataMax + 2']}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="peso"
                  name="Peso (kg)"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#weightArea)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
