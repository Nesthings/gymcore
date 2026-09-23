import { cn } from '@/lib/utils'

/**
 * ListToolbar: barra de herramientas para listados (búsqueda + filtros +
 * orden). Contenedor con envoltura responsiva y espaciado uniforme.
 */
export function ListToolbar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>{children}</div>
  )
}
