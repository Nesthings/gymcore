import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, TrendingDown, Users } from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { RiskScoreRing } from '@/components/risk/RiskScoreRing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { ListToolbar } from '@/components/ui/list-toolbar'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination, pageCountFor, paginate } from '@/components/ui/pagination'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [sort, setSort] = useState<'risk_desc' | 'risk_asc' | 'days_desc' | 'name_asc'>('risk_desc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = members.filter(
      (m) =>
        (level === 'all' || m.risk_level === level) &&
        (!q || m.full_name.toLowerCase().includes(q)),
    )
    const sorted = [...list]
    if (sort === 'risk_asc') sorted.sort((a, b) => a.risk_score - b.risk_score)
    else if (sort === 'risk_desc') sorted.sort((a, b) => b.risk_score - a.risk_score)
    else if (sort === 'days_desc') sorted.sort((a, b) => b.days_inactive - a.days_inactive)
    else sorted.sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))
    return sorted
  }, [members, search, level, sort])

  useEffect(() => {
    setPage(1)
  }, [search, level, sort])

  const pageCount = pageCountFor(filtered.length, PAGE_SIZE)
  const paged = paginate(filtered, page, PAGE_SIZE)

  const critical = members.filter((m) => m.risk_level === 'critical').length
  const warning = members.filter((m) => m.risk_level === 'warning').length

  return (
    <AppLayout>
      <PageHeader
        title="Riesgo de abandono"
        subtitle="Socios con baja asistencia que podrían cancelar su membresía"
        icon={TrendingDown}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} aria-hidden="true" />
            Actualizar
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatChip label="Socios en riesgo" value={members.length} icon={Users} tint="bg-destructive/10 text-destructive" />
        <StatChip label="Críticos" value={critical} icon={TrendingDown} tint="bg-destructive/10 text-destructive" />
        <StatChip label="Importantes" value={warning} icon={TrendingDown} tint="bg-warning/10 text-warning" />
      </div>

      {error && <ErrorState description={error} onRetry={load} className="mb-6" />}

      {!loading && !error && members.length > 0 && (
        <ListToolbar>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Buscar socio…"
            className="w-full sm:w-64"
            aria-label="Buscar socio"
          />
          <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
            <SelectTrigger className="w-44" aria-label="Filtrar por nivel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los niveles</SelectItem>
              <SelectItem value="critical">Críticos</SelectItem>
              <SelectItem value="warning">Importantes</SelectItem>
              <SelectItem value="info">Informativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-48" aria-label="Ordenar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="risk_desc">Mayor riesgo</SelectItem>
              <SelectItem value="risk_asc">Menor riesgo</SelectItem>
              <SelectItem value="days_desc">Más días sin visitar</SelectItem>
              <SelectItem value="name_asc">Nombre (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </ListToolbar>
      )}

      {loading && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Membresía</TableHead>
                <TableHead>Días sin visitar</TableHead>
                <TableHead>Riesgo</TableHead>
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

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={members.length === 0 ? 'Sin socios en riesgo' : 'Sin resultados'}
          description={
            members.length === 0
              ? 'Todos los socios han visitado el gimnasio recientemente.'
              : 'Ajusta la búsqueda o los filtros.'
          }
          icon={TrendingDown}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Socio</TableHead>
                  <TableHead>Membresía</TableHead>
                  <TableHead>Días sin visitar</TableHead>
                  <TableHead>Riesgo</TableHead>
                  <TableHead>Último check-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link
                        to={`/socios/${m.id}`}
                        className="font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {m.full_name}
                      </Link>
                    </TableCell>
                    <TableCell>{m.membership_name ?? '—'}</TableCell>
                    <TableCell>
                      <span className="font-medium">{m.days_inactive} días</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <RiskScoreRing score={m.risk_score} size={36} stroke={3} />
                        <Badge variant={LEVEL_BADGE[m.risk_level] ?? 'info'}>
                          {LEVEL_LABEL[m.risk_level] ?? m.risk_level}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.last_checkin ? formatDateTime(m.last_checkin) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </AppLayout>
  )
}