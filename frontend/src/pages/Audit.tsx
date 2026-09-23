import { useCallback, useEffect, useMemo, useState } from 'react'
import { History } from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination, pageCountFor, paginate } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiFetch } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

interface AuditEntry {
  id: string
  actor_type: string
  actor_id: string
  action: string
  entity_type: string
  entity_id: string
  created_at: string
}

const ACTIONS: Record<string, string> = {
  member_created: 'Socio creado',
  member_updated: 'Socio editado',
  member_share_revoked: 'Invitación revocada',
  photo_uploaded: 'Foto de socio subida',
  membership_created: 'Membresía creada',
  membership_renewed: 'Membresía renovada',
  membership_cancelled: 'Membresía cancelada',
  payment_registered: 'Pago registrado',
  checkin_created: 'Check-in registrado',
  lead_created: 'Lead creado',
  lead_converted: 'Lead convertido',
  user_deactivated: 'Usuario desactivado',
  branch_created: 'Sucursal creada',
  branch_updated: 'Sucursal editada',
  gym_logo_updated: 'Logo del gimnasio actualizado',
  staff_photo_updated: 'Foto de staff actualizada',
}

const ENTITY_LABELS: Record<string, string> = {
  member: 'Socio',
  membership: 'Membresía',
  membership_plan: 'Plan',
  payment: 'Pago',
  checkin: 'Check-in',
  lead: 'Lead',
  user: 'Usuario',
  branch: 'Sucursal',
  gym: 'Gimnasio',
  product: 'Producto',
  sale: 'Venta',
  equipment: 'Equipo',
}

export function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [action, setAction] = useState('all')
  const [entityType, setEntityType] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (entityType !== 'all') params.set('entity_type', entityType)
      if (action !== 'all') params.set('action', action)
      const res = await apiFetch<AuditEntry[]>(`/audit?${params}`)
      setEntries(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la bitácora')
    } finally {
      setLoading(false)
    }
  }, [action, entityType])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [action, entityType])

  const pageCount = pageCountFor(entries.length, PAGE_SIZE)
  const paged = useMemo(() => paginate(entries, page, PAGE_SIZE), [entries, page])

  return (
    <AppLayout>
      <PageHeader
        title="Bitácora de auditoría"
        subtitle="Registro de cambios: socios, membresías, pagos y check-ins"
        icon={History}
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Acción</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger id="audit-action" className="w-56" aria-label="Filtrar por acción">
              <SelectValue placeholder="Todas las acciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              {Object.entries(ACTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-entity">Entidad</Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger id="audit-entity" className="w-44" aria-label="Filtrar por entidad">
              <SelectValue placeholder="Todas las entidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las entidades</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <ErrorState description={error} onRetry={load} className="mb-6" />}
      {loading && <LoadingState label="Cargando bitácora…" />}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          title="Sin registros"
          description="Los cambios (socios, membresías, pagos, check-ins) aparecerán aquí."
          icon={History}
        />
      )}

      {!loading && !error && entries.length > 0 && (
        <>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(e.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ACTIONS[e.action] ?? e.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="font-medium">
                      {ENTITY_LABELS[e.entity_type] ?? e.entity_type}
                    </span>
                    <span className="ml-1 font-mono text-muted-foreground">
                      {e.entity_id.slice(0, 8)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.actor_type === 'user' ? 'soft-info' : 'secondary'}>
                      {e.actor_type === 'user' ? 'Usuario' : e.actor_type}
                    </Badge>
                    <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                      {e.actor_id.slice(0, 8)}
                    </span>
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
