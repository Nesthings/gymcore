import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Dumbbell,
  History,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'

import { EquipmentShape } from '@/components/equipment/EquipmentShape'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import {
  ASSET_STATUS_META,
  addMaintenanceTask,
  applyRecommendations,
  completeMaintenance,
  createIncident,
  deleteAsset,
  duplicateAsset,
  fetchAsset,
  fmtDate,
  INCIDENT_CATEGORIES,
  INCIDENT_PRIORITY_META,
  INCIDENT_STATUS_META,
  retireAsset,
  TASK_STATUS_META,
  TASK_TYPE_LABELS,
  updateAsset,
  updateIncident,
  updateMaintenanceTask,
  type EquipmentDetail,
} from '@/lib/equipment'
import { cn } from '@/lib/utils'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-all text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  )
}

export function EquipmentDetailDialog({
  open,
  onOpenChange,
  assetId,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string | null
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<EquipmentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [tab, setTab] = useState('mantenimiento')
  const [confirmRetire, setConfirmRetire] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newTask, setNewTask] = useState({ name: '', days: '' })
  const [completeFor, setCompleteFor] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    if (!assetId) return
    setLoading(true)
    setError(null)
    try {
      setDetail(await fetchAsset(assetId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el equipo')
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    if (open && assetId) {
      setEditMode(false)
      setTab('mantenimiento')
      load()
    }
  }, [open, assetId, load])

  const d = detail
  if (!open) return null

  const statusMeta = d ? ASSET_STATUS_META[d.status] : null

  const enterEdit = () => {
    setEditing({
      custom_name: d?.custom_name ?? '',
      asset_number: d?.asset_number ?? '',
      serial_number: d?.serial_number ?? '',
      notes: d?.notes ?? '',
      width: d?.width_m != null ? String(d.width_m) : '',
      depth: d?.depth_m != null ? String(d.depth_m) : '',
    })
    setEditMode(true)
  }

  const saveEdit = async () => {
    setBusy(true)
    try {
      await updateAsset(d!.id, {
        custom_name: editing.custom_name || null,
        asset_number: editing.asset_number || null,
        serial_number: editing.serial_number || null,
        notes: editing.notes || null,
        width_m: editing.width ? Number(editing.width) : null,
        depth_m: editing.depth ? Number(editing.depth) : null,
      })
      toast({ title: 'Equipo actualizado', variant: 'success' })
      setEditMode(false)
      load()
      onChanged()
    } catch (err) {
      toast({ title: 'No se pudo guardar', description: err instanceof Error ? err.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const doDuplicate = async () => {
    setBusy(true)
    try {
      await duplicateAsset(d!.id)
      toast({ title: 'Equipo duplicado', variant: 'success' })
      onChanged()
      load()
    } catch (err) {
      toast({ title: 'No se pudo duplicar', description: err instanceof Error ? err.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const doRetire = async () => {
    setBusy(true)
    try {
      await retireAsset(d!.id)
      toast({ title: 'Equipo retirado', description: 'Conserva su historial.', variant: 'success' })
      setConfirmRetire(false)
      onChanged()
      load()
    } catch (err) {
      toast({ title: 'No se pudo retirar', description: err instanceof Error ? err.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    setBusy(true)
    try {
      await deleteAsset(d!.id)
      toast({ title: 'Equipo eliminado', variant: 'success' })
      setConfirmDelete(false)
      onOpenChange(false)
      onChanged()
    } catch (err) {
      toast({ title: 'No se pudo eliminar', description: err instanceof Error ? err.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const addTask = async () => {
    if (!newTask.name.trim() || !(Number(newTask.days) > 0)) return
    setBusy(true)
    try {
      await addMaintenanceTask(d!.id, {
        name: newTask.name.trim(),
        task_type: 'inspection',
        interval_days: Number(newTask.days),
        frequency: 'custom',
      })
      setNewTask({ name: '', days: '' })
      toast({ title: 'Tarea creada', variant: 'success' })
      load()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const applyRecs = async () => {
    setBusy(true)
    try {
      const res = await applyRecommendations(d!.id)
      toast({ title: 'Recomendaciones aplicadas', description: `${res.created} tareas nuevas`, variant: 'success' })
      load()
    } catch (err) {
      toast({ title: 'No se pudieron aplicar', description: err instanceof Error ? err.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const resolveIncident = async (incident: { id: string; took_out_of_service: boolean }) => {
    setBusy(true)
    try {
      await updateIncident(incident.id, {
        status: 'resolved',
        back_to_service: incident.took_out_of_service ? true : undefined,
      })
      toast({ title: 'Incidencia resuelta', variant: 'success' })
      onChanged()
      load()
    } catch (err) {
      toast({ title: 'No se pudo resolver', description: err instanceof Error ? err.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const canDelete = d && d.maintenance_history.length === 0 && d.incidents.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="size-5 text-primary" /> Detalle del equipo
          </DialogTitle>
          <DialogDescription>Información, mantenimiento, historial e incidencias.</DialogDescription>
        </DialogHeader>

        {loading && !d && (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando equipo…
          </p>
        )}
        {error && !d && <p className="py-6 text-sm text-destructive">{error}</p>}

        {d && (
          <div className="space-y-4">
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="h-20 w-28 shrink-0 rounded-lg border border-border bg-card p-1">
                  <EquipmentShape typeName={d.type_name} categoryName={d.category_name} status={d.status} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{d.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[d.brand_name, d.model_name, d.asset_number].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {statusMeta && (
                      <Badge variant={statusMeta.variant as never}>
                        <span className={cn('mr-1 size-1.5 rounded-full', statusMeta.dot)} /> {statusMeta.label}
                      </Badge>
                    )}
                    {d.open_incidents > 0 && (
                      <Badge variant="soft-destructive">
                        <ShieldAlert className="size-3" /> {d.open_incidents} incidencia{d.open_incidents > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon-sm" variant="ghost" aria-label="Editar" title="Editar" onClick={enterEdit}>
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Duplicar" title="Duplicar" onClick={doDuplicate} disabled={busy}>
                  <Copy />
                </Button>
              </div>
            </div>

            {/* Datos */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-3">
              <InfoRow label="Marca" value={d.brand_name} />
              <InfoRow label="Modelo" value={d.model_name} />
              <InfoRow label="Tipo" value={d.type_name} />
              <InfoRow label="Categoría" value={d.category_name} />
              <InfoRow label="Activo" value={d.asset_number} />
              <InfoRow label="No. serie" value={d.serial_number} />
              <InfoRow label="Dimensiones" value={d.width_m && d.depth_m ? `${d.width_m} × ${d.depth_m} m` : '—'} />
              <InfoRow label="Instalación" value={fmtDate(d.installation_date)} />
              <InfoRow label="Próximo mantenimiento" value={fmtDate(d.next_due_at)} />
            </div>

            {editMode && (
              <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nombre</Label>
                  <Input value={editing.custom_name ?? ''} onChange={(e) => setEditing((s) => ({ ...s, custom_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Número de activo</Label>
                  <Input value={editing.asset_number ?? ''} onChange={(e) => setEditing((s) => ({ ...s, asset_number: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>No. de serie</Label>
                  <Input value={editing.serial_number ?? ''} onChange={(e) => setEditing((s) => ({ ...s, serial_number: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Ancho (m)</Label>
                    <Input type="number" step="0.1" value={editing.width ?? ''} onChange={(e) => setEditing((s) => ({ ...s, width: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fondo (m)</Label>
                    <Input type="number" step="0.1" value={editing.depth ?? ''} onChange={(e) => setEditing((s) => ({ ...s, depth: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Notas</Label>
                  <Textarea value={editing.notes ?? ''} onChange={(e) => setEditing((s) => ({ ...s, notes: e.target.value }))} rows={2} />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button size="sm" onClick={saveEdit} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Guardar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
                </div>
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="mantenimiento"><Wrench className="size-4" /> Mantenimiento</TabsTrigger>
                <TabsTrigger value="historial"><History className="size-4" /> Historial</TabsTrigger>
                <TabsTrigger value="incidencias"><AlertTriangle className="size-4" /> Incidencias</TabsTrigger>
              </TabsList>

              <TabsContent value="mantenimiento" className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={applyRecs} disabled={busy}>
                    <Sparkles className="size-4" /> Aplicar recomendaciones
                  </Button>
                </div>
                {d.maintenance.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin tareas de mantenimiento programadas.</p>
                )}
                {d.maintenance.map((t) => {
                  const st = TASK_STATUS_META[t.status] ?? TASK_STATUS_META.scheduled
                  return (
                    <div key={t.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{t.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {TASK_TYPE_LABELS[t.task_type] ?? t.task_type} · cada {t.interval_days} días
                            {t.manufacturer_recommended && ' · fabricante'}
                          </p>
                        </div>
                        <Badge variant={st.variant as never}>{st.label}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Próximo: {fmtDate(t.next_due_at)}
                        </span>
                        <div className="ml-auto flex gap-1.5">
                          <Button size="sm" onClick={() => setCompleteFor(t.id)}>
                            <CheckCircle2 /> Completar
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Deshabilitar"
                            title="Deshabilitar"
                            onClick={async () => {
                              await updateMaintenanceTask(d.id, t.id, { disabled: true })
                              load()
                            }}
                          >
                            <X />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Nueva tarea */}
                <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-3">
                  <div className="flex-1 space-y-1">
                    <Label>Nueva tarea</Label>
                    <Input
                      value={newTask.name}
                      onChange={(e) => setNewTask((s) => ({ ...s, name: e.target.value }))}
                      placeholder="Ej. Lubricación de guías"
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label>Días</Label>
                    <Input type="number" min="1" value={newTask.days} onChange={(e) => setNewTask((s) => ({ ...s, days: e.target.value }))} />
                  </div>
                  <Button size="sm" variant="outline" onClick={addTask} disabled={busy}>
                    <Plus /> Crear
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="historial" className="space-y-2">
                {d.maintenance_history.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aún no hay mantenimientos registrados.</p>
                )}
                {d.maintenance_history.map((r, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{r.task_name}</p>
                      <Badge variant="soft-success">Completado</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(r.completed_at)}</p>
                    {r.notes && <p className="mt-1 text-xs">{r.notes}</p>}
                    {r.replaced_parts && r.replaced_parts.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Piezas: {r.replaced_parts.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="incidencias" className="space-y-2">
                <Button size="sm" variant="outline" onClick={() => setReportOpen(true)}>
                  <AlertTriangle /> Reportar problema
                </Button>
                {d.incidents.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin incidencias registradas.</p>
                )}
                {d.incidents.map((inc) => {
                  const st = INCIDENT_STATUS_META[inc.status] ?? INCIDENT_STATUS_META.open
                  const pr = INCIDENT_PRIORITY_META[inc.priority] ?? INCIDENT_PRIORITY_META.medium
                  const openInc = inc.status === 'open' || inc.status === 'in_progress'
                  return (
                    <div key={inc.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{inc.title}</p>
                        <div className="flex gap-1">
                          <Badge variant={pr.variant as never}>{pr.label}</Badge>
                          <Badge variant={st.variant as never}>{st.label}</Badge>
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(inc.created_at)}</p>
                      {inc.description && <p className="mt-1 text-xs">{inc.description}</p>}
                      {inc.resolution_notes && (
                        <p className="mt-1 text-xs text-muted-foreground">Resolución: {inc.resolution_notes}</p>
                      )}
                      {openInc && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveIncident(inc)}
                            disabled={busy}
                          >
                            <CheckCircle2 /> Marcar resuelto
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </TabsContent>
            </Tabs>

            {/* Acciones destructivas */}
            {d.status !== 'retirado' && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmRetire(true)} disabled={busy}>
                  <Trash2 /> Retirar equipo
                </Button>
                {canDelete && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)} disabled={busy}>
                    Eliminar
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmRetire}
        onOpenChange={setConfirmRetire}
        title="¿Retirar este equipo?"
        description="Dejará de ser operativo pero conservará su historial de mantenimiento e incidencias."
        confirmLabel="Retirar"
        variant="destructive"
        busy={busy}
        onConfirm={doRetire}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar este equipo?"
        description="Solo se permite si no tiene historial. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        busy={busy}
        onConfirm={doDelete}
      />

      {completeFor && d && (
        <CompleteMaintenanceDialog
          assetId={d.id}
          task={d.maintenance.find((t) => t.id === completeFor)}
          onClose={() => setCompleteFor(null)}
          onDone={() => {
            setCompleteFor(null)
            load()
            onChanged()
          }}
        />
      )}

      {reportOpen && d && (
        <ReportIncidentDialog
          assetId={d.id}
          onClose={() => setReportOpen(false)}
          onDone={() => {
            setReportOpen(false)
            load()
            onChanged()
          }}
        />
      )}
    </Dialog>
  )
}

function CompleteMaintenanceDialog({
  assetId,
  task,
  onClose,
  onDone,
}: {
  assetId: string
  task?: { id: string; name: string } | null
  onClose: () => void
  onDone: () => void
}) {
  const [notes, setNotes] = useState('')
  const [cost, setCost] = useState('')
  const [parts, setParts] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const submit = async () => {
    if (!task) return
    setBusy(true)
    try {
      await completeMaintenance(assetId, task.id, {
        notes: notes.trim() || null,
        cost: cost ? Number(cost) : null,
        replaced_parts: parts.split(',').map((p) => p.trim()).filter(Boolean),
      })
      toast({ title: 'Mantenimiento completado', variant: 'success' })
      onDone()
    } catch (err) {
      toast({ title: 'No se pudo completar', description: err instanceof Error ? err.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Completar mantenimiento</DialogTitle>
          <DialogDescription>Registra la tarea «{task?.name}» como completada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Costo (MXN)</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1">
              <Label>Piezas reemplazadas</Label>
              <Input value={parts} onChange={(e) => setParts(e.target.value)} placeholder="Cable, rodamiento…" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Marcar completado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReportIncidentDialog({
  assetId,
  onClose,
  onDone,
}: {
  assetId: string
  onClose: () => void
  onDone: () => void
}) {
  const [category, setCategory] = useState('otro')
  const [priority, setPriority] = useState('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [outOfService, setOutOfService] = useState(false)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const submit = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      await createIncident(assetId, {
        category,
        priority,
        title: title.trim(),
        description: description.trim() || null,
        take_out_of_service: outOfService,
      })
      toast({ title: 'Incidencia reportada', variant: 'success' })
      onDone()
    } catch (err) {
      toast({ title: 'No se pudo reportar', description: err instanceof Error ? err.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar problema</DialogTitle>
          <DialogDescription>Registra una falla o incidencia del equipo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Ruido extraño en la cinta" />
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={outOfService}
              onChange={(e) => setOutOfService(e.target.checked)}
              className="size-4 accent-[var(--destructive)]"
            />
            Marcar equipo fuera de servicio
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !title.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <AlertTriangle />} Reportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}