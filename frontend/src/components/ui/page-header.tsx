import { cn } from '@/lib/utils'

/**
 * PageHeader: encabezado estándar de página del panel (icono opcional, título,
 * subtítulo y acciones a la derecha). Unifica tipografía y espaciado.
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  icon?: React.ElementType
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
