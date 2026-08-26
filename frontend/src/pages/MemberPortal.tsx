import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Flame,
  LinkIcon,
  QrCode,
  Scale,
  Trophy,
} from 'lucide-react'
import QRCode from 'qrcode'

import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

interface PortalData {
  gym: { name: string; logo_url?: string | null }
  member: {
    id: string
    full_name: string
    photo_url?: string | null
    joined_at: string
    status: string
  }
  membership?: {
    plan_name: string
    status: string
    expires_at: string
    checkins_used: number
    checkins_limit?: number | null
  } | null
  stats: {
    checkin_count: number
    current_streak: number
    best_streak: number
    visits_30d: number
    total_training_min: number
  }
  weight_records: {
    id: string
    weight_kg: number
    notes?: string | null
    recorded_at: string
  }[]
  recent_checkins: { checked_at: string; checked_out_at?: string | null; duration_min?: number | null }[]
}

const MEMBERSHIP_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  active: { label: 'Membresía activa', variant: 'success' },
  expiring: { label: 'Por vencer', variant: 'warning' },
  expired: { label: 'Vencida', variant: 'destructive' },
}

function fmtMin(min: number) {
  return min >= 60 ? `${Math.round(min / 60)} h` : `${min} min`
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-card px-2 py-3 text-center',
        accent && 'border-primary/25 bg-primary/5',
      )}
    >
      <span className={cn('flex size-8 items-center justify-center rounded-full', accent ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  )
}

