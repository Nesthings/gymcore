import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCard, FileDown, Wallet } from 'lucide-react'

import { PaymentFormDialog } from '@/components/payments/PaymentFormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ListToolbar } from '@/components/ui/list-toolbar'
import { LoadingState } from '@/components/ui/loading-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination, pageCountFor, paginate } from '@/components/ui/pagination'
import { SearchInput } from '@/components/ui/search-input'
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
import { apiFetch, getToken } from '@/lib/api'
import { AppLayout } from '@/components/layout/AppLayout'
import { formatCurrency } from '@/lib/utils'

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
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
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = payments.filter(
      (p) =>
        !q ||
        p.member_name.toLowerCase().includes(q) ||
        (p.concept ?? '').toLowerCase().includes(q),
    )
    const sorted = [...list]
    if (sort === 'date_asc') sorted.sort((a, b) => a.paid_at.localeCompare(b.paid_at))
    else if (sort === 'amount_desc') sorted.sort((a, b) => b.amount - a.amount)
    else if (sort === 'amount_asc') sorted.sort((a, b) => a.amount - b.amount)
    else sorted.sort((a, b) => b.paid_at.localeCompare(a.paid_at))
    return sorted
  }, [payments, search, sort])

  useEffect(() => {
    setPage(1)
  }, [search, sort, from, to, method])

  const pageCount = pageCountFor(filtered.length, PAGE_SIZE)
  const paged = paginate(filtered, page, PAGE_SIZE)

  const downloadReceipt = async (id: string) => {
    try {
      const token = getToken()
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
      <PageHeader
        title="Pagos"
        subtitle="Cobros de membresías y conceptos adicionales"
        icon={CreditCard}
        actions={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <CreditCard /> Registrar pago
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatChip
          label="Total del periodo"
          value={formatCurrency(total, 2)}
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

      <ListToolbar className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Buscar socio o concepto…"
          aria-label="Buscar pago"
        />
        <Select value={method || 'all'} onValueChange={(v) => setMethod(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full" aria-label="Filtrar por método">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los métodos</SelectItem>
            <SelectItem value="cash">Efectivo</SelectItem>
            <SelectItem value="card">Tarjeta</SelectItem>
            <SelectItem value="transfer">Transferencia</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Label htmlFor="pay-from" className="shrink-0 text-xs text-muted-foreground">
            Desde
          </Label>
          <Input id="pay-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="pay-to" className="shrink-0 text-xs text-muted-foreground">
            Hasta
          </Label>
          <Input id="pay-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </ListToolbar>

      <div className="mb-4 flex items-center justify-end">
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-48" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Fecha (reciente)</SelectItem>
            <SelectItem value="date_asc">Fecha (antigua)</SelectItem>
            <SelectItem value="amount_desc">Monto (mayor)</SelectItem>
            <SelectItem value="amount_asc">Monto (menor)</SelectItem>
          </SelectContent>
        </Select>
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

      {!loading && !error && payments.length > 0 && filtered.length === 0 && (
        <EmptyState
          title="Sin resultados"
          description="Ajusta la búsqueda o los filtros."
          icon={CreditCard}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
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
              {paged.map((p) => {
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
                      {formatCurrency(p.amount, 2)}
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
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
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