import { cn } from '@/lib/utils'

/**
 * StatChip: indicador compacto (valor + etiqueta) con icono tintado.
 * Uso: label, value, icon (lucide), tint (ej. 'bg-info/10 text-info').
 */
function StatChip({
  label,
  value,
  icon: Icon,
  tint,
  className,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  tint: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card',
        className,
      )}
    >
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tint)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none text-foreground">{value}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export { StatChip }
