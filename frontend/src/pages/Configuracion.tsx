import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
  Users,
} from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { BranchFormDialog, type Branch } from '@/components/settings/BranchFormDialog'
import { UserFormDialog, type StaffUser } from '@/components/settings/UserFormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { apiFetch } from '@/lib/api'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  coach: 'Entrenador',
  recepcion: 'Recepción',
}

const ROLE_BADGE: Record<string, 'soft-info' | 'soft-success' | 'soft-secondary'> = {
  admin: 'soft-info',
  coach: 'soft-success',
  recepcion: 'soft-secondary',
}

interface GymProfile {
  id: string
  name: string
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  address?: string | null
  rfc?: string | null
  fiscal_name?: string | null
  timezone: string
  currency: string
  logo_url?: string | null
}

export function Configuracion() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; onConfirm: () => void } | null>(null)

  const [userFormOpen, setUserFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null)
  const [branchFormOpen, setBranchFormOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)

  const [gym, setGym] = useState<GymProfile | null>(null)
  const [gymForm, setGymForm] = useState({
    name: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    address: '',
    rfc: '',
    fiscal_name: '',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
  })
  const [savingGym, setSavingGym] = useState(false)
  const [gymSuccess, setGymSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [u, b, g] = await Promise.all([
        apiFetch<StaffUser[]>('/users'),
        apiFetch<Branch[]>('/branches'),
        apiFetch<GymProfile>('/gyms/me'),
      ])
      setUsers(u)
      setBranches(b)
      setGym(g)
      setGymForm({
        name: g.name,
        contact_name: g.contact_name ?? '',
        contact_phone: g.contact_phone ?? '',
        contact_email: g.contact_email ?? '',
        address: g.address ?? '',
        rfc: g.rfc ?? '',
        fiscal_name: g.fiscal_name ?? '',
        timezone: g.timezone,
        currency: g.currency,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleUser = async (user: StaffUser) => {
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !user.is_active }),
      })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario')
    }
  }

  const deleteBranch = async (branch: Branch) => {
    setConfirm({
      title: `¿Eliminar la sucursal "${branch.name}"?`,
      onConfirm: async () => {
        try {
          await apiFetch(`/branches/${branch.id}`, { method: 'DELETE' })
          load()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo eliminar la sucursal')
        }
        setConfirm(null)
      },
    })
  }

  const saveGym = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingGym(true)
    setGymSuccess(false)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        name: gymForm.name,
        contact_name: gymForm.contact_name || null,
        contact_phone: gymForm.contact_phone || null,
        contact_email: gymForm.contact_email || null,
        address: gymForm.address || null,
        rfc: gymForm.rfc || null,
        fiscal_name: gymForm.fiscal_name || null,
        timezone: gymForm.timezone,
        currency: gymForm.currency,
      }
      await apiFetch('/gyms/me', { method: 'PATCH', body: JSON.stringify(body) })
      setGymSuccess(true)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el gimnasio')
    } finally {
      setSavingGym(false)
    }
  }

  const uploadLogo = async (file: File) => {
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      await apiFetch('/gyms/me/logo', { method: 'POST', body: form })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el logo')
    }
  }

  const setGymField = (field: keyof typeof gymForm, value: string) =>
    setGymForm((prev) => ({ ...prev, [field]: value }))

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Configuración del gimnasio
        </h1>
        <p className="text-sm text-muted-foreground">
          Usuarios, sucursales y datos del gimnasio
        </p>
      </div>

      {error && <ErrorState description={error} onRetry={load} className="mb-6" />}
      {loading && <LoadingState label="Cargando configuración…" />}

      {!loading && !error && (
        <>
          <Tabs defaultValue="users">
            <TabsList className="w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 sm:w-auto sm:overflow-visible">
              <TabsTrigger value="users">
                <Users className="size-4" /> Usuarios
              </TabsTrigger>
              <TabsTrigger value="branches">
                <Settings2 className="size-4" /> Sucursales
              </TabsTrigger>
              <TabsTrigger value="gym">
                <Building2 className="size-4" /> Gimnasio
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{users.length} cuentas de staff</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingUser(null)
                    setUserFormOpen(true)
                  }}
                >
                  <Plus /> Nuevo usuario
                </Button>
              </div>
              {users.length === 0 ? (
                <EmptyState title="Sin usuarios" description="Crea la primera cuenta de staff." />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="hidden lg:table-cell">Correo</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead className="hidden md:table-cell">Sucursal</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.full_name}</TableCell>
                          <TableCell className="hidden lg:table-cell">{u.email}</TableCell>
                          <TableCell>
                            <Badge variant={ROLE_BADGE[u.role] ?? 'soft-secondary'}>
                              {ROLE_LABELS[u.role] ?? u.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {u.branch_name ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.is_active ? 'soft-success' : 'soft-secondary'}>
                              {u.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar ${u.full_name}`}
                              onClick={() => {
                                setEditingUser(u)
                                setUserFormOpen(true)
                              }}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleUser(u)}
                              className="text-destructive"
                            >
                              {u.is_active ? 'Desactivar' : 'Activar'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="branches" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {branches.length} sucursales — check-in y operación independientes
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingBranch(null)
                    setBranchFormOpen(true)
                  }}
                >
                  <Plus /> Nueva sucursal
                </Button>
              </div>
              {branches.length === 0 ? (
                <EmptyState title="Sin sucursales" description="Crea tu primera sucursal." />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Dirección</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branches.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.name}</TableCell>
                          <TableCell>{b.address ?? '—'}</TableCell>
                          <TableCell>{b.phone ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar ${b.name}`}
                              onClick={() => {
                                setEditingBranch(b)
                                setBranchFormOpen(true)
                              }}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Eliminar ${b.name}`}
                              className="text-destructive"
                              onClick={() => deleteBranch(b)}
                            >
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="gym" className="space-y-4">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Datos del gimnasio</CardTitle>
                  <CardDescription>
                    Identidad del negocio: logo, contacto y datos fiscales.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={saveGym} className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">
                        {gym?.logo_url ? (
                          <img src={gym.logo_url} alt="Logo" className="size-full object-cover" />
                        ) : (
                          <Building2 className="size-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          id="gym-logo"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) uploadLogo(f)
                            e.currentTarget.value = ''
                          }}
                        />
                        <Button type="button" variant="outline" size="sm">
                          <label
                            htmlFor="gym-logo"
                            className="flex cursor-pointer items-center gap-2"
                          >
                            {gym?.logo_url ? 'Cambiar logo' : 'Subir logo'}
                          </label>
                        </Button>
                        <p className="text-xs text-muted-foreground">JPEG/PNG · máx. 5 MB</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Nombre del gimnasio *</Label>
                      <Input
                        value={gymForm.name}
                        onChange={(e) => setGymField('name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nombre de contacto</Label>
                        <Input
                          value={gymForm.contact_name}
                          onChange={(e) => setGymField('contact_name', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Teléfono</Label>
                        <Input
                          value={gymForm.contact_phone}
                          onChange={(e) => setGymField('contact_phone', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Correo de contacto</Label>
                      <Input
                        type="email"
                        value={gymForm.contact_email}
                        onChange={(e) => setGymField('contact_email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Dirección</Label>
                      <Input
                        value={gymForm.address}
                        onChange={(e) => setGymField('address', e.target.value)}
                        placeholder="Calle, número, colonia, ciudad"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>RFC</Label>
                        <Input
                          value={gymForm.rfc}
                          onChange={(e) => setGymField('rfc', e.target.value)}
                          placeholder="Para recibos y facturación"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Razón social</Label>
                        <Input
                          value={gymForm.fiscal_name}
                          onChange={(e) => setGymField('fiscal_name', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Zona horaria</Label>
                        <select
                          value={gymForm.timezone}
                          onChange={(e) => setGymField('timezone', e.target.value)}
                          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        >
                          <option value="UTC">UTC</option>
                          <option value="America/Mexico_City">Ciudad de México</option>
                          <option value="America/Monterrey">Monterrey</option>
                          <option value="America/Guadalajara">Guadalajara</option>
                          <option value="America/Tijuana">Tijuana</option>
                          <option value="America/Merida">Mérida</option>
                          <option value="America/Chihuahua">Chihuahua</option>
                          <option value="America/Los_Angeles">Los Ángeles</option>
                          <option value="America/Bogota">Bogotá</option>
                          <option value="America/Lima">Lima</option>
                          <option value="America/Santiago">Santiago</option>
                          <option value="America/Argentina/Buenos_Aires">Buenos Aires</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Moneda</Label>
                        <select
                          value={gymForm.currency}
                          onChange={(e) => setGymField('currency', e.target.value)}
                          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        >
                          <option value="MXN">MXN — Peso mexicano</option>
                          <option value="USD">USD — Dólar</option>
                          <option value="EUR">EUR — Euro</option>
                          <option value="COP">COP — Peso colombiano</option>
                          <option value="PEN">PEN — Sol</option>
                          <option value="CLP">CLP — Peso chileno</option>
                          <option value="ARS">ARS — Peso argentino</option>
                        </select>
                      </div>
                    </div>

                    {gymSuccess && <p className="text-sm text-success">Datos guardados.</p>}
                    <Button type="submit" disabled={savingGym}>
                      {savingGym ? <Loader2 className="animate-spin" /> : <Save />} Guardar
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <UserFormDialog
        open={userFormOpen}
        user={editingUser}
        onOpenChange={setUserFormOpen}
        onSaved={() => {
          setUserFormOpen(false)
          setEditingUser(null)
          load()
        }}
      />
      <BranchFormDialog
        open={branchFormOpen}
        branch={editingBranch}
        onOpenChange={setBranchFormOpen}
        onSaved={() => {
          setBranchFormOpen(false)
          setEditingBranch(null)
          load()
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.title ?? ''}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => confirm?.onConfirm()}
      />
    </AppLayout>
  )
}