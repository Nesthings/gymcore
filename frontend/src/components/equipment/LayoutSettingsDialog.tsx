import { useState } from 'react'
import { DoorOpen, Plus, Save, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { useToast } from '@/components/ui/toast'
import type { GymLayoutConfig, Room, Zone } from '@/lib/equipment'
import { saveLayout } from '@/lib/equipment'

const ZONE_COLORS = ['#19e68c', '#8af5c5', '#f5c451', '#ff5c5c', '#4d9de0', '#c084fc']

export function LayoutSettingsDialog({
  open,
  onOpenChange,
  layout,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  layout: GymLayoutConfig
  onSaved: (next: GymLayoutConfig) => void
}) {
  const [width, setWidth] = useState(String(layout.width_m))
  const [length, setLength] = useState(String(layout.length_m))
  const [notice, setNotice] = useState(String(layout.notice_days))
  const [zones, setZones] = useState<Zone[]>(layout.zones)
  const [rooms, setRooms] = useState<Room[]>(layout.rooms)
  const [newZone, setNewZone] = useState('')
  const [newRoom, setNewRoom] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const save = async () => {
    setBusy(true)
    try {
      const next = await saveLayout({
        width_m: Number(width) || 30,
        length_m: Number(length) || 18,
        notice_days: Number(notice) || 7,
        zones,
        rooms,
      })
      toast({ title: 'Layout guardado', variant: 'success' })
      onSaved(next)
      onOpenChange(false)
    } catch (err) {
      toast({ title: 'No se pudo guardar', description: err instanceof Error ? err.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const addZone = () => {
    const name = newZone.trim()
    if (!name) return
    setZones((z) => [
      ...z,
      { id: crypto.randomUUID(), name, color: ZONE_COLORS[z.length % ZONE_COLORS.length] },
    ])
    setNewZone('')
  }

  const addRoom = () => {
    const name = newRoom.trim()
    if (!name) return
    setRooms((r) => [...r, { id: crypto.randomUUID(), name, width_m: 20, length_m: 12 }])
    setNewRoom('')
  }

  const patchRoom = (id: string, patch: Partial<Room>) =>
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configuración del plano</DialogTitle>
          <DialogDescription>Salas, dimensiones, zonas y aviso de mantenimiento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Sala principal */}
          <div className="space-y-2 rounded-xl border border-border bg-card p-3">
            <Label className="flex items-center gap-1.5">
              <DoorOpen className="size-4 text-primary" /> Sala principal
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Ancho (m)</Label>
                <Input type="number" step="0.5" min="1" value={width} onChange={(e) => setWidth(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Largo (m)</Label>
                <Input type="number" step="0.5" min="1" value={length} onChange={(e) => setLength(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Salas adicionales */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <DoorOpen className="size-4 text-primary" /> Salas adicionales
            </Label>
            <div className="flex gap-2">
              <Input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="Ej. Sala de cardio" />
              <Button variant="outline" size="sm" onClick={addRoom}><Plus /></Button>
            </div>
            {rooms.map((r) => (
              <div key={r.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={r.name}
                    onChange={(e) => patchRoom(r.id, { name: e.target.value })}
                    className="flex-1 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setRooms((rs) => rs.filter((x) => x.id !== r.id))}
                    aria-label={`Quitar sala ${r.name}`}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Ancho (m)</Label>
                    <Input type="number" step="0.5" min="1" value={String(r.width_m)} onChange={(e) => patchRoom(r.id, { width_m: Number(e.target.value) || 1 })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Largo (m)</Label>
                    <Input type="number" step="0.5" min="1" value={String(r.length_m)} onChange={(e) => patchRoom(r.id, { length_m: Number(e.target.value) || 1 })} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label>Aviso de mantenimiento (días antes)</Label>
            <Input type="number" min="0" max="60" value={notice} onChange={(e) => setNotice(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Zonas</Label>
            <div className="flex gap-2">
              <Input value={newZone} onChange={(e) => setNewZone(e.target.value)} placeholder="Ej. Cardio" />
              <Button variant="outline" size="sm" onClick={addZone}><Plus /></Button>
            </div>
            {zones.map((z) => (
              <div key={z.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <span className="size-3 rounded-full" style={{ background: z.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm">{z.name}</span>
                <button
                  type="button"
                  onClick={() => setZones((zs) => zs.filter((x) => x.id !== z.id))}
                  aria-label={`Quitar zona ${z.name}`}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>
            <Save /> Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}