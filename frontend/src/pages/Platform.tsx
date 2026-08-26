import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  Dumbbell,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiFetch } from '@/lib/api'

interface Invite {
  id: string
  token: string
  gym_name?: string | null
  contact_email?: string | null
  status: string
  expires_at: string
}

interface StaffUser {
  id: string
  full_name: string
  email: string
  role: string
  gym_name?: string | null
}

interface GymRow {
  id: string
  name: string
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  subscription_status: string
  setup_completed: boolean
  timezone: string
  currency: string
  created_at: string
}

interface GymSummary {
  id: string
  name: string
  subscription_status: string
  branches: number
  staff: number
  members: number
  memberships: number
  payments: number
}

interface GymEvent {
  id: string
  event_type: string
  notes?: string | null
  created_at: string
}

const SUBSCRIPTION_LABEL: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'info' }
> = {
  active: { label: 'Activa', variant: 'success' },
  trial: { label: 'Prueba', variant: 'info' },
  suspended: { label: 'Suspendida', variant: 'warning' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
}

export function Platform() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [invName, setInvName] = useState('')
  const [invEmail, setInvEmail] = useState('')
  const [invDays, setInvDays] = useState('30')
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [users, setUsers] = useState<StaffUser[]>([])
  const [search, setSearch] = useState('')
  const [resetFor, setResetFor] = useState<StaffUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const [gyms, setGyms] = useState<GymRow[]>([])
  const [gymSearch, setGymSearch] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [summary, setSummary] = useState<GymSummary | null>(null)
  const [gymStaff, setGymStaff] = useState<StaffUser[]>([])
  const [events, setEvents] = useState<GymEvent[]>([])
  const [loadingGyms, setLoadingGyms] = useState(true)
  const [tab, setTab] = useState('links')

  const loadInvites = useCallback(async () => {
    try {
      setInvites(await apiFetch<Invite[]>('/platform/gym-invites'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las invitaciones')
    }
  }, [])

  const loadGyms = useCallback(async () => {
    setLoadingGyms(true)
    setError(null)
    try {
      setGyms(await apiFetch<GymRow[]>('/gyms'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los gimnasios')
    } finally {
      setLoadingGyms(false)
    }
  }, [])

  useEffect(() => {
    loadInvites()
    loadGyms()
  }, [loadInvites, loadGyms])

  const toggleDetail = async (id: string) => {
    if (detailId === id) {
      setDetailId(null)
      return
    }
    setDetailId(id)
    setSummary(null)
    setGymStaff([])
    setEvents([])
    setError(null)
    try {
      const [sum, staff, evts] = await Promise.all([
        apiFetch<GymSummary>(`/gyms/${id}/summary`),
        apiFetch<StaffUser[]>(`/platform/users?gym_id=${id}`),
        apiFetch<GymEvent[]>(`/gyms/${id}/events`),
      ])
      setSummary(sum)
      setGymStaff(staff)
      setEvents(evts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle')
    }
  }

  const setSubscription = async (id: string, status: string) => {
    setError(null)
    try {
      await apiFetch(`/gyms/${id}/subscription`, {
        method: 'POST',
        body: JSON.stringify({ status, notes: null }),
      })
      await loadGyms()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado')
    }
  }

  const generate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await apiFetch<Invite>('/platform/gym-invites', {
        method: 'POST',
        body: JSON.stringify({
          gym_name: invName || null,
          contact_email: invEmail || null,
          expires_in_days: Number(invDays) || 30,
        }),
      })
      setNewLink(`${window.location.origin}/create-gym?token=${res.token}`)
      setInvName('')
      setInvEmail('')
      await loadInvites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el link')
    }
  }

  const revoke = async (id: string) => {
    setError(null)
    try {
      await apiFetch(`/platform/gym-invites/${id}/revoke`, { method: 'POST' })
      await loadInvites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revocar')
    }
  }

  const copyLink = async () => {
    if (!newLink) return
    try {
      await navigator.clipboard.writeText(newLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // sin clipboard
    }
  }

  const searchUsers = async (term: string) => {
    setSearch(term)
    if (!term.trim()) {
      setUsers([])
      return
    }
    try {
      setUsers(
        await apiFetch<StaffUser[]>(`/platform/users?search=${encodeURIComponent(term.trim())}`),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar')
    }
  }

  const resetPassword = async () => {
    if (!resetFor || newPassword.length < 8) {
      setError('Selecciona un usuario y una contraseña de al menos 8 caracteres.')
      return
    }
    setError(null)
    try {
      await apiFetch(`/platform/staff/${resetFor.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      })
      setResetFor(null)
      setNewPassword('')
      setUsers([])
      setSearch('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer')
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Plataforma</h1>
          <p className="text-sm text-muted-foreground">Dueño del producto · admin@gymcore.app</p>
        </div>
      </div>

      <div className="mb-4 min-h-[20px]">
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="relative z-10 w-full flex-wrap justify-start gap-1 rounded-xl border border-border bg-card p-1">
          <TabsTrigger value="links">Links de invitación</TabsTrigger>
          <TabsTrigger value="gyms">Gimnasios</TabsTrigger>
          <TabsTrigger value="recover">Recuperar acceso</TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-5 text-primary" /> Generar link único
              </CardTitle>
              <CardDescription>
                Crea un enlace para que un admin registre su gimnasio (un solo uso).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={generate} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Nombre del gimnasio</Label>
                    <Input
                      value={invName}
                      onChange={(e) => setInvName(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Correo del admin</Label>
                    <Input
                      type="email"
                      value={invEmail}
                      onChange={(e) => setInvEmail(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vence en (días)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={invDays}
                      onChange={(e) => setInvDays(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" size="sm">
                  <Plus /> Generar link
                </Button>
              </form>

              {newLink && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
                  <Clipboard className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{newLink}</p>
                  <Button type="button" size="sm" variant="outline" onClick={copyLink}>
                    {copied ? <RefreshCw className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Invitaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin invitaciones generadas.</p>
              ) : (
                invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {inv.gym_name ?? 'Gimnasio sin nombre'}
                        {inv.contact_email ? ` · ${inv.contact_email}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence el {new Date(inv.expires_at).toLocaleDateString('es-MX')} ·{' '}
                        {inv.token.slice(0, 12)}…
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={
                          inv.status === 'used'
                            ? 'success'
                            : inv.status === 'revoked'
                              ? 'destructive'
                              : inv.status === 'expired'
                                ? 'secondary'
                                : 'warning'
                        }
                      >
                        {inv.status === 'used'
                          ? 'Usado'
                          : inv.status === 'revoked'
                            ? 'Revocado'
                            : inv.status === 'expired'
                              ? 'Expirado'
                              : 'Pendiente'}
                      </Badge>
                      {inv.status === 'pending' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => revoke(inv.id)}
                        >
                          Revocar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gyms" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-5 text-primary" /> Gimnasios (tenants)
              </CardTitle>
              <CardDescription>
                Activa, suspende o cancela gimnasios y consulta su información.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={gymSearch}
                onChange={(e) => setGymSearch(e.target.value)}
                placeholder="Buscar gimnasio…"
                className="max-w-sm"
              />

              {loadingGyms ? (
                <p className="text-sm text-muted-foreground">Cargando gimnasios…</p>
              ) : (
                <div className="space-y-2">
                  {gyms
                    .filter((c) => c.name.toLowerCase().includes(gymSearch.trim().toLowerCase()))
                    .map((g) => {
                      const st = SUBSCRIPTION_LABEL[g.subscription_status] ?? {
                        label: g.subscription_status,
                        variant: 'secondary' as const,
                      }
                      const open = detailId === g.id
                      return (
                        <div key={g.id} className="rounded-lg border border-border/60 bg-muted/20">
                          <div className="flex items-center justify-between gap-2 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{g.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {g.id.slice(0, 8)}… · Creado{' '}
                                {new Date(g.created_at).toLocaleDateString('es-MX')}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant={st.variant}>{st.label}</Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleDetail(g.id)}
                              >
                                {open ? <ChevronDown /> : <ChevronRight />} Info
                              </Button>
                            </div>
                          </div>

                          {open && (
                            <div className="space-y-4 border-t border-border px-3 py-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Contacto
                                  </p>
                                  <p className="text-sm">
                                    {g.contact_name ?? '—'}
                                    {g.contact_email ? ` · ${g.contact_email}` : ''}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Teléfono: {g.contact_phone ?? '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Configuración
                                  </p>
                                  <p className="text-sm">
                                    Zona horaria {g.timezone} · Moneda {g.currency}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Setup: {g.setup_completed ? 'Completado' : 'Pendiente'}
                                  </p>
                                </div>
                              </div>

                              {summary && (
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    ['Sucursales', summary.branches],
                                    ['Staff', summary.staff],
                                    ['Socios', summary.members],
                                    ['Membresías', summary.memberships],
                                    ['Pagos', summary.payments],
                                  ].map(([label, value]) => (
                                    <span
                                      key={String(label)}
                                      className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
                                    >
                                      <span className="font-semibold">{value}</span>{' '}
                                      <span className="text-muted-foreground">{label}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-2">
                                <p className="w-full text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Estado de suscripción
                                </p>
                                {g.subscription_status !== 'active' && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSubscription(g.id, 'active')}
                                  >
                                    Activar
                                  </Button>
                                )}
                                {g.subscription_status !== 'suspended' && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSubscription(g.id, 'suspended')}
                                  >
                                    Suspender
                                  </Button>
                                )}
                                {g.subscription_status !== 'cancelled' && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive"
                                    onClick={() => setSubscription(g.id, 'cancelled')}
                                  >
                                    Cancelar
                                  </Button>
                                )}
                              </div>

                              {gymStaff.length > 0 && (
                                <div>
                                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Staff
                                  </p>
                                  <div className="space-y-1">
                                    {gymStaff.map((u) => (
                                      <p key={u.id} className="text-sm">
                                        <span className="font-medium">{u.full_name}</span>
                                        <span className="text-muted-foreground">
                                          {' '}
                                          · {u.email} · {u.role}
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {events.length > 0 && (
                                <div>
                                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Historial de suscripción
                                  </p>
                                  <div className="space-y-1">
                                    {events.map((ev) => (
                                      <p key={ev.id} className="text-sm">
                                        <span className="font-medium capitalize">
                                          {ev.event_type}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {' '}
                                          · {new Date(ev.created_at).toLocaleString('es-MX')}
                                          {ev.notes ? ` · ${ev.notes}` : ''}
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recover" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary" /> Restablecer contraseña de un admin
              </CardTitle>
              <CardDescription>
                Busca al usuario por correo o nombre y asigna una nueva contraseña.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Buscar usuario</Label>
                <Input
                  value={search}
                  onChange={(e) => searchUsers(e.target.value)}
                  placeholder="Correo o nombre…"
                />
              </div>

              {users.length > 0 && (
                <div className="space-y-1.5">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setResetFor(u)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        resetFor?.id === u.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border/60 hover:bg-accent'
                      }`}
                    >
                      <span className="font-medium">{u.full_name}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {u.email} · {u.role} · {u.gym_name ?? ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {resetFor && (
                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Nueva contraseña para {resetFor.full_name}</p>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <Button type="button" size="sm" onClick={resetPassword}>
                    Restablecer contraseña
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Dumbbell className="size-3.5" aria-hidden="true" />
        Consola de plataforma: invita y administra gimnasios.
      </p>
    </div>
  )
}