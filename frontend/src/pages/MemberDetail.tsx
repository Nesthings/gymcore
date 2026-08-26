import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Cake,
  CreditCard,
  History,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react'

import { AssignPlanDialog } from '@/components/members/AssignPlanDialog'
import { MemberFormDialog } from '@/components/members/MemberFormDialog'
import { MembershipCard } from '@/components/members/MembershipCard'
import { RiskBadge } from '@/components/members/RiskBadge'
import { RiskScoreRing } from '@/components/risk/RiskScoreRing'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

interface MembershipDetail {
  id: string
  plan_id?: string
  plan_name?: string | null
  status?: string
  starts_at?: string | null
  expires_at?: string | null
  checkins_used?: number | null
  checkins_limit?: number | null
  amount?: number | null
}

interface PaymentRecord {
  id: string
  amount: number
  method?: string
  status?: string
  concept?: string | null
  paid_at: string
  external_ref?: string | null
}

interface CheckinRecord {
  id: string
  checked_at: string
  branch_name?: string | null
}

interface RiskScore {
  score: number
  level: string
  suggested_action?: string
  days_since_last_visit?: number
  attendance_trend?: string
}

export interface MemberDetailData {
  id: string
  full_name: string
  email?: string | null
  phone?: string | null
  photo_url?: string | null
  status: string
  birth_date?: string | null
  gender?: string | null
  emergency_contact?: string | null
  notes?: string | null
  joined_at: string
  memberships: MembershipDetail[]
  payments: PaymentRecord[]
  checkins: CheckinRecord[]
  risk_score?: RiskScore | null
}

const MEMBER_STATUS: Record<string, { label: string; variant: 'soft-success' | 'soft-secondary' }> = {
  active: { label: 'Activo', variant: 'soft-success' },
  inactive: { label: 'Inactivo', variant: 'soft-secondary' },
}

const MEMBERSHIP_STATUS: Record<
  string,
  { label: string; variant: 'soft-success' | 'soft-warning' | 'soft-destructive' | 'soft-secondary' }
> = {
  active: { label: 'Activa', variant: 'soft-success' },
  expiring: { label: 'Por vencer', variant: 'soft-warning' },
  expired: { label: 'Vencida', variant: 'soft-destructive' },
  cancelled: { label: 'Cancelada', variant: 'soft-secondary' },
}

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mercadopago: 'Mercado Pago',
}

