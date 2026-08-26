import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Dumbbell, Pencil, Plus, Trash2, Users } from 'lucide-react'

import { MemberFormDialog } from '@/components/members/MemberFormDialog'
import { RiskBadge } from '@/components/members/RiskBadge'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AppLayout } from '@/components/layout/AppLayout'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface MemberSummary {
  id: string
  full_name: string
  email?: string | null
  phone?: string | null
  photo_url?: string | null
  status: string
  joined_at: string
  membership?: {
    id: string
    plan_name?: string | null
    status?: string
    expires_at?: string | null
  } | null
  risk_level?: string | null
}

type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_META: Record<string, { label: string; variant: 'soft-success' | 'soft-secondary' }> = {
  active: { label: 'Activo', variant: 'soft-success' },
  inactive: { label: 'Inactivo', variant: 'soft-secondary' },
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
]

export function Members() {
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MemberSummary | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<MemberSummary | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(
      () => {
        ;(async () => {
          try {
            const params = new URLSearchParams()
            if (search.trim()) params.set('search', search.trim())
            if (statusFilter !== 'all') params.set('status', statusFilter)
            params.set('limit', '200')
            const res = await apiFetch<MemberSummary[]>(`/members?${params}`)
            if (!cancelled) {
              setMembers(res)
              setLoaded(true)
            }
          } catch (err) {
            if (!cancelled) {
              setError(err instanceof Error ? err.message : 'No se pudieron cargar los socios')
            }
          }
        })()
      },
      search.trim() || statusFilter !== 'all' ? 120 : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search, statusFilter, refreshKey])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await apiFetch(`/members/${confirmDelete.id}`, { method: 'DELETE' })
      toast({
        title: 'Socio dado de baja',
        description: `${confirmDelete.full_name} fue eliminado del padrón.`,
        variant: 'success',
      })
      setConfirmDelete(null)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dar de baja al socio')
    }
  }

  return (
    <AppLayout>
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Socios</h1>
          <p className="text-sm text-muted-foreground">Padrón y membresías de los miembros del gimnasio</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus /> Nuevo socio
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Buscar por nombre, correo o teléfono…"
          className="max-w-md"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estado
          </span>
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-glow'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && <ErrorState description={error} onRetry={refresh} className="mb-6" />}

      {!loaded && !error && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="hidden md:table-cell">Membresía</TableHead>
                <TableHead className="hidden lg:table-cell">Riesgo</TableHead>
                <TableHead className="hidden xl:table-cell">Alta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="size-9 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-6 w-16" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {loaded && !error && members.length === 0 && !search.trim() && (
        <EmptyState
          title="Aún no hay socios"
          description="Registra a tu primer socio para empezar a gestionar membresías, pagos y check-ins."
          icon={Dumbbell}
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus /> Registrar socio
            </Button>
          }
        />
      )}

      {loaded && !error && members.length === 0 && search.trim() && (
        <EmptyState
          title="Sin resultados"
          description={`Ningún socio coincide con «${search.trim()}».`}
          icon={Users}
        />
      )}

      {loaded && !error && members.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="hidden md:table-cell">Membresía</TableHead>
                <TableHead className="hidden lg:table-cell">Riesgo</TableHead>
                <TableHead className="hidden xl:table-cell">Alta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const status = STATUS_META[m.status] ?? {
                  label: m.status ?? '—',
                  variant: 'soft-secondary' as const,
                }
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          src={m.photo_url}
                          name={m.full_name}
                          className="size-9 border-2 border-primary/20"
                        />
                        <div className="min-w-0">
                          <Link
                            to={`/socios/${m.id}`}
                            title="Abrir ficha del socio"
                            className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
                          >
                            <span className="truncate">{m.full_name}</span>
                            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            <Badge variant={status.variant} className="mr-1.5">
                              {status.label}
                            </Badge>
                            {m.phone ?? 'Sin teléfono'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{m.email ?? '—'}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {m.membership?.plan_name ? (
                        <span className="text-sm">
                          <span className="font-medium">{m.membership.plan_name}</span>
                          {m.membership.expires_at && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ·{' '}
                              {new Date(m.membership.expires_at).toLocaleDateString('es-MX', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <RiskBadge level={m.risk_level} />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                      <span className="text-sm">
                        {new Date(m.joined_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          asChild
                          aria-label={`Ver ${m.full_name}`}
                        >
                          <Link to={`/socios/${m.id}`}>
                            <ArrowUpRight />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${m.full_name}`}
                          onClick={() => {
                            setEditing(m)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Dar de baja a ${m.full_name}`}
                          className="text-destructive"
                          onClick={() => setConfirmDelete(m)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <MemberFormDialog
        open={formOpen}
        member={editing}
        onOpenChange={setFormOpen}
        onSaved={() => {
          setFormOpen(false)
          setEditing(null)
          refresh()
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={confirmDelete ? `¿Dar de baja a ${confirmDelete.full_name}?` : ''}
        description="El socio dejará de tener acceso y su membresía activa se cancelará."
        confirmLabel="Dar de baja"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
    </AppLayout>
  )
}