import { Construction, type LucideIcon } from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * ModulePlaceholder: página shell para los módulos de dominio que construye
 * otro agente (socios, membresías, pagos, check-in, CRM). Mantiene la
 * estructura del layout y un estado vacío compuesto, sin romper el build.
 */
export function ModulePlaceholder({
  title,
  description,
  icon,
  actionLabel,
  actionTo,
}: {
  title: string
  description: string
  icon: LucideIcon
  actionLabel?: string
  actionTo?: string
}) {
  return (
    <AppLayout>
      <div className="mb-6">
        <Badge variant="soft-info">En construcción</Badge>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <EmptyState
        title={`Módulo ${title} en preparación`}
        description="Este módulo se está construyendo junto con su API. Mientras tanto, el resto del panel ya opera."
        icon={icon}
        action={
          actionLabel && actionTo ? (
            <Button asChild size="sm">
              <a href={actionTo}>{actionLabel}</a>
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Construction className="size-3.5" aria-hidden="true" />
        Navegación y permisos ya conectados: este espacio espera su implementación de dominio.
      </div>
    </AppLayout>
  )
}