const PAYMENT_STATUS: Record<string, { label: string; variant: 'soft-success' | 'soft-warning' | 'soft-destructive' }> = {
  paid: { label: 'Pagado', variant: 'soft-success' },
  completed: { label: 'Pagado', variant: 'soft-success' },
  pending: { label: 'Pendiente', variant: 'soft-warning' },
  failed: { label: 'Fallido', variant: 'soft-destructive' },
  refunded: { label: 'Reembolsado', variant: 'soft-destructive' },
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

export function MemberDetail() {
  const { id } = useParams<{ id: string }>()
  const [member, setMember] = useState<MemberDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setMember(await apiFetch<MemberDetailData>(`/members/${id}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el socio')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const handleDelete = async () => {
    if (!id) return
    try {
      await apiFetch(`/members/${id}`, { method: 'DELETE' })
      toast({
        title: 'Socio dado de baja',
        description: 'El socio fue eliminado del padrón.',
        variant: 'success',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dar de baja al socio')
    }
  }

  if (loading) {
    return <LoadingState label="Cargando ficha del socio…" />
  }

  if (error || !member) {
    return (
      <ErrorState
        title="No se pudo cargar al socio"
        description={error ?? 'No encontramos la ficha solicitada.'}
        onRetry={load}
      />
    )
  }

  const status = MEMBER_STATUS[member.status] ?? {
    label: member.status ?? '—',
    variant: 'soft-secondary' as const,
  }
  const currentMembership = member.memberships.find(
    (m) => m.status === 'active' || m.status === 'expiring',
  )
  const risk = member.risk_score

  return (
    <AppLayout>
    <div className="mx-auto w-full max-w-6xl">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link to="/socios">
          <ArrowLeft /> Volver a socios
        </Link>
      </Button>

      <Card className="mb-6 rounded-2xl">
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar
                src={member.photo_url}
                name={member.full_name}
                className="size-14 shrink-0 border-2 border-primary/30"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight">{member.full_name}</h1>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <RiskBadge level={risk?.level} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Socio desde{' '}
                  {new Date(member.joined_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditOpen(true)
                }}
              >
                <Pencil /> Editar
              </Button>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                <Plus /> Asignar plan
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 /> Dar de baja
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow icon={Phone} label="Teléfono" value={member.phone ?? '—'} />
            <InfoRow icon={Mail} label="Correo" value={member.email ?? '—'} />
            <InfoRow
              icon={Cake}
              label="Nacimiento"
              value={
                member.birth_date
                  ? new Date(member.birth_date).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
            <InfoRow
              icon={Users}
              label="Contacto de emergencia"
              value={member.emergency_contact ?? '—'}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 sm:w-auto sm:overflow-visible">
          <TabsTrigger value="resumen">
            <Activity className="size-4" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="pagos">
            <CreditCard className="size-4" /> Pagos
          </TabsTrigger>
          <TabsTrigger value="checkins">
            <History className="size-4" /> Check-ins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Membresía actual
                </p>
                <MembershipCard membership={currentMembership} />
              </div>
              {member.notes && (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-base">Notas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{member.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              {risk ? (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TriangleAlert className="size-4 text-warning" aria-hidden="true" /> Riesgo de
                      abandono
                    </CardTitle>
                    <CardDescription>Modelo de riesgo · score 0-100</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-6">
                      <RiskScoreRing score={risk.score} size={96} stroke={9} />
                      <div className="min-w-0 flex-1 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Días sin visitar</span>
                          <span className="font-mono tabular-nums font-semibold text-foreground">
                            {risk.days_since_last_visit ?? '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Tendencia</span>
                          <span className="capitalize text-foreground">
                            {risk.attendance_trend ?? '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Renovación</span>
                          <RiskBadge level={risk.level} />
                        </div>
                      </div>
                    </div>
                    {risk.suggested_action && (
                      <p className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                        <span className="font-medium text-primary">Sugerencia: </span>
                        {risk.suggested_action}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-2xl">
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Sin puntaje de riesgo disponible para este socio.
                    </p>
                  </CardContent>
                </Card>
              )}

              {member.memberships.length > 0 && (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-base">Historial de membresías</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {member.memberships.map((ms) => {
                      const meta = MEMBERSHIP_STATUS[ms.status ?? ''] ?? {
                        label: ms.status ?? '—',
                        variant: 'soft-secondary' as const,
                      }
                      return (
                        <div
                          key={ms.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{ms.plan_name ?? 'Plan'}</p>
                            <p className="text-xs text-muted-foreground">
                              {ms.starts_at
                                ? new Date(ms.starts_at).toLocaleDateString('es-MX')
                                : '—'}{' '}
                              →{' '}
                              {ms.expires_at
                                ? new Date(ms.expires_at).toLocaleDateString('es-MX')
                                : '—'}
                            </p>
                          </div>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pagos">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Historial de pagos</CardTitle>
              <CardDescription>
                Cobros registrados para este socio a lo largo del tiempo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {member.payments.length === 0 ? (
                <EmptyState
                  title="Sin pagos registrados"
                  description="Los pagos de membresías aparecerán aquí."
                  icon={CreditCard}
                />
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {member.payments.map((p) => {
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
                            <TableCell>{p.concept ?? 'Membresía'}</TableCell>
                            <TableCell>
                              {PAYMENT_METHODS[p.method ?? ''] ?? p.method ?? '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={meta.variant}>{meta.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                              {new Intl.NumberFormat('es-MX', {
                                style: 'currency',
                                currency: 'MXN',
                              }).format(p.amount)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checkins">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Historial de check-ins</CardTitle>
              <CardDescription>Visitas registradas con el sistema de check-in.</CardDescription>
            </CardHeader>
            <CardContent>
              {member.checkins.length === 0 ? (
                <EmptyState
                  title="Sin check-ins"
                  description="Las visitas de este socio aparecerán aquí al usar el check-in."
                  icon={History}
                />
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Hora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {member.checkins.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            {new Date(c.checked_at).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {new Date(c.checked_at).toLocaleTimeString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {c.branch_name ? ` · ${c.branch_name}` : ''}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MemberFormDialog
        open={editOpen}
        member={member}
        onOpenChange={setEditOpen}
        onSaved={() => {
          setEditOpen(false)
          setRefreshKey((k) => k + 1)
        }}
      />

      <AssignPlanDialog
        memberId={member.id}
        memberName={member.full_name}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onAssigned={() => {
          setAssignOpen(false)
          setRefreshKey((k) => k + 1)
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Dar de baja a ${member.full_name}?`}
        description="El socio dejará de tener acceso y su membresía activa se cancelará."
        confirmLabel="Dar de baja"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
    </AppLayout>
  )
}