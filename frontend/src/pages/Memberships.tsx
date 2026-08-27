import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays,
  Check,
  CreditCard,
  Dumbbell,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react'

import { AssignPlanDialog } from '@/components/members/AssignPlanDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
import { Textarea } from '@/components/ui/textarea'
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
import { cn } from '@/lib/utils'
import { AppLayout } from '@/components/layout/AppLayout'

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

interface MembershipPlan {
  id: string
  name: string
  description?: string | null
  price: number
  duration_days: number
  checkins_limit?: number | null
  is_active: boolean
  pass_quantity?: number
  pass_period?: string | null
  pass_type?: string | null
  pass_requires_guest?: boolean
  pass_expiry_hours?: number
}

interface ActiveMembership {
  id: string
  member_id: string
  member_name: string
  plan_id?: string
  plan_name?: string
  status: string
  starts_at: string
  expires_at: string
  checkins_used?: number | null
  checkins_limit?: number | null
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
]

const MEMBERSHIP_STATUS: Record<
  string,
  { label: string; variant: 'soft-success' | 'soft-warning' | 'soft-destructive' | 'soft-secondary' }
> = {
  active: { label: 'Activa', variant: 'soft-success' },
  expiring: { label: 'Por vencer', variant: 'soft-warning' },
  expired: { label: 'Vencida', variant: 'soft-destructive' },
  cancelled: { label: 'Cancelada', variant: 'soft-secondary' },
}

const STATUS_OPTIONS: { value: 'all' | 'active' | 'expiring' | 'cancelled'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'expiring', label: 'Por vencer' },
  { value: 'cancelled', label: 'Canceladas' },
]

