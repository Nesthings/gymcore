import { useState } from 'react'
import { GripVertical, PanelTop, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useDashboardConfig } from '@/lib/dashboard-config'
import { CHART_LABELS, type DashboardDef } from '@/lib/dashboards'
import { cn } from '@/lib/utils'

export function DashboardTray({
  open,
  available,
  onClose,
}: {
  open: boolean
  available: DashboardDef[]
  onClose: () => void
}) {
  const { remove } = useDashboardConfig()
  const [dragOver, setDragOver] = useState(false)

  if (!open) return null

  return (
    <div className="mb-6 rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <PanelTop className="size-4 text-primary" aria-hidden="true" />
          Bandeja de dashboards
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar bandeja"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Arrastra uno hacia abajo para dibujarlo, o suelta aquí un dashboard activo para quitarlo.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const slug = e.dataTransfer.getData('text/plain')
          if (slug) remove(slug)
        }}
        className={cn(
          'grid gap-2 sm:grid-cols-2 lg:grid-cols-3',
          dragOver && 'rounded-lg outline-2 outline-dashed outline-primary/40',
        )}
      >
        {available.map((d) => (
          <div
            key={d.slug}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', d.slug)
              e.dataTransfer.effectAllowed = 'move'
            }}
            title="Arrastra a la zona de dashboards para dibujarlo"
            className="flex cursor-grab items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 transition-colors hover:bg-accent/50 active:cursor-grabbing"
          >
            <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{d.title}</p>
              <p className="text-xs text-muted-foreground">{d.desc}</p>
            </div>
            <Badge variant="outline" className="shrink-0">
              {CHART_LABELS[d.chart]}
            </Badge>
          </div>
        ))}
        {available.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">
            Todos los dashboards están dibujados. Suelta aquí uno activo para quitarlo.
          </p>
        )}
      </div>
    </div>
  )
}
