import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Dumbbell,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useSetup } from '@/lib/setup'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 'gym', label: 'Gimnasio', icon: Dumbbell },
  { id: 'super-user', label: 'Administrador', icon: CircleUserRound },
  { id: 'branches', label: 'Sucursales', icon: MapPin },
  { id: 'team', label: 'Equipo', icon: UserPlus },
  { id: 'access', label: 'Accesos', icon: ShieldCheck },
  { id: 'done', label: 'Listo', icon: Sparkles },
]

const STEP_META: Record<number, { title: string; desc: string }> = {
  0: { title: 'Tu gimnasio', desc: 'Nombre, logo y datos de contacto.' },
  1: { title: 'Administrador', desc: 'Tu perfil: nombre, puesto y contacto.' },
  2: { title: 'Sucursales', desc: 'Define las sucursales de tu gimnasio y dónde operará.' },
  3: { title: 'Equipo', desc: 'Agrega a tu equipo y asígnalo a sucursal, puesto y rol.' },
  4: { title: 'Accesos', desc: 'Controla el acceso a cada pantalla del panel por usuario.' },
  5: { title: '¡Listo!', desc: 'Tu gimnasio quedó configurado y listo para operar.' },
}

interface GymProfile {
  id: string
  name: string
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  address?: string | null
  timezone: string
  currency: string
  logo_url?: string | null
}

interface Branch {
  id: string
  name: string
  address?: string | null
}

interface StaffUser {
  id: string
  full_name: string
  email: string
  role: string
  branch_id?: string | null
  job_title?: string | null
}

interface UserComponents {
  catalog: { slug: string; label: string; description?: string }[]
  defaults: string[]
  overrides: Record<string, boolean>
  effective: string[]
}

interface TeamMember {
  full_name: string
  email: string
  password: string
  role: string
  branch_id: string
  job_title: string
}

const PUESTOS = [
  'Director(a)',
  'Encargado(a) de sucursal',
  'Coach de fuerza',
  'Coach de cardio',
  'Coach de crossfit',
  'Coach de yoga',
  'Recepción',
  'Administrativo(a)',
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  coach: 'Entrenador',
  recepcion: 'Recepción',
}