export function MemberPortal() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [kg, setKg] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    if (!token) {
      setError('Falta el enlace de acceso.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await apiFetch<PortalData>(`/member-share?token=${encodeURIComponent(token)}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu portal')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const qrValue = useMemo(
    () => (data ? `gymcore:member:${data.member.id}` : null),
    [data],
  )

  useEffect(() => {
    if (!qrValue) {
      setQr(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(qrValue, { width: 260, margin: 1, color: { dark: '#161512' } }).then((url) => {
      if (!cancelled) setQr(url)
    })
    return () => {
      cancelled = true
    }
  }, [qrValue])

  const uploadPhoto = async (file: File) => {
    if (!file || file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagen inválida', description: 'Máximo 5 MB.', variant: 'error' })
      return
    }
    const form = new FormData()
    form.append('photo', file)
    setUploading(true)
    try {
      const res = await apiFetch<{ photo_url: string }>(`/member-share/photo?token=${encodeURIComponent(token)}`, {
        method: 'PUT',
        body: form,
      })
      setData((d) => (d ? { ...d, member: { ...d.member, photo_url: res.photo_url } } : d))
      toast({ title: 'Foto actualizada', variant: 'success' })
    } catch (err) {
      toast({ title: 'No se pudo subir', description: err instanceof Error ? err.message : 'Intenta de nuevo.', variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const registerWeight = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(kg)
    if (!value || value < 20 || value > 400) {
      toast({ title: 'Peso inválido', description: 'Ingresa un peso entre 20 y 400 kg.', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      const rec = await apiFetch<{ id: string; weight_kg: number; recorded_at: string; notes?: string | null }>(
        `/member-share/weights?token=${encodeURIComponent(token)}`,
        { method: 'POST', body: JSON.stringify({ weight_kg: value }) },
      )
      setData((d) => (d ? { ...d, weight_records: [...d.weight_records, rec] } : d))
      setKg('')
      toast({ title: 'Peso registrado', variant: 'success' })
    } catch (err) {
      toast({ title: 'No se pudo registrar', description: err instanceof Error ? err.message : 'Intenta de nuevo.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingState label="Cargando tu portal…" />
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <ErrorState
          title={error?.toLowerCase().includes('expirado') ? 'Enlace vencido' : 'No se pudo cargar'}
          description={error ?? 'Revisa el enlace o pídele uno nuevo a tu gimnasio.'}
          onRetry={load}
          className="max-w-md"
        />
      </div>
    )
  }

  const membership = data.membership
  const mBadge = MEMBERSHIP_BADGE[membership?.status ?? ''] ?? {
    label: 'Sin membresía',
    variant: 'error' as const,
  }
  const weights = data.weight_records.slice().sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Marca del gimnasio */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            {data.gym.logo_url ? (
              <img src={data.gym.logo_url} alt="" className="size-7 rounded-lg object-cover" />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Dumbbell className="size-4" aria-hidden="true" />
              </span>
            )}
            <span className="text-sm font-semibold tracking-tight">{data.gym.name}</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LinkIcon className="size-3.5" aria-hidden="true" /> Portal del socio
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {/* Perfil + foto clicable */}
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center">
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="group relative rounded-full transition-transform active:scale-95"
            title="Toca para ver tu QR y cambiar foto"
          >
            <Avatar
              src={data.member.photo_url}
              name={data.member.full_name}
              className="size-24 border-2 border-primary/30"
            />
            <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-110">
              <QrCode className="size-4" aria-hidden="true" />
            </span>
          </button>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {data.member.full_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Socio desde{' '}
              {new Date(data.member.joined_at).toLocaleDateString('es-MX', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Toca tu foto para ver tu QR de check-in o actualizar tu imagen.
          </p>
        </section>

        {/* Membresía */}
        {membership && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Membresía</p>
                <p className="text-lg font-semibold">{membership.plan_name}</p>
              </div>
              <Badge variant={mBadge.variant}>{mBadge.label}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Vence el</span>
              <span className="font-medium">
                {new Date(membership.expires_at).toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            {membership.checkins_limit != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Check-ins usados:{' '}
                <span className="font-mono tabular-nums text-foreground">
                  {membership.checkins_used} / {membership.checkins_limit}
                </span>
              </p>
            )}
          </section>
        )}

        {/* Engagement */}
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard icon={Flame} label="Racha actual" value={`${data.stats.current_streak} días`} accent />
          <StatCard icon={Trophy} label="Mejor racha" value={`${data.stats.best_streak} días`} />
          <StatCard icon={CalendarDays} label="Visitas (30 días)" value={data.stats.visits_30d} />
          <StatCard icon={Clock3} label="Tiempo entrenado" value={fmtMin(data.stats.total_training_min)} />
        </div>

        {/* Peso */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Scale className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Mi progreso de peso</h2>
          </div>
          {weights.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aún no hay mediciones. Registra tu primer peso.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {weights
                .slice()
                .reverse()
                .map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-base font-semibold tabular-nums">
                      {w.weight_kg} kg
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(w.recorded_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {w.notes ? ` · ${w.notes}` : ''}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <form onSubmit={registerWeight} className="mt-3 flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="portal-weight">Peso (kg)</Label>
              <Input
                id="portal-weight"
                type="number"
                step="0.1"
                min={20}
                max={400}
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                placeholder="p. ej. 78.5"
                className="w-28"
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              <CheckCircle2 /> Registrar
            </Button>
          </form>
        </section>

        {/* Últimas visitas */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Mis últimas visitas</h2>
          {data.recent_checkins.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Aún no tienes visitas registradas.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.recent_checkins.slice(0, 8).map((c, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {new Date(c.checked_at).toLocaleDateString('es-MX', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(c.checked_at).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {c.duration_min != null ? ` · ${fmtMin(c.duration_min)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Hecho con <Dumbbell className="inline size-3" aria-hidden="true" /> {data.gym.name} ·
          enlace personal e intransferible
        </p>
      </main>

      {/* Dialog: QR + cambiar foto */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="size-5 text-primary" /> Tu QR de check-in
            </DialogTitle>
            <DialogDescription>
              Muéstralo en recepción para registrar tu entrada. También puedes actualizar tu foto.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl border border-border bg-white p-3">
              {qr ? (
                <img src={qr} alt={`QR de ${data.member.full_name}`} className="size-52" />
              ) : (
                <Skeleton className="size-52" />
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium transition-colors hover:bg-accent active:scale-[0.98]">
              <Camera className="size-4" aria-hidden="true" />
              {uploading ? 'Subiendo…' : 'Cambiar mi foto'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadPhoto(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}