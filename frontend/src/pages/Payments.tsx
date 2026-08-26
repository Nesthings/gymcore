import { useCallback, useEffect, useState } from 'react'
import { CreditCard, FileDown, Wallet } from 'lucide-react'

import { PaymentFormDialog } from '@/components/payments/PaymentFormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatChip } from '@/components/ui/stat-chip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { AppLayout } from '@/components/layout/AppLayout'

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mercadopago: 'Mercado Pago',
}

const PAYMENT_STATUS: Record<
  string,
  { label: string; variant: 'soft-success' | 'soft-warning' | 'soft-destructive' | 'soft-secondary' }
> = {
  paid: { label: 'Pagado', variant: 'soft-success' },
  completed: { label: 'Pagado', variant: 'soft-success' },
  pending: { label: 'Pendiente', variant: 'soft-warning' },
  failed: { label: 'Fallido', variant: 'soft-destructive' },
  refunded: { label: 'Reembolsado', variant: 'soft-destructive' },
}

interface Payment {
  id: string
  member_id: string
  member_name: string
  amount: number
  method?: string
  status?: string
  concept?: string | null
  paid_at: string
  external_ref?: string | null
}

export function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [method, setMethod] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (method) params.set('method', method)
      params.set('limit', '200')
      setPayments(await apiFetch<Payment[]>(`/payments?${params}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pagos')
    } finally {
      setLoading(false)
    }
  }, [from, to, method])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0)

  const downloadReceipt = async (id: string) => {
    try {
      const token = localStorage.getItem('gymcore_token')
      const res = await fetch(`/api/v1/payments/${id}/receipt`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('No se pudo descargar el recibo')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      toast({
        title: 'No se pudo descargar el recibo',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    }
  }

  return (
    <AppLayout>
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pagos</h1>
          <p className="text-sm text-muted-foreground">
            Cobros de membresías y conceptos adicionales
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <CreditCard /> Registrar pago
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatChip
          label="Total del periodo"
          value={MXN.format(total)}
          icon={Wallet}
          tint="bg-primary/10 text-primary"
        />
        <StatChip
          label="Pagos registrados"
          value={payments.length}
          icon={CreditCard}
          tint="bg-info/10 text-info"
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Método</Label>
          <Select value={method || 'all'} onValueChange={(v) => setMethod(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="cash">Efectivo</SelectItem>
              <SelectItem value="card">Tarjeta</SelectItem>
              <SelectItem value="transfer">Transferencia</SelectItem>
              <SelectItem value="mercadopago">Mercado Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Desde</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Hasta</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {error && <ErrorState description={error} onRetry={refresh} className="mb-6" />}
      {loading && <LoadingState label="Cargando pagos…" />}

      {!loading && !error && payments.length === 0 && (
        <EmptyState
          title="Sin pagos en este periodo"
          description="Registra un pago o ajusta los filtros de método y fechas."
          icon={CreditCard}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <CreditCard /> Registrar pago
            </Button>
          }
        />
      )}

      {!loading && !error && payments.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Socio</TableHead>
                <TableHead className="hidden lg:table-cell">Concepto</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Recibo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => {
                const meta = PAYMENT_STATUS[p.status ?? ''] ?? {
                  label: p.status ?? '—',
                  variant: 'soft-secondary' as const,
                }
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.paid_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{p.member_name}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {p.concept ?? 'Membresía'}
                    </TableCell>
                    <TableCell>{PAYMENT_METHODS[p.method ?? ''] ?? p.method ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                      {MXN.format(p.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Descargar recibo del pago de ${p.member_name}`}
                        onClick={() => downloadReceipt(p.id)}
                      >
                        <FileDown />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PaymentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={() => {
          setFormOpen(false)
          refresh()
        }}
      />
    </div>
    </AppLayout>
  )
}