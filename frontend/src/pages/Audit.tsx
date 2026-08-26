import { useCallback, useState } from 'react'
import { History } from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
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
  action: string
  entity_type: string
  entity_id: string
  metadata_json?: Record<string, unknown> | null
  created_at: string
}

export function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (entityType) params.set('entity_type', entityType)
      if (action) params.set('action', action)
      const res = await apiFetch<AuditEntry[]>(`/audit?${params}`)
      setEntries(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la bitácora')
    } finally {
      setLoading(false)
    }
  }, [action, entityType])

  const ACTIONS: Record<string, string> = {
    member_created: 'Socio creado',
    member_updated: 'Socio editado',
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

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Bitácora de auditoría
          </h1>
          <p className="text-sm text-muted-foreground">
            Registro de cambios: socios, membresías, pagos y check-ins
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Acción</Label>
          <Input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="ej. member_created"
            className="w-56"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Entidad</Label>
          <Input
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="ej. member"
            className="w-44"
          />
        </div>
        <Button onClick={load} disabled={loading}>
          Filtrar
        </Button>
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
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(e.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ACTIONS[e.action] ?? e.action}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.entity_type}:{e.entity_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.actor_type === 'admin' ? 'soft-info' : 'secondary'}>
                      {e.actor_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.metadata_json ? JSON.stringify(e.metadata_json) : '—'}
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