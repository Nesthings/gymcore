import { cn } from '@/lib/utils'

type SectionTint = 'primary' | 'warning' | 'success' | 'destructive' | 'info'

const TINTS: Record<SectionTint, string> = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
}

/**
 * SectionHeading: encabezado de sección interna de una tarjeta unificada
 * (icono tintado + título uppercase + subtítulo opcional).
 */
function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  tint = 'primary',
  right,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  tint?: SectionTint
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', TINTS[tint])}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-foreground">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

export { SectionHeading }