function PlanFormDialog({
  open,
  plan,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  plan: MembershipPlan | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [durationDays, setDurationDays] = useState('')
  const [checkinsLimit, setCheckinsLimit] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [passQuantity, setPassQuantity] = useState('')
  const [passPeriod, setPassPeriod] = useState('month')
  const [passType, setPassType] = useState('invitado')
  const [passRequiresGuest, setPassRequiresGuest] = useState(false)
  const [passExpiryHours, setPassExpiryHours] = useState('24')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    setName(plan?.name ?? '')
    setDescription(plan?.description ?? '')
    setPrice(plan ? String(plan.price) : '')
    setDurationDays(plan ? String(plan.duration_days) : '')
    setCheckinsLimit(plan?.checkins_limit != null ? String(plan.checkins_limit) : '')
    setIsActive(plan?.is_active ?? true)
    setPassQuantity(plan?.pass_quantity ? String(plan.pass_quantity) : '')
    setPassPeriod(plan?.pass_period ?? 'month')
    setPassType(plan?.pass_type ?? 'invitado')
    setPassRequiresGuest(plan?.pass_requires_guest ?? false)
    setPassExpiryHours(plan?.pass_expiry_hours != null ? String(plan.pass_expiry_hours) : '24')
    setError(null)
  }, [open, plan])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !price || !durationDays) {
      setError('Nombre, precio y duración son obligatorios.')
      return
    }
    setSubmitting(true)
    try {
      const body = JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        duration_days: Number(durationDays),
        checkins_limit: checkinsLimit ? Number(checkinsLimit) : null,
        is_active: isActive,
        pass_quantity: passQuantity ? Number(passQuantity) : 0,
        pass_period: passQuantity ? passPeriod : null,
        pass_type: passQuantity ? passType : null,
        pass_requires_guest: passRequiresGuest,
        pass_expiry_hours: passExpiryHours ? Number(passExpiryHours) : 24,
      })
      if (plan) {
        await apiFetch(`/membership-plans/${plan.id}`, { method: 'PATCH', body })
        toast({ title: 'Plan actualizado', variant: 'success' })
      } else {
        await apiFetch('/membership-plans', { method: 'POST', body })
        toast({ title: 'Plan creado', variant: 'success' })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el plan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar plan' : 'Nuevo plan'}</DialogTitle>
          <DialogDescription>Define el precio, la duración y las visitas incluidas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Mensual" />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ej. Acceso ilimitado a todas las áreas"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Precio *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="599"
              />
            </div>
            <div className="space-y-2">
              <Label>Duración *</Label>
              <Input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="space-y-2">
              <Label>Check-ins</Label>
              <Input
                type="number"
                min={0}
                value={checkinsLimit}
                onChange={(e) => setCheckinsLimit(e.target.value)}
                placeholder="Ilimitado"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Plan activo (visible para asignar)
          </label>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              🎟️ Pases incluidos
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pases por periodo</Label>
                <Input
                  type="number"
                  min={0}
                  value={passQuantity}
                  onChange={(e) => setPassQuantity(e.target.value)}
                  placeholder="0 = sin pases"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Periodo</Label>
                <select
                  value={passPeriod}
                  onChange={(e) => setPassPeriod(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="month">Cada mes</option>
                  <option value="week">Cada semana</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de pase</Label>
                <select
                  value={passType}
                  onChange={(e) => setPassType(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="invitado">Invitado</option>
                  <option value="dia">Día</option>
                  <option value="clase">Clase</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Vence en</Label>
                <select
                  value={passExpiryHours}
                  onChange={(e) => setPassExpiryHours(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="12">12 horas</option>
                  <option value="24">24 horas</option>
                  <option value="48">48 horas</option>
                  <option value="72">72 horas</option>
                </select>
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={passRequiresGuest}
                onChange={(e) => setPassRequiresGuest(e.target.checked)}
                className="size-4 rounded border-border"
              />
              Requiere registrar al invitado (nombre)
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenewDialog({
  membership,
  open,
  onOpenChange,
  onSaved,
}: {
  membership: ActiveMembership | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    setAmount('')
    setMethod('')
    setError(null)
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!membership) return
    setError(null)
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {}
      if (amount) body.amount = Number(amount)
      if (method) body.payment_method = method
      await apiFetch(`/memberships/${membership.id}/renew`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast({
        title: 'Membresía renovada',
        description: `${membership.member_name} extendió su membresía.`,
        variant: 'success',
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo renovar la membresía')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCw className="size-5 text-primary" aria-hidden="true" /> Renovar membresía
          </DialogTitle>
          <DialogDescription>
            {membership?.member_name} · {membership?.plan_name ?? 'Plan'} · vence{' '}
            {membership?.expires_at
              ? new Date(membership.expires_at).toLocaleDateString('es-MX')
              : '—'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <RotateCw />} Renovar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Memberships() {
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [memberships, setMemberships] = useState<ActiveMembership[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'cancelled'>(
    'all',
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [renewFor, setRenewFor] = useState<ActiveMembership | null>(null)
  const [cancelFor, setCancelFor] = useState<ActiveMembership | null>(null)
  const [deletePlan, setDeletePlan] = useState<MembershipPlan | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pl, ...ms] = await Promise.all([
        apiFetch<MembershipPlan[]>('/membership-plans'),
        statusFilter === 'all' || statusFilter === 'active'
          ? apiFetch<ActiveMembership[]>('/memberships?status=active')
          : Promise.resolve([]),
        statusFilter === 'all' || statusFilter === 'expiring'
          ? apiFetch<ActiveMembership[]>('/memberships?status=expiring')
          : Promise.resolve([]),
        statusFilter === 'all' || statusFilter === 'cancelled'
          ? apiFetch<ActiveMembership[]>('/memberships?status=cancelled')
          : Promise.resolve([]),
      ])
      setPlans(pl)
      const merged: ActiveMembership[] = []
      for (const list of ms) {
        for (const m of list) {
          if (!merged.some((x) => x.id === m.id)) merged.push(m)
        }
      }
      setMemberships(merged)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las membresías')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const togglePlanActive = async (plan: MembershipPlan) => {
    try {
      await apiFetch(`/membership-plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !plan.is_active }),
      })
      toast({
        title: plan.is_active ? 'Plan desactivado' : 'Plan activado',
        variant: 'success',
      })
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el plan')
    }
  }

  const deletePlanFn = async () => {
    if (!deletePlan) return
    try {
      await apiFetch(`/membership-plans/${deletePlan.id}`, { method: 'DELETE' })
      toast({ title: 'Plan eliminado', variant: 'success' })
      setDeletePlan(null)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el plan')
    }
  }

  const cancelMembership = async (reason?: string) => {
    if (!cancelFor) return
    try {
      await apiFetch(`/memberships/${cancelFor.id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason || null }),
      })
      toast({
        title: 'Membresía cancelada',
        description: `La membresía de ${cancelFor.member_name} fue cancelada.`,
        variant: 'success',
      })
      setCancelFor(null)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la membresía')
    }
  }

  return (
    <AppLayout>
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Membresías</h1>
          <p className="text-sm text-muted-foreground">
            Planes de suscripción y membresías activas de los socios
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingPlan(null)
              setPlanFormOpen(true)
            }}
          >
            <Plus /> Nuevo plan
          </Button>
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <CreditCard /> Asignar plan
          </Button>
        </div>
      </div>

      {error && <ErrorState description={error} onRetry={refresh} className="mb-6" />}
      {loading && <LoadingState label="Cargando membresías…" />}

      {!loading && !error && (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Planes
              </h2>
              <span className="text-xs text-muted-foreground">{plans.length} planes</span>
            </div>
            {plans.length === 0 ? (
              <EmptyState
                title="Aún no hay planes"
                description="Crea tu primer plan de membresía para poder asignarlo a los socios."
                icon={Dumbbell}
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingPlan(null)
                      setPlanFormOpen(true)
                    }}
                  >
                    <Plus /> Crear plan
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((p) => (
                  <Card
                    key={p.id}
                    className={cn('rounded-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none', !p.is_active && 'opacity-60')}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        <Badge variant={p.is_active ? 'soft-success' : 'soft-secondary'}>
                          {p.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      {p.description && (
                        <CardDescription>{p.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-end gap-2">
                        <span className="font-mono text-2xl font-bold tabular-nums tracking-tight">
                          {MXN.format(p.price)}
                        </span>
                        <span className="pb-1 text-sm text-muted-foreground">
                          / {p.duration_days} días
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.checkins_limit != null
                          ? `Incluye ${p.checkins_limit} check-ins por periodo`
                          : 'Check-ins ilimitados'}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingPlan(p)
                            setPlanFormOpen(true)
                          }}
                        >
                          <Pencil /> Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => togglePlanActive(p)}>
                          {p.is_active ? <X /> : <Check />}
                          {p.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeletePlan(p)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Membresías de socios
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                {STATUS_OPTIONS.map((opt) => {
                  const active = statusFilter === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatusFilter(opt.value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground shadow-glow'
                          : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {memberships.length === 0 ? (
              <EmptyState
                title="Sin membresías en esta vista"
                description="Asigna un plan a un socio para que aparezca aquí."
                icon={CreditCard}
                action={
                  <Button size="sm" onClick={() => setAssignOpen(true)}>
                    <Plus /> Asignar plan
                  </Button>
                }
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Socio</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="hidden md:table-cell">Vence</TableHead>
                      <TableHead className="hidden lg:table-cell">Check-ins</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberships.map((m) => {
                      const meta = MEMBERSHIP_STATUS[m.status] ?? {
                        label: m.status,
                        variant: 'soft-secondary' as const,
                      }
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.member_name}</TableCell>
                          <TableCell>{m.plan_name ?? '—'}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <CalendarDays className="size-3.5 text-muted-foreground" />
                              {new Date(m.expires_at).toLocaleDateString('es-MX', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell font-mono tabular-nums text-sm">
                            {m.checkins_limit != null
                              ? `${m.checkins_used ?? 0} / ${m.checkins_limit}`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRenewFor(m)}
                                disabled={m.status === 'cancelled'}
                              >
                                <RotateCw /> Renovar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                disabled={m.status === 'cancelled'}
                                onClick={() => setCancelFor(m)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      )}

      <PlanFormDialog
        open={planFormOpen}
        plan={editingPlan}
        onOpenChange={setPlanFormOpen}
        onSaved={() => {
          setPlanFormOpen(false)
          setEditingPlan(null)
          refresh()
        }}
      />

      <AssignPlanDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onAssigned={() => {
          setAssignOpen(false)
          refresh()
        }}
      />

      <RenewDialog
        membership={renewFor}
        open={Boolean(renewFor)}
        onOpenChange={(open) => !open && setRenewFor(null)}
        onSaved={() => {
          setRenewFor(null)
          refresh()
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelFor)}
        onOpenChange={(open) => !open && setCancelFor(null)}
        title={
          cancelFor ? `¿Cancelar la membresía de ${cancelFor.member_name}?` : ''
        }
        description="El socio perderá el acceso inmediatamente. Esta acción no se puede deshacer."
        confirmLabel="Cancelar membresía"
        variant="destructive"
        onConfirm={() => cancelMembership()}
      />

      <ConfirmDialog
        open={Boolean(deletePlan)}
        onOpenChange={(open) => !open && setDeletePlan(null)}
        title={deletePlan ? `¿Eliminar el plan "${deletePlan.name}"?` : ''}
        description="Los socios con este plan conservarán su membresía vigente, pero no podrás asignarlo de nuevo."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={deletePlanFn}
      />
    </div>
    </AppLayout>
  )
}