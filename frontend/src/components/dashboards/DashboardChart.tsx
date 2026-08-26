import { memo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CHART_COLORS } from '@/lib/dashboards'
import { cn } from '@/lib/utils'
import { SmartAlertsList } from '@/components/dashboards/SmartAlertsList'
import type { SmartAlertsData } from '@/lib/smart-alerts'

const AXIS_TICK = { fontSize: 11, fill: 'var(--muted-foreground)' }

interface NameValue {
  name: string
  value: number
}

function Donut({ data }: { data: NameValue[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          strokeWidth={0}
          isAnimationActive={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function BarsH({ data }: { data: NameValue[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip />
        <Bar
          dataKey="value"
          fill="var(--chart-1)"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

function AreaChartCard({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#dashArea)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function StackedBars({
  data,
}: {
  data: { label: string; a: number; b: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="a"
          name="Etapa A"
          stackId="a"
          fill="var(--chart-1)"
          radius={[0, 0, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="b"
          name="Etapa B"
          stackId="a"
          fill="var(--chart-2)"
          radius={[0, 0, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export const DashboardChart = memo(function DashboardChart({
  slug,
  data,
}: {
  slug: string
  data: unknown
}) {
  switch (slug) {
    case 'ingresos_mensuales':
    case 'nuevas_membresias':
      return <AreaChartCard data={data as { label: string; value: number }[]} />
    case 'cancelaciones':
      return <Donut data={data as NameValue[]} />
    case 'checkins_semana':
    case 'morosidad':
      return <BarsH data={data as NameValue[]} />
    case 'conversion_leads':
      return <StackedBars data={data as never} />
    case 'riesgo_abandono':
      return <SmartAlertsList data={data as SmartAlertsData} />
    default:
      return <p className={cn('text-sm text-muted-foreground')}>Sin datos.</p>
  }
})