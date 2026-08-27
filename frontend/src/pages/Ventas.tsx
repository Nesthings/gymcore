import { useCallback, useEffect, useMemo, useState } from 'react'
import { Package, ShoppingCart, TrendingUp, Wallet, Plus } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { AppLayout } from '@/components/layout/AppLayout'
import { NewSaleDialog } from '@/components/sales/NewSaleDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { StatChip } from '@/components/ui/stat-chip'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface SalesStats {
  periodo_dias: number
  totales: {
    ventas: number
    ingresos: number
    ticket_promedio: number
  }
  serie_diaria: { fecha: string; ventas: number; ingresos: number }[]
  top_productos: { name: string; unidades: number; ingresos: number }[]
  por_metodo: { metodo: string; ventas: number; ingresos: number }[]
}

const AXIS_TICK = { fontSize: 11, fill: 'var(--muted-foreground)' }

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mercadopago: 'Mercado Pago',
  otro: 'Otro',
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export function Ventas() {
  const [stats, setStats] = useState<SalesStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saleOpen, setSaleOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<SalesStats>('/sales/stats?days=30')
      setStats(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las ventas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const series = useMemo(
    () =>
      (stats?.serie_diaria ?? []).map((d) => ({
        label: new Date(`${d.fecha}T00:00:00`).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
        }),
        ingresos: d.ingresos,
      })),
    [stats],
  )

  const methods = useMemo(
    () =>
      (stats?.por_metodo ?? []).map((m) => ({
        name: METHOD_LABELS[m.metodo] ?? m.metodo,
        value: m.ingresos,
      })),
    [stats],
  )

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground">
            Ventas de mostrador: ingresos, gráficas e historial.
          </p>
        </div>
        <Button size="sm" onClick={() => setSaleOpen(true)}>
          <Plus /> Nueva venta
        </Button>
      </div>

      {error && <ErrorState description={error} onRetry={load} className="mb-6" />}
      {loading && <LoadingState label="Cargando ventas…" />}

      {!loading && !error && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatChip
              label="Ingresos (30 días)"
              value={formatCurrency(stats.totales.ingresos)}
              icon={Wallet}
              tint="bg-success/10 text-success"
            />
            <StatChip
              label="Ventas"
              value={stats.totales.ventas}
              icon={ShoppingCart}
              tint="bg-primary/10 text-primary"
            />
            <StatChip
              label="Ticket promedio"
              value={formatCurrency(stats.totales.ticket_promedio)}
              icon={TrendingUp}
              tint="bg-info/10 text-info"
            />
            <StatChip
              label="Productos top"
              value={stats.top_productos.length}
              icon={Package}
              tint="bg-warning/10 text-warning"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="rounded-2xl lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Ingresos diarios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {series.length === 0 ? (
                    <EmptyState
                      title="Sin ventas en el periodo"
                      description="Registra una venta para ver la tendencia de ingresos."
                      icon={TrendingUp}
                      className="h-full"
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" debounce={100}>
                      <AreaChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Area
                          type="monotone"
                          dataKey="ingresos"
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          fill="url(#salesArea)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Ingresos por método</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {methods.length === 0 ? (
                    <EmptyState
                      title="Sin datos"
                      description="Las ventas aparecerán por método de pago."
                      icon={Wallet}
                      className="h-full"
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" debounce={100}>
                      <PieChart>
                        <Pie
                          data={methods}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          strokeWidth={0}
                          isAnimationActive={false}
                        >
                          {methods.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Productos más vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.top_productos.length === 0 ? (
                <EmptyState
                  title="Sin productos vendidos"
                  description="Al registrar ventas verás aquí los más vendidos."
                  icon={Package}
                  className="py-8"
                />
              ) : (
                <div className="space-y-2">
                  {stats.top_productos.map((p, i) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="truncate font-medium">{p.name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.unidades} uds
                      </span>
                      <span className="shrink-0 font-semibold">
                        {formatCurrency(p.ingresos)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <NewSaleDialog
        open={saleOpen}
        onOpenChange={setSaleOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </AppLayout>
  )
}