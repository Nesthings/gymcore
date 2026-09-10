import { useCallback, useEffect, useMemo, useRef, useState, Component } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check,
  Dumbbell,
  List,
  Map,
  Plus,
  RotateCw,
  Settings2,
  ShieldAlert,
  Trash2,
  Wrench,
} from 'lucide-react'

import { AddEquipmentDialog } from '@/components/equipment/AddEquipmentDialog'
import { EquipmentCanvas } from '@/components/equipment/EquipmentCanvas'
import { EquipmentDetailDialog } from '@/components/equipment/EquipmentDetailDialog'
import { EquipmentList } from '@/components/equipment/EquipmentList'
import { LayoutSettingsDialog } from '@/components/equipment/LayoutSettingsDialog'
import { OccupancyStrip } from '@/components/equipment/OccupancyStrip'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { StatChip } from '@/components/ui/stat-chip'
import { useToast } from '@/components/ui/toast'
import {
  fetchAssets,
  fetchCatalog,
  fetchLayout,
  retireAsset,
  updatePosition,
  type Catalog,
  type EquipmentAsset,
  type GymLayoutConfig,
} from '@/lib/equipment'
import { cn } from '@/lib/utils'

class CanvasBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }

  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          No se pudo dibujar el plano: {this.state.error}
        </div>
      )
    }
    return this.props.children
  }
}

