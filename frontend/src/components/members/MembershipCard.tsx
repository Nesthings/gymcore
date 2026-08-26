import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface MembershipInfo {
  id: string
  plan_name?: string | null
  status?: string
  starts_at?: string | null
  expires_at?: string | null
  checkins_used?: number | null
  checkins_limit?: number | null
}

const STATUS_META: Record<
  string,
  { label: string; variant: 'soft-success' | 'soft-warning' | 'soft-destructive' | 'soft-secondary' }
> = {
  active: { label: 'Activa', variant: 'soft-success' },
  expiring: { label: 'Por vencer', variant: 'soft-warning' },
  expired: { label: 'Vencida', variant: 'soft-destructive' },
  cancelled: { label: 'Cancelada', variant: 'soft-secondary' },
}

const DAY_MS = 86_400_000

/**
 * MembershipCard: tarjeta del plan actual de un socio con barra de vencimiento.
 * La barra muestra el progreso del periodo; el color avisa cuando queda poco
 * tiempo (menos de 30% → ámbar, menos de 10% → rojo).
 */
export function MembershipCard({
  membership,
  className,
}: {
  membership?: MembershipInfo | null
  className?: string
}) {
  const start = membership?.starts_at ? new Date(membership.starts_at).getTime() : null
  const end = membership?.expires_at ? new Date(membership.expires_at).getTime() : null

  const { pct, hint } = useMemo(() => {
    if (start == null || end == null || end <= start) {
      return { pct: null, hint: 'Sin vencimiento' }
    }
    const now = Date.now() // eslint-disable-line react-hooks/purity -- "ahora" es deliberadamente impuro en un dashboard
    const pctValue = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
    const msLeft = end - now
    const daysLeft = msLeft <= 0 ? 0 : Math.ceil(msLeft / DAY_MS)
    if (daysLeft <= 0) return { pct: pctValue, hint: 'Vence hoy' }
    if (daysLeft === 1) return { pct: pctValue, hint: 'Vence mañana' }
    return { pct: pctValue, hint: `${daysLeft} días restantes` }
  }, [start, end])

  if (!membership) {
    return (
      <Card className={cn('rounded-2xl', className)}>
        <CardContent>
          <p className="text-sm font-medium text-foreground">Sin membresía activa</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Asigna un plan para activar el acceso del socio.
          </p>
        </CardContent>
      </Card>
    )
  }

  const meta =
    STATUS_META[membership.status ?? ''] ?? {
      label: membership.status ?? '—',
      variant: 'soft-secondary' as const,
    }

  const remaining = pct == null ? 1 : Math.max(0, 1 - pct / 100)
  const barColor =
    remaining <= 0.1 ? 'bg-destructive' : remaining <= 0.3 ? 'bg-warning' : 'bg-primary'

  return (
    <Card className={cn('rounded-2xl', className)}>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {membership.plan_name ?? 'Plan'}
            </p>
            <p className="text-xs text-muted-foreground">Membresía actual</p>
          </div>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>

        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]', barColor)}
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono tabular-nums text-muted-foreground">
              {pct == null ? '—' : `${Math.round(pct)}% del periodo`}
            </span>
            <span className="font-medium text-foreground">{hint}</span>
          </div>
        </div>

        {membership.checkins_limit != null && (
          <p className="text-xs text-muted-foreground">
            Check-ins:{' '}
            <span className="font-mono tabular-nums text-foreground">
              {membership.checkins_used ?? 0} / {membership.checkins_limit}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}