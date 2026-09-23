import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Cake,
  CalendarCheck,
  CalendarX,
  CreditCard,
  Flame,
  History,
  Mail,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Scale,
  Trash2,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'

import { AssignPlanDialog } from '@/components/members/AssignPlanDialog'
import { EngagementStats, type EngagementStatsData } from '@/components/members/EngagementStats'
import { MemberFormDialog } from '@/components/members/MemberFormDialog'
import { MembershipCard } from '@/components/members/MembershipCard'
import { RiskBadge } from '@/components/members/RiskBadge'
import { ShareDialog } from '@/components/members/ShareDialog'
import { WeightChart } from '@/components/members/WeightChart'
import { AchievementsGrid, type Achievement } from '@/components/portal/AchievementsGrid'
import { CalendarView, type CalendarDay } from '@/components/portal/CalendarView'
import { GoalCardStaff } from '@/components/portal/GoalCardStaff'
import { type Goal } from '@/components/portal/GoalsCard'
import { RiskScoreRing } from '@/components/risk/RiskScoreRing'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { SectionHeading } from '@/components/ui/section-heading'
import { StatChip } from '@/components/ui/stat-chip'
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
import { cn, formatCurrency } from '@/lib/utils'

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

interface RiskInfo {
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
  emergency_phone?: string | null
  notes?: string | null
  joined_at: string
  memberships: MembershipDetail[]
  payments: PaymentRecord[]
  checkins: CheckinRecord[]
  risk_level?: string | null
  risk_score?: number | null
  risk_suggested_action?: string | null
  risk_days_since_last_visit?: number | null
  risk_attendance_trend?: string | null
  last_checkin_at?: string | null
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
        <p className="break-all text-sm font-medium text-foreground">{value}</p>
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
  const [shareOpen, setShareOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [engagement, setEngagement] = useState<EngagementStatsData | null>(null)
  const [achievements, setAchievements] = useState<{
    summary: { unlocked: number; locked: number; total: number }
    items: Achievement[]
  } | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [calendar, setCalendar] = useState<{ year: number; month: number; days: CalendarDay[] } | null>(null)
  const { toast } = useToast()
  // "Ahora" capturado una vez (evita leer el reloj durante el render).
  const [now] = useState(() => Date.now())

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const q = (p: string) =>
      apiFetch(p).then((r) => (cancelled ? null : r))
    Promise.all([
      q(`/members/${id}/engagement`),
      q(`/members/${id}/achievements`),
      q(`/members/${id}/goals`),
      q(`/members/${id}/calendar`),
    ]).then(([eng, ach, gls, cal]) => {
      if (cancelled) return
      if (eng) setEngagement(eng as EngagementStatsData)
      if (ach) setAchievements(ach as typeof achievements)
      if (gls) setGoals(gls as Goal[])
      if (cal) setCalendar(cal as typeof calendar)
    })
    return () => {
      cancelled = true
    }
  }, [id, refreshKey])

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
  const risk: RiskInfo | null =
    member.risk_level || member.risk_score != null
      ? {
          score: member.risk_score ?? 0,
          level: member.risk_level ?? 'info',
          suggested_action: member.risk_suggested_action ?? undefined,
          days_since_last_visit: member.risk_days_since_last_visit ?? undefined,
          attendance_trend: member.risk_attendance_trend ?? undefined,
        }
      : null
  const age = member.birth_date
    ? Math.floor((now - new Date(member.birth_date).getTime()) / (365.25 * 86_400_000))
    : null
  const expiryDays = currentMembership?.expires_at
    ? Math.ceil((new Date(currentMembership.expires_at).getTime() - now) / 86_400_000)
    : null
  const totalPaid = member.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

  // El peso solo se muestra si el socio lo comparte (opt-in).
  const weightRecords = engagement?.weight_records ?? []
  const showWeight = weightRecords.length > 0

  const goalsSection = goals.length > 0 && (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Objetivos
      </p>
      <div className="space-y-2">
        {goals.map((g) => (
          <GoalCardStaff key={g.id} goal={g} />
        ))}
      </div>
    </div>
  )

  // Acento visual según el estado de riesgo.
  const accent =
    risk?.level === 'critical'
      ? { grad: 'from-destructive/12', ring: 'border-destructive/40' }
      : risk?.level === 'warning'
        ? { grad: 'from-warning/12', ring: 'border-warning/40' }
        : { grad: 'from-primary/12', ring: 'border-primary/30' }

  const expiryBadge =
    expiryDays == null
      ? null
      : expiryDays < 0
        ? 'Membresía vencida'
        : expiryDays === 0
          ? 'Vence hoy'
          : `Vence en ${expiryDays} día${expiryDays === 1 ? '' : 's'}`

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-6xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link to="/socios">
            <ArrowLeft /> Volver a socios
          </Link>
        </Button>

        {/* Hero */}
        <Card className="relative mb-6 overflow-hidden rounded-2xl">
          <div
            className={cn('pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent', accent.grad)}
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center p-6 pt-8 text-center sm:p-8">
            <Avatar
              src={member.photo_url}
              name={member.full_name}
              className={cn('size-24 shrink-0 border-4 shadow-card', accent.ring)}
            />
            <h1 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {member.full_name}
            </h1>

            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
              <Badge variant={status.variant}>{status.label}</Badge>
              {currentMembership?.plan_name && (
                <Badge variant="secondary">{currentMembership.plan_name}</Badge>
              )}
              {risk && <RiskBadge level={risk.level} />}
              {member.gender && (
                <Badge variant="outline" className="capitalize text-muted-foreground">
                  {member.gender}
                </Badge>
              )}
              {age != null && (
                <Badge variant="outline" className="text-muted-foreground">
                  {age} años
                </Badge>
              )}
              {expiryBadge && (
                <Badge variant={expiryDays != null && expiryDays < 0 ? 'soft-destructive' : 'outline'}>
                  {expiryBadge}
                </Badge>
              )}
            </div>

            <div className="mt-6 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              <StatChip
                label="Días sin visitar"
                value={risk?.days_since_last_visit ?? '—'}
                icon={CalendarX}
                tint="bg-warning/10 text-warning"
              />
              <StatChip
                label="Visitas (30 días)"
                value={engagement?.visits_30d ?? '—'}
                icon={CalendarCheck}
                tint="bg-info/10 text-info"
              />
              <StatChip
                label="Racha actual"
                value={engagement ? `${engagement.current_streak} d` : '—'}
                icon={Flame}
                tint="bg-primary/10 text-primary"
              />
              <StatChip
                label="Total pagado"
                value={formatCurrency(totalPaid)}
                icon={Wallet}
                tint="bg-success/10 text-success"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                <Plus /> Asignar plan
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
                <QrCode /> Invitación
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Editar
              </Button>
              <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" aria-hidden="true" />
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

          {/* Datos en dos columnas */}
          <div className="grid border-t border-border lg:grid-cols-2 lg:divide-x lg:divide-border">
            <div className="p-5 sm:p-6">
              <SectionHeading icon={UserRound} title="Contacto" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                <InfoRow icon={Users} label="Género" value={member.gender ?? '—'} />
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <SectionHeading icon={TriangleAlert} title="Emergencia y notas" tint="warning" />
              <div className="mt-4 space-y-4">
                <InfoRow
                  icon={Phone}
                  label="Contacto de emergencia"
                  value={
                    member.emergency_contact ? (
                      <>
                        {member.emergency_contact}
                        {member.emergency_phone ? (
                          <span className="ml-1 text-muted-foreground">· {member.emergency_phone}</span>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )
                  }
                />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Notas</p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">
                    {member.notes || 'Sin notas.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="resumen" className="space-y-4">
          <TabsList className="flex w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 sm:w-auto sm:overflow-visible">
            <TabsTrigger value="resumen">
              <Activity className="size-4" /> Resumen
            </TabsTrigger>
            <TabsTrigger value="progreso">
              <Scale className="size-4" /> Progreso
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
                <Card className="rounded-2xl">
                  <CardContent className="space-y-4 pt-5">
                    <SectionHeading icon={CreditCard} title="Membresía actual" />
                    <MembershipCard membership={currentMembership} />
                  </CardContent>
                </Card>
                {member.notes && (
                  <Card className="rounded-2xl">
                    <CardContent className="space-y-3 pt-5">
                      <SectionHeading icon={Pencil} title="Notas" tint="info" />
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{member.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-4">
                {risk ? (
                  <Card className="rounded-2xl">
                    <CardContent className="space-y-4 pt-5">
                      <SectionHeading
                        icon={TriangleAlert}
                        title="Riesgo de abandono"
                        subtitle="Score 0-100 · reglas de asistencia y pagos"
                        tint="warning"
                      />
                      <div className="flex flex-wrap items-center gap-6">
                        <RiskScoreRing score={risk.score} size={104} stroke={10} />
                        <div className="min-w-0 flex-1 space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Días sin visitar</span>
                            <span className="font-mono font-semibold tabular-nums text-foreground">
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
                            <span className="text-muted-foreground">Nivel</span>
                            <RiskBadge level={risk.level} />
                          </div>
                        </div>
                      </div>
                      {risk.suggested_action && (
                        <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                          <span className="font-medium text-primary">Sugerencia: </span>
                          {risk.suggested_action}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="rounded-2xl">
                    <CardContent className="pt-5">
                      <p className="text-sm text-muted-foreground">
                        Sin puntaje de riesgo disponible para este socio.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {member.memberships.length > 0 && (
                  <Card className="rounded-2xl">
                    <CardContent className="space-y-3 pt-5">
                      <SectionHeading icon={History} title="Historial de membresías" />
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

          <TabsContent value="progreso" className="space-y-4">
            <EngagementStats data={engagement} />
            {showWeight ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <WeightChart records={weightRecords} />
                <div className="space-y-4">
                  <AchievementsGrid data={achievements} perspective="staff" />
                  {goalsSection}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <AchievementsGrid data={achievements} perspective="staff" />
                {goalsSection}
              </div>
            )}
            <CalendarView data={calendar} perspective="staff" />
          </TabsContent>

          <TabsContent value="pagos">
            <Card className="rounded-2xl">
              <CardContent className="pt-5">
                <SectionHeading
                  icon={CreditCard}
                  title="Historial de pagos"
                  subtitle="Cobros registrados para este socio a lo largo del tiempo."
                />
                <div className="mt-4">
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
                                  {formatCurrency(p.amount)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checkins">
            <Card className="rounded-2xl">
              <CardContent className="pt-5">
                <SectionHeading
                  icon={History}
                  title="Historial de check-ins"
                  subtitle="Visitas registradas con el sistema de check-in."
                />
                <div className="mt-4">
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
                </div>
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

        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          memberId={member.id}
          memberName={member.full_name}
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