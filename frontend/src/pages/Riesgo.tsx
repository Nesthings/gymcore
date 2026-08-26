import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, TrendingDown, Users } from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatChip } from '@/components/ui/stat-chip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiFetch } from '@/lib/api'
import { cn, formatDateTime } from '@/lib/utils'

interface RiskMember {
  id: string
  full_name: string
  email?: string | null
  phone?: string | null
  membership_name?: string | null
  last_checkin?: string | null
  days_inactive: number
  risk_score: number
  risk_level: 'critical' | 'warning' | 'info'
}

const LEVEL_BADGE: Record<string, 'destructive' | 'warning' | 'info'> = {
  critical: 'destructive',
  warning: 'warning',
  info: 'info',
}

const LEVEL_LABEL: Record<string, string> = {
  critical: 'Crítico',
  warning: 'Importante',
  info: 'Informativo',
}

function RiskRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-14" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
    </TableRow>
  )
}

export function Riesgo() {
  const [members, setMembers] = useState<RiskMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setMembers(await apiFetch<RiskMember[]>('/risk/members'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los socios en riesgo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const critical = members.filter((m) => m.risk_level === 'critical').length
  const warning = members.filter((m) => m.risk_level === 'warning').length

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Riesgo de abandono</h1>
          <p className="text-sm text-muted-foreground">
            Socios con baja asistencia que podrían cancelar su membresía
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} aria-hidden="true" />
          Actualizar
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatChip label="Socios en riesgo" value={members.length} icon={Users} tint="bg-rose-500/10 text-rose-600" />
        <StatChip label="Críticos" value={critical} icon={TrendingDown} tint="bg-destructive/10 text-destructive" />
        <StatChip label="Importantes" value={warning} icon={TrendingDown} tint="bg-warning/10 text-warning" />
      </div>

      {error && <ErrorState description={error} onRetry={load} className="mb-6" />}
      {loading && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Membresía</TableHead>
                <TableHead>Días sin visitar</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Último check-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[0, 1, 2, 3, 4].map((i) => (
                <RiskRowSkeleton key={i} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && !error && members.length === 0 && (
        <EmptyState
          title="Sin socios en riesgo"
          description="Todos los socios han visitado el gimnasio recientemente."
          icon={TrendingDown}
        />
      )}

      {!loading && !error && members.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Membresía</TableHead>
                <TableHead>Días sin visitar</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Último check-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link
                      to={`/socios/${m.id}`}
                      className="font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {m.full_name}
                    </Link>
                    {m.email && (
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    )}
                  </TableCell>
                  <TableCell>{m.membership_name ?? '—'}</TableCell>
                  <TableCell>
                    <span className="font-medium">{m.days_inactive} días</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={LEVEL_BADGE[m.risk_level] ?? 'info'}>
                      {LEVEL_LABEL[m.risk_level] ?? m.risk_level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.last_checkin ? formatDateTime(m.last_checkin) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppLayout>
  )
}