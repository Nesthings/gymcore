import { Children } from 'react'

import { cn, formatCurrency } from '@/lib/utils'

/**
 * PipelineColumn: columna del pipeline de leads (etapa). Muestra el encabezado
 * con conteo y valor agregado, y apila las tarjetas de LeadCard.
 */
export function PipelineColumn({
  title,
  count,
  value,
  dotClass,
  children,
}: {
  title: string
  count: number
  value: number
  dotClass: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-[260px] flex-1 flex-col gap-2 rounded-2xl border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 shadow-card">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('size-2.5 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {count}
          </span>
        </div>
        {value > 0 && (
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-primary">
            {formatCurrency(value, 2)}
          </span>
        )}
      </div>
      <div className="flex min-h-[120px] flex-col gap-2">
        {Children.count(children) === 0 ? (
          <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
            Sin leads
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}