export type ChartKind = 'donut' | 'area' | 'barh' | 'stacked' | 'list'

export interface DashboardDef {
  slug: string
  title: string
  desc: string
  chart: ChartKind
}

export const DASHBOARD_CATALOG: DashboardDef[] = [
  {
    slug: 'ingresos_mensuales',
    title: 'Ingresos mensuales',
    desc: 'Ingresos por mes (6 meses)',
    chart: 'area',
  },
  {
    slug: 'nuevas_membresias',
    title: 'Nuevas membresías',
    desc: 'Altas de membresías por mes',
    chart: 'area',
  },
  {
    slug: 'cancelaciones',
    title: 'Cancelaciones',
    desc: 'Motivos de cancelación de membresías',
    chart: 'donut',
  },
  {
    slug: 'checkins_semana',
    title: 'Check-ins de la semana',
    desc: 'Asistencias por día de la semana',
    chart: 'barh',
  },
  {
    slug: 'riesgo_abandono',
    title: 'Riesgo de abandono',
    desc: 'Socios en riesgo según reglas',
    chart: 'list',
  },
  {
    slug: 'morosidad',
    title: 'Morosidad',
    desc: 'Adeudos pendientes por rango',
    chart: 'barh',
  },
  {
    slug: 'conversion_leads',
    title: 'Conversión de leads',
    desc: 'Leads por etapa del embudo',
    chart: 'stacked',
  },
]

export const CHART_LABELS: Record<ChartKind, string> = {
  donut: 'Dona',
  area: 'Área',
  barh: 'Barras',
  stacked: 'Apilada',
  list: 'Lista',
}

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export function getDashboard(slug: string): DashboardDef | undefined {
  return DASHBOARD_CATALOG.find((d) => d.slug === slug)
}