function StepHeader({
  icon: Icon,
  title,
  desc,
  step,
}: {
  icon: React.ElementType
  title: string
  desc: string
  step: number
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Paso {step + 1} de {STEPS.length}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

function StepperItem({ index, step }: { index: number; step: number }) {
  const s = STEPS[index]
  const done = index < step
  const current = index === step
  return (
    <li className="relative flex items-center gap-3 py-2.5">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          done && 'border-success bg-success/10 text-success',
          current && 'border-primary bg-primary text-primary-foreground shadow-glow',
          !done && !current && 'border-border bg-secondary text-muted-foreground',
        )}
      >
        {done ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <s.icon className="size-4" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-sm font-medium transition-colors',
            current ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {s.label}
        </p>
        {current && <p className="text-[11px] text-primary">Paso actual</p>}
      </div>
      {index < STEPS.length - 1 && (
        <span
          className={cn(
            'absolute left-[1.125rem] top-11 h-7 w-px rounded-full',
            done ? 'bg-success/50' : 'bg-border',
          )}
          aria-hidden="true"
        />
      )}
    </li>
  )
}

export function SetupWizard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refresh } = useSetup()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [gymForm, setGymForm] = useState({
    name: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    address: '',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  const [superForm, setSuperForm] = useState({
    full_name: '',
    job_title: '',
    phone: '',
  })
  const [superPhoto, setSuperPhoto] = useState<File | null>(null)

  const [newBranches, setNewBranches] = useState<{ name: string; address: string }[]>([])
  const [branchOptions, setBranchOptions] = useState<{ id: string; name: string }[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [users, setUsers] = useState<StaffUser[]>([])
  const [userComponents, setUserComponents] = useState<Record<string, UserComponents>>({})
  const [accessOverride, setAccessOverride] = useState<Record<string, Record<string, boolean>>>({})

  const loadData = useCallback(async () => {
    try {
      const [g, br, us] = await Promise.all([
        apiFetch<GymProfile>('/gyms/me'),
        apiFetch<Branch[]>('/branches'),
        apiFetch<StaffUser[]>('/users'),
      ])
      setGymForm({
        name: g.name,
        contact_name: g.contact_name ?? '',
        contact_phone: g.contact_phone ?? '',
        contact_email: g.contact_email ?? '',
        address: g.address ?? '',
        timezone: g.timezone,
        currency: g.currency,
      })
      setLogoUrl(g.logo_url ?? null)
      setBranchOptions(br.map((b) => ({ id: b.id, name: b.name })))
      setUsers(us)
      const me = us.find((u) => u.id === user?.sub)
      if (me) {
        setSuperForm({
          full_name: me.full_name,
          job_title: me.job_title ?? '',
          phone: '',
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración')
    }
  }, [user?.sub])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveStep = async () => {
    setError(null)
    setSaving(true)
    try {
      if (step === 0) {
        await apiFetch('/gyms/me', {
          method: 'PATCH',
          body: JSON.stringify(gymForm),
        })
        if (logoFile) {
          const form = new FormData()
          form.append('file', logoFile)
          await apiFetch('/gyms/me/logo', { method: 'POST', body: form })
        }
      } else if (step === 1) {
        await apiFetch('/users/me', {
          method: 'PATCH',
          body: JSON.stringify(superForm),
        })
        if (superPhoto && user?.sub) {
          const form = new FormData()
          form.append('file', superPhoto)
          await apiFetch(`/users/${user.sub}/photo`, { method: 'POST', body: form })
        }
      } else if (step === 2) {
        const valid = newBranches.filter((b) => b.name.trim())
        for (const b of valid) {
          await apiFetch('/branches', {
            method: 'POST',
            body: JSON.stringify({ name: b.name.trim(), address: b.address.trim() || null }),
          })
        }
        const br = await apiFetch<Branch[]>('/branches')
        setBranchOptions(br.map((b) => ({ id: b.id, name: b.name })))
      } else if (step === 3) {
        const existingEmails = new Set(users.map((u) => u.email.toLowerCase()))
        const valid = team.filter(
          (t) =>
            t.full_name.trim() &&
            t.email.trim() &&
            !existingEmails.has(t.email.trim().toLowerCase()),
        )
        for (const t of valid) {
          await apiFetch('/users', {
            method: 'POST',
            body: JSON.stringify({
              full_name: t.full_name.trim(),
              email: t.email.trim(),
              password: t.password,
              role: t.role,
              branch_id: t.branch_id || null,
              job_title: t.job_title.trim() || null,
            }),
          })
        }
        const us = await apiFetch<StaffUser[]>('/users')
        setUsers(us)
        setTeam((prev) =>
          prev.filter(
            (t) => !existingEmails.has(t.email.trim().toLowerCase()),
          ),
        )
      } else if (step === 4) {
        for (const [uid, overrides] of Object.entries(accessOverride)) {
          if (!overrides) continue
          const defaults = userComponents[uid]?.defaults ?? []
          const diffs: Record<string, boolean> = {}
          for (const [slug, checked] of Object.entries(overrides)) {
            const isDefault = defaults.includes(slug)
            if (checked !== isDefault) diffs[slug] = checked
          }
          await apiFetch(`/users/${uid}/components`, {
            method: 'PUT',
            body: JSON.stringify({ overrides: diffs }),
          })
        }
      } else if (step === 5) {
        await apiFetch('/gyms/me', {
          method: 'PATCH',
          body: JSON.stringify({ setup_completed: true }),
        })
        await refresh()
        navigate('/', { replace: true })
        return
      }
      setStep((s) => s + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar este paso')
    } finally {
      setSaving(false)
    }
  }

  const goBack = () => {
    setError(null)
    setStep((s) => Math.max(0, s - 1))
  }

  const loadComponentsForUser = async (uid: string) => {
    try {
      const res = await apiFetch<UserComponents>(`/users/${uid}/components`)
      setUserComponents((prev) => ({ ...prev, [uid]: res }))
      setAccessOverride((prev) => {
        const overrides: Record<string, boolean> = {}
        for (const c of res.catalog) {
          overrides[c.slug] = res.effective.includes(c.slug)
        }
        return { ...prev, [uid]: overrides }
      })
    } catch {
      /* sin componentes aún */
    }
  }

  const setTeamField = (idx: number, field: keyof TeamMember, value: string) => {
    setTeam((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)))
  }

  const progress = (step / (STEPS.length - 1)) * 100

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background px-4 py-6 sm:px-6 sm:py-10">
      {/* Aura volt/lime sutil de fondo (energía de gimnasio, sin ruido) */}
      <div
        className={cn(
          'pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full blur-3xl',
          isDark ? 'bg-lime-400/10' : 'bg-lime-400/15',
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          isDark ? 'bg-[radial-gradient(circle_at_50%_0%,transparent,var(--background)_70%)]' : '',
        )}
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-5xl">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:mb-8">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-brand text-primary-foreground shadow-elevated">
              {logoFile || logoUrl ? (
                <img
                  src={logoFile ? URL.createObjectURL(logoFile) : logoUrl ?? ''}
                  alt="Logo del gimnasio"
                  className="size-full object-cover"
                />
              ) : (
                <Dumbbell className="size-6" aria-hidden="true" />
              )}
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Configura tu gimnasio
              </h1>
              <p className="text-sm text-muted-foreground">
                Unos minutos y GymCore quedará listo para tu gimnasio.
              </p>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="font-display text-sm font-semibold text-foreground">
              Paso {Math.min(step + 1, STEPS.length)} de {STEPS.length}
            </p>
            <p className="text-xs text-muted-foreground">{STEP_META[step].title}</p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Stepper (escritorio) */}
          <aside className="hidden h-fit rounded-2xl border border-border bg-card p-3 shadow-card lg:block">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Progreso de configuración
            </p>
            <ol className="relative">
              {STEPS.map((_, i) => (
                <StepperItem key={STEPS[i].id} index={i} step={step} />
              ))}
            </ol>
          </aside>

          {/* Contenido */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border bg-muted/30 px-6 py-5">
              <StepHeader
                icon={STEPS[step].icon}
                title={STEP_META[step].title}
                desc={STEP_META[step].desc}
                step={step}
              />
            </div>

            <div className="px-6 py-6">
              {error && (
                <div className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-[10px] font-bold">
                    !
                  </span>
                  <span>{error}</span>
                </div>
              )}

              <div
                key={step}
                className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-300"
              >
                {step === 0 && (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border/70 bg-background/50 p-4 sm:flex-row sm:items-center">
                      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
                        {logoFile ? (
                          <img
                            src={URL.createObjectURL(logoFile)}
                            alt="Logo nuevo"
                            className="size-full object-cover"
                          />
                        ) : logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="size-full object-cover" />
                        ) : (
                          <Dumbbell className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-sm font-medium">Logo del gimnasio</p>
                        <p className="text-xs text-muted-foreground">
                          Aparecerá en el panel y en los documentos del gimnasio.
                        </p>
                        <input
                          id="setup-logo"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                        />
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm">
                            <label htmlFor="setup-logo" className="cursor-pointer">
                              {logoFile || logoUrl ? 'Cambiar logo' : 'Elegir logo'}
                            </label>
                          </Button>
                          {(logoFile || logoUrl) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setLogoFile(null)
                                setLogoUrl(null)
                              }}
                            >
                              Quitar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sw-name">Nombre del gimnasio *</Label>
                      <Input
                        id="sw-name"
                        value={gymForm.name}
                        onChange={(e) => setGymForm({ ...gymForm, name: e.target.value })}
                        placeholder="Ej. IronHouse Fitness"
                        required
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nombre de contacto</Label>
                        <Input
                          value={gymForm.contact_name}
                          onChange={(e) =>
                            setGymForm({ ...gymForm, contact_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Teléfono</Label>
                        <Input
                          value={gymForm.contact_phone}
                          onChange={(e) =>
                            setGymForm({ ...gymForm, contact_phone: e.target.value })
                          }
                          placeholder="ej. 555 1234 5678"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Correo de contacto</Label>
                      <Input
                        type="email"
                        value={gymForm.contact_email}
                        onChange={(e) =>
                          setGymForm({ ...gymForm, contact_email: e.target.value })
                        }
                        placeholder="contacto@tugimnasio.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Dirección</Label>
                      <Input
                        value={gymForm.address}
                        onChange={(e) => setGymForm({ ...gymForm, address: e.target.value })}
                        placeholder="Calle, número, colonia, ciudad"
                      />
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border/70 bg-background/50 p-4 sm:flex-row sm:items-center">
                      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20 bg-secondary">
                        {superPhoto ? (
                          <img
                            src={URL.createObjectURL(superPhoto)}
                            alt="Foto nueva"
                            className="size-full object-cover"
                          />
                        ) : (
                          <CircleUserRound className="size-9 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-sm font-medium">Tu foto de perfil</p>
                        <p className="text-xs text-muted-foreground">
                          Se muestra en el panel para el equipo.
                        </p>
                        <input
                          id="setup-photo"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setSuperPhoto(e.target.files?.[0] ?? null)}
                        />
                        <Button type="button" variant="outline" size="sm">
                          <label htmlFor="setup-photo" className="cursor-pointer">
                            {superPhoto ? 'Cambiar foto' : 'Elegir foto'}
                          </label>
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
                      <p className="text-sm font-medium text-foreground">
                        Como administrador tendrás acceso a todo
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Configuración, sucursales, equipo, socios, membresías, pagos y check-in del
                        gimnasio.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Nombre completo *</Label>
                      <Input
                        value={superForm.full_name}
                        onChange={(e) =>
                          setSuperForm({ ...superForm, full_name: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Cargo / puesto</Label>
                      <select
                        value={superForm.job_title}
                        onChange={(e) =>
                          setSuperForm({ ...superForm, job_title: e.target.value })
                        }
                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      >
                        <option value="">— Elegir puesto —</option>
                        {PUESTOS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Teléfono</Label>
                      <Input
                        value={superForm.phone}
                        onChange={(e) => setSuperForm({ ...superForm, phone: e.target.value })}
                        placeholder="ej. 555 1234 5678"
                      />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    {newBranches.length === 0 && branchOptions.length === 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>Agrega tu primera sucursal, por ejemplo «Sucursal Centro».</span>
                      </div>
                    )}
                    {branchOptions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground">
                        <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                        <span>
                          Ya existentes:{' '}
                          {branchOptions.map((b) => (
                            <span key={b.id} className="font-medium text-foreground">
                              {b.name}{' '}
                            </span>
                          ))}
                          · agrega nuevas si quieres más.
                        </span>
                      </div>
                    )}

                    <div className="space-y-3">
                      {newBranches.map((b, i) => (
                        <div
                          key={i}
                          className="grid gap-3 rounded-xl border border-border/70 bg-background/50 p-4 sm:grid-cols-[1fr_1fr_auto]"
                        >
                          <div className="space-y-1.5">
                            <Label>Nombre</Label>
                            <Input
                              value={b.name}
                              onChange={(e) =>
                                setNewBranches((prev) =>
                                  prev.map((x, j) =>
                                    j === i ? { ...x, name: e.target.value } : x,
                                  ),
                                )
                              }
                              placeholder="Nombre de la sucursal"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Dirección</Label>
                            <Input
                              value={b.address}
                              onChange={(e) =>
                                setNewBranches((prev) =>
                                  prev.map((x, j) =>
                                    j === i ? { ...x, address: e.target.value } : x,
                                  ),
                                )
                              }
                              placeholder="Calle, número, colonia"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="self-end text-destructive"
                            onClick={() =>
                              setNewBranches((prev) => prev.filter((_, j) => j !== i))
                            }
                          >
                            Quitar
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewBranches((prev) => [...prev, { name: '', address: '' }])}
                    >
                      + Agregar sucursal
                    </Button>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    {branchOptions.length === 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                        <span>Primero define al menos una sucursal en el paso anterior.</span>
                      </div>
                    )}

                    {branchOptions.map((b) => {
                      const members = team.filter((t) => t.branch_id === b.id)
                      return (
                        <div
                          key={b.id}
                          className="overflow-hidden rounded-xl border border-border/70"
                        >
                          <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-3">
                            <p className="flex items-center gap-2 text-sm font-semibold">
                              <MapPin className="size-4 text-primary" aria-hidden="true" />
                              {b.name}
                            </p>
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {members.length} miembro{members.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="space-y-3 p-4">
                            {members.length === 0 && (
                              <p className="text-sm text-muted-foreground">
                                Sin miembros asignados todavía.
                              </p>
                            )}
                            {members.map((t) => {
                              const globalIdx = team.indexOf(t)
                              return (
                                <div
                                  key={globalIdx}
                                  className="space-y-3 rounded-lg border border-border/60 bg-background/50 p-4"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <UserPlus className="size-4" aria-hidden="true" />
                                      </div>
                                      <p className="truncate text-sm font-medium">
                                        {t.full_name || 'Nuevo miembro'}
                                        <span className="ml-1 font-normal text-muted-foreground">
                                          · {t.job_title || 'sin puesto'}
                                        </span>
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() =>
                                        setTeam((prev) => prev.filter((_, j) => j !== globalIdx))
                                      }
                                    >
                                      Quitar
                                    </Button>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                      <Label>Nombre completo *</Label>
                                      <Input
                                        value={t.full_name}
                                        onChange={(e) =>
                                          setTeamField(globalIdx, 'full_name', e.target.value)
                                        }
                                        required
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label>Correo *</Label>
                                      <Input
                                        type="email"
                                        value={t.email}
                                        onChange={(e) =>
                                          setTeamField(globalIdx, 'email', e.target.value)
                                        }
                                        required
                                      />
                                      {t.email.trim() &&
                                        users.some(
                                          (u) =>
                                            u.email.toLowerCase() === t.email.trim().toLowerCase(),
                                        ) && (
                                          <p className="text-xs text-muted-foreground">
                                            Este correo ya está registrado; no se duplicará.
                                          </p>
                                        )}
                                    </div>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                      <Label>Contraseña *</Label>
                                      <Input
                                        type="password"
                                        value={t.password}
                                        onChange={(e) =>
                                          setTeamField(globalIdx, 'password', e.target.value)
                                        }
                                        minLength={8}
                                        required
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label>Puesto *</Label>
                                      <select
                                        value={t.job_title}
                                        onChange={(e) =>
                                          setTeamField(globalIdx, 'job_title', e.target.value)
                                        }
                                        required
                                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                      >
                                        <option value="">— Elegir puesto —</option>
                                        {PUESTOS.map((p) => (
                                          <option key={p} value={p}>
                                            {p}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>Rol de acceso *</Label>
                                    <select
                                      value={t.role}
                                      onChange={(e) =>
                                        setTeamField(globalIdx, 'role', e.target.value)
                                      }
                                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                    >
                                      <option value="coach">Entrenador</option>
                                      <option value="recepcion">Recepción</option>
                                      <option value="admin">Admin</option>
                                    </select>
                                  </div>
                                </div>
                              )
                            })}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setTeam((prev) => [
                                  ...prev,
                                  {
                                    full_name: '',
                                    email: '',
                                    password: '',
                                    role: 'coach',
                                    branch_id: b.id,
                                    job_title: '',
                                  },
                                ])
                              }
                            >
                              + Agregar miembro a {b.name}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Puedes modificarlos después desde Configuración, cuando quieras.
                    </p>
                    {users.map((u) => (
                      <div key={u.id} className="rounded-xl border border-border/70">
                        <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-3">
                          <p className="text-sm font-medium">
                            {u.full_name}
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              {ROLE_LABELS[u.role] ?? u.role}
                            </span>
                          </p>
                          {!userComponents[u.id] && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => loadComponentsForUser(u.id)}
                            >
                              Cargar módulos
                            </Button>
                          )}
                        </div>
                        <div className="p-4">
                          {userComponents[u.id] ? (
                            <div className="space-y-1.5">
                              {userComponents[u.id].catalog.map((c) => {
                                const checked = accessOverride[u.id]?.[c.slug] ?? false
                                return (
                                  <div
                                    key={c.slug}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium">{c.label}</p>
                                      {c.description && (
                                        <p className="text-xs text-muted-foreground">
                                          {c.description}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAccessOverride((prev) => ({
                                          ...prev,
                                          [u.id]: { ...prev[u.id], [c.slug]: !checked },
                                        }))
                                      }
                                      aria-pressed={checked}
                                      className={cn(
                                        'flex h-7 w-14 items-center rounded-full border px-1 transition-colors',
                                        checked
                                          ? 'justify-end border-success/30 bg-success/15'
                                          : 'justify-start border-border bg-secondary',
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold shadow-sm transition-colors',
                                          checked
                                            ? 'bg-success text-success-foreground'
                                            : 'bg-background text-muted-foreground',
                                        )}
                                      >
                                        {checked ? 'SÍ' : 'NO'}
                                      </span>
                                    </button>
                                  </div>
                                )
                              })}
                              <p className="text-[11px] text-muted-foreground">
                                {Object.values(accessOverride[u.id] ?? {}).filter(Boolean).length}{' '}
                                de {userComponents[u.id].catalog.length} pantallas activas
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Presiona «Cargar módulos» para editar sus accesos.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {step === 5 && (
                  <div className="flex flex-col items-center gap-5 py-4 text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
                      <Check className="size-8" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                        ¡Todo listo!
                      </h2>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                        Tu gimnasio quedó configurado. Al continuar entrarás al panel y podrás
                        empezar a registrar socios y check-ins.
                      </p>
                    </div>
                    <div className="w-full max-w-sm rounded-xl border border-border/70 bg-background/50 p-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">
                          {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="size-full object-cover" />
                          ) : (
                            <Dumbbell className="size-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{gymForm.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {superForm.full_name || 'Administrador'} · {branchOptions.length}{' '}
                            sucursales · {users.length} miembros del equipo
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pie: progreso + acciones */}
            <div className="flex flex-col gap-4 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:items-center">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-brand transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goBack}
                  disabled={step === 0 || saving}
                >
                  <ChevronLeft /> Atrás
                </Button>
                <Button type="button" onClick={saveStep} disabled={saving}>
                  {saving ? (
                    <Loader2 className="animate-spin" />
                  ) : step === STEPS.length - 1 ? (
                    <Check />
                  ) : (
                    <ChevronRight />
                  )}
                  {step === STEPS.length - 1 ? 'Entrar al panel' : 'Continuar'}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}