export function Layout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [layout, setLayout] = useState<GymLayoutConfig | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [assets, setAssets] = useState<EquipmentAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'canvas' | 'list'>('canvas')
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [occupancyKey, setOccupancyKey] = useState(0)
  const [savedFlash, setSavedFlash] = useState(false)
  const savedTimer = useRef<number | undefined>(undefined)
  const { toast } = useToast()

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [lay, cat, list] = await Promise.all([fetchLayout(), fetchCatalog(), fetchAssets()])
      setLayout(lay)
      setCatalog(cat)
      setAssets(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el módulo Layout')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Soporte de /layout?asset=<id> (enlaces de notificaciones de mantenimiento):
  // abre el detalle del equipo y limpia el query para que "atrás" no regrese
  // a una ruta con parámetros.
  useEffect(() => {
    const assetId = searchParams.get('asset')
    if (!assetId) return
    setDetailId(assetId)
    setDetailOpen(true)
    setSelectedId(assetId)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const flashSaved = useCallback(() => {
    setSavedFlash(true)
    window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSavedFlash(false), 1400)
  }, [])

  const handleMoveEnd = useCallback(
    async (id: string, x: number, y: number) => {
      const asset = assets.find((a) => a.id === id)
      if (!asset) return
      setAssets((list) => list.map((a) => (a.id === id ? { ...a, position_x: x, position_y: y } : a)))
      flashSaved()
      try {
        await updatePosition(id, x, y, asset.rotation)
      } catch {
        toast({ title: 'No se pudo guardar la posición', variant: 'error' })
      }
    },
    [assets, flashSaved, toast],
  )

  const handleRotate = useCallback(
    async (id: string, delta: number) => {
      const asset = assets.find((a) => a.id === id)
      if (!asset) return
      const rotation = (asset.rotation + delta) % 360
      setAssets((list) => list.map((a) => (a.id === id ? { ...a, rotation } : a)))
      flashSaved()
      try {
        await updatePosition(id, asset.position_x, asset.position_y, rotation)
      } catch {
        toast({ title: 'No se pudo guardar la rotación', variant: 'error' })
      }
    },
    [assets, flashSaved, toast],
  )

  const refreshAssets = useCallback(async () => {
    const list = await fetchAssets().catch(() => [])
    setAssets(list)
  }, [])

  const counts = useMemo(() => {
    const c = {
      total: assets.length,
      operativo: 0,
      mantenimiento_proximo: 0,
      mantenimiento_vencido: 0,
      fuera_servicio: 0,
      retirado: 0,
    }
    for (const a of assets) {
      if (a.status in c) c[a.status as keyof typeof c] += 1
    }
    return c
  }, [assets])

  const selected = assets.find((a) => a.id === selectedId) ?? null

  // Salas: la sala principal (null) + las salas personalizadas
  const rooms = useMemo(() => {
    const base = layout ? [{ id: null as string | null, name: 'Sala principal', width_m: layout.width_m, length_m: layout.length_m }] : []
    const extra = (layout?.rooms ?? []).map((r) => ({ id: r.id as string | null, name: r.name, width_m: r.width_m, length_m: r.length_m }))
    return [...base, ...extra]
  }, [layout])

  const currentRoom = rooms.find((r) => (r.id ?? null) === currentRoomId) ?? rooms[0] ?? { id: null, name: 'Sala principal', width_m: 30, length_m: 18 }
  const roomAssets = assets.filter((a) => (a.room_id ?? null) === (currentRoom.id ?? null))

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Layout</h1>
            <p className="text-sm text-muted-foreground">
              Plano del gimnasio, equipos, mantenimiento y ocupación en vivo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setView('canvas')}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  view === 'canvas' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <Map className="size-4" /> Plano
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <List className="size-4" /> Lista
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 /> Configuración
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Añadir equipo
            </Button>
          </div>
        </div>

        {error && <ErrorState description={error} onRetry={loadAll} className="mb-6" />}
        {loading && <LoadingState label="Cargando layout…" />}

        {!loading && !error && layout && (
          <>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {rooms.map((r) => (
                <button
                  key={r.id ?? 'main'}
                  type="button"
                  onClick={() => {
                    setCurrentRoomId(r.id)
                    setSelectedId(null)
                  }}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    (r.id ?? null) === currentRoom.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent',
                  )}
                >
                  {r.name}
                  <span className="text-xs opacity-70">· {r.width_m}×{r.length_m} m</span>
                </button>
              ))}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatChip label="Equipos" value={counts.total} icon={Dumbbell} tint="bg-primary/10 text-primary" />
              <StatChip label="Operativos" value={counts.operativo} icon={Check} tint="bg-success/10 text-success" />
              <StatChip label="Mant. próximos" value={counts.mantenimiento_proximo} icon={Wrench} tint="bg-warning/10 text-warning" />
              <StatChip label="Mant. vencidos" value={counts.mantenimiento_vencido} icon={ShieldAlert} tint="bg-destructive/10 text-destructive" />
              <StatChip label="Fuera de servicio" value={counts.fuera_servicio} icon={Trash2} tint="bg-destructive/10 text-destructive" />
            </div>

            {view === 'canvas' && layout && (
              <>
                {selected && (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/70 p-2 shadow-card">
                    <span className="min-w-0 truncate px-1 text-sm font-medium">{selected.display_name}</span>
                    <div className="ml-auto flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => handleRotate(selected.id, 90)}>
                        <RotateCw /> Girar 90°
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDetailId(selected.id)
                          setDetailOpen(true)
                        }}
                      >
                        Detalles
                      </Button>
                      {selected.status !== 'retirado' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={async () => {
                            await retireAsset(selected.id)
                            refreshAssets()
                            toast({ title: 'Equipo retirado', variant: 'success' })
                          }}
                        >
                          <Trash2 /> Retirar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                <CanvasBoundary>
                  <EquipmentCanvas
                    assets={roomAssets}
                    layout={{ ...layout, width_m: currentRoom.width_m, length_m: currentRoom.length_m }}
                    zones={layout.zones}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onMoveEnd={handleMoveEnd}
                    onBackgroundClick={() => setSelectedId(null)}
                    onOpenDetail={(id) => {
                      setDetailId(id)
                      setDetailOpen(true)
                    }}
                    placementId={null}
                  />
                </CanvasBoundary>
                {savedFlash && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-success">
                    <Check className="size-3.5" /> Guardado
                  </p>
                )}
              </>
            )}

            {view === 'list' && (
              <EquipmentList
                assets={assets}
                onSelect={(id) => {
                  setDetailId(id)
                  setDetailOpen(true)
                }}
              />
            )}

            <OccupancyStrip refreshKey={occupancyKey} />
          </>
        )}
      </div>

      <AddEquipmentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        catalog={catalog ?? { categories: [], types: [], brands: [], models: [] }}
        layout={{
          ...(layout ?? { gym_id: '', width_m: 30, length_m: 18, notice_days: 7, zones: [], rooms: [] }),
          width_m: currentRoom.width_m,
          length_m: currentRoom.length_m,
        }}
        roomId={currentRoom.id}
        onCreated={async () => {
          await refreshAssets()
          setOccupancyKey((k) => k + 1)
        }}
      />

      <LayoutSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        layout={layout ?? { gym_id: '', width_m: 30, length_m: 18, notice_days: 7, zones: [], rooms: [] }}
        onSaved={(next) => {
          setLayout(next)
          setOccupancyKey((k) => k + 1)
        }}
      />

      <EquipmentDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        assetId={detailId}
        onChanged={() => {
          refreshAssets()
          setOccupancyKey((k) => k + 1)
        }}
      />
    </AppLayout>
  )
}