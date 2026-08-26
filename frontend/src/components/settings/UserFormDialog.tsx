import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

export interface StaffUser {
  id: string
  full_name: string
  email: string
  role: string
  branch_id: string | null
  branch_name?: string | null
  is_active: boolean
  photo_url?: string | null
  professional_title?: string | null
  cedula?: string | null
  job_title?: string | null
  description?: string | null
  specialty?: string | null
  is_visible_on_login?: boolean
}

interface UserComponents {
  role: string
  catalog: { slug: string; label: string }[]
  defaults: string[]
  overrides: Record<string, boolean>
  effective: string[]
}

type AccessValue = 'default' | 'grant' | 'deny'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'coach', label: 'Entrenador' },
  { value: 'recepcion', label: 'Recepción' },
]

export function UserFormDialog({
  open,
  user,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  user: StaffUser | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('coach')
  const [branchId, setBranchId] = useState('')
  const [professionalTitle, setProfessionalTitle] = useState('')
  const [cedula, setCedula] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [components, setComponents] = useState<UserComponents | null>(null)
  const [access, setAccess] = useState<Record<string, AccessValue>>({})
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [visibleOnLogin, setVisibleOnLogin] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadComponents = useCallback(async () => {
    if (!user) return
    try {
      const res = await apiFetch<UserComponents>(`/users/${user.id}/components`)
      setComponents(res)
      const next: Record<string, AccessValue> = {}
      for (const c of res.catalog) {
        if (c.slug in res.overrides) {
          next[c.slug] = res.overrides[c.slug] ? 'grant' : 'deny'
        } else {
          next[c.slug] = 'default'
        }
      }
      setAccess(next)
    } catch {
      setComponents(null)
    }
  }, [user])

  useEffect(() => {
    if (!open) return
    setFullName(user?.full_name ?? '')
    setEmail(user?.email ?? '')
    setPassword('')
    setRole(user?.role ?? 'coach')
    setBranchId(user?.branch_id ?? '')
    setProfessionalTitle(user?.professional_title ?? '')
    setCedula(user?.cedula ?? '')
    setJobTitle(user?.job_title ?? '')
    setSpecialty(user?.specialty ?? '')
    setVisibleOnLogin(user?.is_visible_on_login ?? true)
    setPhotoFile(null)
    setError(null)
    setComponents(null)
    setAccess({})
    apiFetch<{ id: string; name: string }[]>('/branches')
      .then(setBranches)
      .catch(() => undefined)
    loadComponents()
  }, [open, user, loadComponents])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      let userId = user?.id
      if (user) {
        const body: Record<string, unknown> = {
          full_name: fullName,
          role,
          branch_id: branchId || null,
          professional_title: professionalTitle || null,
          cedula: cedula || null,
          job_title: jobTitle || null,
          specialty: specialty || null,
          is_visible_on_login: visibleOnLogin,
        }
        if (password) body.password = password
        await apiFetch(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        const created = await apiFetch<{ id: string }>('/users', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName,
            email,
            password,
            role,
            branch_id: branchId || null,
            professional_title: professionalTitle || null,
            cedula: cedula || null,
            job_title: jobTitle || null,
            specialty: specialty || null,
            is_visible_on_login: visibleOnLogin,
          }),
        })
        userId = created.id
      }

      if (userId && photoFile) {
        const form = new FormData()
        form.append('file', photoFile)
        await apiFetch(`/users/${userId}/photo`, { method: 'POST', body: form })
      }

      if (userId && Object.keys(access).length > 0) {
        const overrides: Record<string, boolean> = {}
        for (const [slug, value] of Object.entries(access)) {
          if (value === 'grant') overrides[slug] = true
          else if (value === 'deny') overrides[slug] = false
        }
        await apiFetch(`/users/${userId}/components`, {
          method: 'PUT',
          body: JSON.stringify({ overrides }),
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario')
    } finally {
      setSubmitting(false)
    }
  }

  const catalog = components?.catalog ?? []
  const defaults = components?.defaults ?? []
  const effective = components?.effective ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            {user
              ? 'Actualiza datos, rol o accesos a componentes.'
              : 'Crea una cuenta de staff y define su acceso a los módulos.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="space-y-2">
            <Label>Nombre completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          {!user && (
            <div className="space-y-2">
              <Label>Correo *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rol *</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Sin sucursal —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border/60 p-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
              {photoFile ? (
                <img
                  src={URL.createObjectURL(photoFile)}
                  alt="Foto nueva"
                  className="size-full object-cover"
                />
              ) : user?.photo_url ? (
                <img src={user.photo_url} alt={user.full_name} className="size-full object-cover" />
              ) : (
                <UserRound className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                id="user-form-photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" size="sm">
                <label htmlFor="user-form-photo" className="cursor-pointer">
                  {photoFile || user?.photo_url ? 'Cambiar foto' : 'Subir foto'}
                </label>
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={visibleOnLogin}
                  onChange={(e) => setVisibleOnLogin(e.target.checked)}
                />
                Visible en la pantalla de inicio (login con foto)
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={professionalTitle}
                onChange={(e) => setProfessionalTitle(e.target.value)}
                placeholder="ej. Lic. en Cultura Física"
              />
            </div>
            <div className="space-y-2">
              <Label>Certificación</Label>
              <Input
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="ej. NSCA-CPT"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="ej. Coach de fuerza"
              />
            </div>
            <div className="space-y-2">
              <Label>Especialidad</Label>
              <Input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="ej. CrossFit"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{user ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={user ? undefined : 8}
              required={!user}
              placeholder={user ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}
            />
          </div>

          {catalog.length > 0 && (
            <div className="rounded-md border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Acceso a componentes</p>
                <p className="text-xs text-muted-foreground">
                  Por defecto: según rol · puedes conceder o denegar
                </p>
              </div>
              <div className="grid gap-2">
                {catalog.map((c) => {
                  const isDefault = defaults.includes(c.slug)
                  const isEffective = effective.includes(c.slug)
                  return (
                    <div
                      key={c.slug}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {isDefault ? 'Según rol' : 'No por rol'} ·{' '}
                          {isEffective ? 'Acceso activo' : 'Sin acceso'}
                        </p>
                      </div>
                      <select
                        value={access[c.slug] ?? 'default'}
                        onChange={(e) =>
                          setAccess((prev) => ({
                            ...prev,
                            [c.slug]: e.target.value as AccessValue,
                          }))
                        }
                        aria-label={`Acceso a ${c.label}`}
                        className="h-8 w-32 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="default">Según rol</option>
                        <option value="grant">Permitir</option>
                        <option value="deny">Denegar</option>
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
