import { useCallback, useEffect, useRef, useState } from 'react'
import { Grid3X3, Magnet, Maximize, Minus, Plus, RotateCcw } from 'lucide-react'

import { EquipmentShape } from '@/components/equipment/EquipmentShape'
import { Button } from '@/components/ui/button'
import type { EquipmentAsset, GymLayoutConfig, Zone } from '@/lib/equipment'
import { defaultDimensions } from '@/lib/equipment'
import { cn } from '@/lib/utils'

const BASE = 22 // px por metro base
const GRID_M = 1 // cuadrícula cada 1 m
const SNAP_M = 0.25 // snap cada 25 cm

function fmtCoords(v: number) {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0
}

interface TempPos {
  x: number
  y: number
}

export function EquipmentCanvas({
  assets,
  layout,
  zones,
  selectedId,
  onSelect,
  onMoveEnd,
  onBackgroundClick,
  onOpenDetail,
  placementId,
}: {
  assets: EquipmentAsset[]
  layout: GymLayoutConfig
  zones: Zone[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMoveEnd: (id: string, x: number, y: number) => void
  onBackgroundClick: () => void
  onOpenDetail?: (id: string) => void
  placementId?: string | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 30 })
  const [grid, setGrid] = useState(true)
  const [snap, setSnap] = useState(true)
  const [temp, setTemp] = useState<Record<string, TempPos>>({})
  const dragRef = useRef<{
    mode: 'pan' | 'node' | null
    startX: number
    startY: number
    panStart: { x: number; y: number }
    nodeId?: string
    nodeStart?: { x: number; y: number }
  } | null>(null)

  const worldW = layout.width_m * BASE
  const worldH = layout.length_m * BASE

  const fit = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 48
    const z = Math.min((rect.width - pad) / worldW, (rect.height - pad) / worldH, 1.6)
    setZoom(Math.max(0.2, z))
    setPan({ x: (rect.width - worldW * z) / 2, y: (rect.height - worldH * z) / 2 })
  }, [worldW, worldH])

  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      panStart: { ...pan },
    }
    onSelect(null)
  }

  const handleNodePointerDown = (e: React.PointerEvent, asset: EquipmentAsset) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    onSelect(asset.id)
    dragRef.current = {
      mode: 'node',
      startX: e.clientX,
      startY: e.clientY,
      panStart: { ...pan },
      nodeId: asset.id,
      nodeStart: {
        x: temp[asset.id]?.x ?? asset.position_x,
        y: temp[asset.id]?.y ?? asset.position_y,
      },
    }
  }

  const handleNodeClick = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation()
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    if (d.mode === 'pan') {
      setPan({
        x: d.panStart.x + (e.clientX - d.startX),
        y: d.panStart.y + (e.clientY - d.startY),
      })
    } else if (d.mode === 'node' && d.nodeId && d.nodeStart) {
      let x = d.nodeStart.x + (e.clientX - d.startX) / zoom / BASE
      let y = d.nodeStart.y + (e.clientY - d.startY) / zoom / BASE
      if (snap) {
        x = Math.round(x / SNAP_M) * SNAP_M
        y = Math.round(y / SNAP_M) * SNAP_M
      }
      x = Math.max(0.1, Math.min(x, layout.width_m - 0.1))
      y = Math.max(0.1, Math.min(y, layout.length_m - 0.1))
      setTemp((t) => ({ ...t, [d.nodeId!]: { x: fmtCoords(x), y: fmtCoords(y) } }))
    }
  }

  const handlePointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (d?.mode === 'node' && d.nodeId) {
      const p = temp[d.nodeId]
      if (p) {
        const { x, y } = p
        setTemp((t) => {
          const n = { ...t }
          delete n[d.nodeId!]
          return n
        })
        onMoveEnd(d.nodeId!, x, y)
      }
    }
  }

  const zoneById = (id?: string | null) => zones.find((z) => z.id === id)

  return (
    <div
      ref={containerRef}
      className="relative h-[560px] w-full touch-none overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_50%_0%,var(--card),var(--background))] shadow-card lg:h-[620px]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={() => onBackgroundClick()}
    >
      {/* Mundo (plano) */}
      <div
        style={{
          width: worldW,
          height: worldH,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute left-0 top-0"
      >
        {/* Zonas */}
        {zones.length === 0 && (
          <div className="absolute inset-0 rounded-lg border border-border/60 bg-card/10" />
        )}
        {zones.map((z) => (
          <div
            key={z.id}
            className="absolute rounded-md border border-dashed"
            style={{
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              borderColor: z.color,
              opacity: 0.35,
              background: `color-mix(in srgb, ${z.color} 6%, transparent)`,
            }}
          />
        ))}

        {/* Grid */}
        {grid && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, color-mix(in srgb, var(--muted-foreground) 30%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--muted-foreground) 30%, transparent) 1px, transparent 1px)',
              backgroundSize: `${GRID_M * BASE}px ${GRID_M * BASE}px`,
            }}
          />
        )}

        {/* Equipos */}
        {assets.map((asset) => {
          const dims = {
            w: asset.width_m ?? defaultDimensions(asset.type_name).w,
            d: asset.depth_m ?? defaultDimensions(asset.type_name).d,
          }
          const p = temp[asset.id] ?? { x: asset.position_x, y: asset.position_y }
          const selected = selectedId === asset.id
          const zone = zoneById(asset.zone_id)
          return (
            <div
              key={asset.id}
              data-asset-id={asset.id}
              onPointerDown={(e) => handleNodePointerDown(e, asset)}
              onClick={handleNodeClick}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onOpenDetail?.(asset.id)
              }}
              style={{
                left: p.x * BASE,
                top: p.y * BASE,
                width: dims.w * BASE,
                height: dims.d * BASE,
                transform: `rotate(${asset.rotation}deg)`,
              }}
              title={`${asset.display_name} · ${asset.status}`}
              className={cn(
                'absolute cursor-grab touch-none select-none active:cursor-grabbing',
                placementId === asset.id && 'ring-2 ring-primary',
              )}
            >
              <div
                className={cn(
                  'relative size-full transition-shadow',
                  selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
              >
                <EquipmentShape
                  typeName={asset.type_name}
                  categoryName={asset.category_name}
                  status={asset.status}
                />
                {zone && (
                  <span
                    className="absolute right-0.5 top-0.5 size-2 rounded-full"
                    style={{ background: zone.color }}
                    aria-hidden="true"
                  />
                )}
                {assets.length <= 40 && !selected && (
                  <span className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-foreground/70">
                    {asset.display_name}
                  </span>
                )}
              </div>
              {/* Etiqueta sobre la selección */}
              {selected && (
                <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground shadow-card">
                  {asset.display_name}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Controles */}
      <div
        className="absolute bottom-3 right-3 flex flex-col gap-1.5"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card/90 p-1 shadow-card backdrop-blur">
          <Button variant="ghost" size="icon-sm" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(3, z * 1.2))}>
            <Plus />
          </Button>
          <span className="px-1 text-[10px] font-medium tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(0.2, z * 0.8))}>
            <Minus />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Ajustar a la pantalla" onClick={fit}>
            <Maximize />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Restablecer zoom (100%)"
            onClick={() => setZoom(1)}
          >
            <RotateCcw />
          </Button>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card/90 p-1 shadow-card backdrop-blur">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mostrar u ocultar la cuadrícula"
            title="Cuadrícula"
            className={cn(grid && 'bg-accent text-foreground')}
            onClick={() => setGrid((g) => !g)}
          >
            <Grid3X3 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Ajustar equipos a la cuadrícula al moverlos"
            title="Ajustar a la cuadrícula (snap)"
            className={cn(snap && 'bg-accent text-foreground')}
            onClick={() => setSnap((s) => !s)}
          >
            <Magnet />
          </Button>
        </div>
      </div>

      {/* Dimensiones */}
      <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-card backdrop-blur">
        {layout.width_m} × {layout.length_m} m
      </div>
    </div>
  )
}