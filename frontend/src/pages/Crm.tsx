import { useCallback, useEffect, useState } from 'react'
import { Plus, Target, TrendingUp, Users } from 'lucide-react'

import { LeadCard } from '@/components/crm/LeadCard'
import { LeadFormDialog, PIPELINE_STAGES, STAGE_LABELS, type Lead } from '@/components/crm/LeadFormDialog'
import { PipelineColumn } from '@/components/crm/PipelineColumn'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { StatChip } from '@/components/ui/stat-chip'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { AppLayout } from '@/components/layout/AppLayout'

interface PipelineStat {
  status: string
  count: number
  value: number
}

const STAGE_DOTS: Record<string, string> = {
  nuevo: 'bg-info',
  contacto: 'bg-primary',
  propuesta: 'bg-warning',
  ganado: 'bg-success',
  perdido: 'bg-destructive',
}

export function Crm() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<PipelineStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [leadsRes, statsRes] = await Promise.all([
        apiFetch<Lead[]>('/leads'),
        apiFetch<{ pipeline: PipelineStat[] }>('/leads/pipeline-stats'),
      ])
      setLeads(leadsRes)
      setStats(statsRes.pipeline)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el pipeline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const totalLeads = stats.reduce((sum, s) => sum + s.count, 0) || leads.length
  const pipelineValue =
    stats.filter((s) => s.status !== 'perdido').reduce((sum, s) => sum + s.value, 0) ||
    leads.filter((l) => l.status !== 'perdido').reduce((sum, l) => sum + (l.value ?? 0), 0)
  const won = stats.find((s) => s.status === 'ganado')?.count ?? leads.filter((l) => l.status === 'ganado').length
  const conversion = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0

  const moveLead = async (lead: Lead, direction: 'back' | 'forward') => {
    const index = PIPELINE_STAGES.indexOf(lead.status)
    const nextIndex = index + (direction === 'forward' ? 1 : -1)
    if (nextIndex < 0 || nextIndex >= PIPELINE_STAGES.length) return
    const nextStatus = PIPELINE_STAGES[nextIndex]
    try {
      await apiFetch(`/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      toast({
        title: 'Lead movido de etapa',
        description: `${lead.name} ahora está en ${STAGE_LABELS[nextStatus]}.`,
        variant: 'success',
      })
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover el lead')
    }
  }

  const deleteLead = async () => {
    if (!confirmDelete) return
    try {
      await apiFetch(`/leads/${confirmDelete.id}`, { method: 'DELETE' })
      toast({ title: 'Lead eliminado', description: `${confirmDelete.name} se quitó del pipeline.`, variant: 'success' })
      setConfirmDelete(null)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el lead')
    }
  }

  return (
    <AppLayout>
    <div className="mx-auto w-full max-w-[1400px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM · Pipeline de leads</h1>
          <p className="text-sm text-muted-foreground">
            Prospectos y oportunidades de venta en cada etapa del embudo
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus /> Nuevo lead
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatChip label="Total de leads" value={totalLeads} icon={Users} tint="bg-info/10 text-info" />
        <StatChip
          label="Valor del pipeline"
          value={new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(pipelineValue)}
          icon={Target}
          tint="bg-primary/10 text-primary"
        />
        <StatChip
          label="Tasa de conversión"
          value={`${conversion}%`}
          icon={TrendingUp}
          tint="bg-success/10 text-success"
        />
      </div>

      {error && <ErrorState description={error} onRetry={refresh} className="mb-6" />}
      {loading && <LoadingState label="Cargando pipeline…" />}

      {!loading && !error && leads.length === 0 && (
        <EmptyState
          title="El pipeline está vacío"
          description="Registra tu primer lead para empezar a dar seguimiento a prospectos."
          icon={Users}
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus /> Nuevo lead
            </Button>
          }
        />
      )}

      {!loading && !error && leads.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.status === stage)
            const stat = stats.find((s) => s.status === stage)
            const value = stat?.value ?? stageLeads.reduce((sum, l) => sum + (l.value ?? 0), 0)
            const stageIndex = PIPELINE_STAGES.indexOf(stage)
            return (
              <PipelineColumn
                key={stage}
                title={STAGE_LABELS[stage] ?? stage}
                count={stat?.count ?? stageLeads.length}
                value={value}
                dotClass={STAGE_DOTS[stage] ?? 'bg-muted-foreground'}
              >
                {stageLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    canMoveBack={stageIndex > 0}
                    canMoveForward={stageIndex < PIPELINE_STAGES.length - 1}
                    onMove={moveLead}
                    onEdit={(l) => {
                      setEditing(l)
                      setFormOpen(true)
                    }}
                    onDelete={setConfirmDelete}
                  />
                ))}
              </PipelineColumn>
            )
          })}
        </div>
      )}

      <LeadFormDialog
        open={formOpen}
        lead={editing}
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
        title={confirmDelete ? `¿Eliminar a ${confirmDelete.name} del pipeline?` : ''}
        description="El lead se eliminará de forma permanente."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={deleteLead}
      />
    </div>
    </AppLayout>
  )
}