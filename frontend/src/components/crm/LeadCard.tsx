import { ChevronLeft, ChevronRight, Mail, Pencil, Phone, Trash2 } from 'lucide-react'

import type { Lead } from '@/components/crm/LeadFormDialog'
import { STAGE_LABELS } from '@/components/crm/LeadFormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

/**
 * LeadCard: tarjeta compacta de lead para el pipeline. Incluye controles para
 * mover de etapa (sin drag&drop), editar y eliminar.
 */
export function LeadCard({
  lead,
  canMoveBack,
  canMoveForward,
  onMove,
  onEdit,
  onDelete,
}: {
  lead: Lead
  canMoveBack: boolean
  canMoveForward: boolean
  onMove: (lead: Lead, direction: 'back' | 'forward') => void
  onEdit: (lead: Lead) => void
  onDelete: (lead: Lead) => void
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-card transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{lead.name}</p>
        {lead.value != null && lead.value > 0 && (
          <span className="shrink-0 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-primary">
            {MXN.format(lead.value)}
          </span>
        )}
      </div>

      {lead.source && (
        <Badge variant="soft-secondary" className="mt-1.5">
          {lead.source}
        </Badge>
      )}

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {lead.phone && (
          <p className="flex items-center gap-1.5">
            <Phone className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{lead.phone}</span>
          </p>
        )}
        {lead.email && (
          <p className="flex items-center gap-1.5">
            <Mail className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{lead.email}</span>
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          {STAGE_LABELS[lead.status] ?? lead.status} ·{' '}
          {new Date(lead.created_at).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
          })}
        </p>
      </div>

      {lead.notes && (
        <p className="mt-2 line-clamp-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          {lead.notes}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-1 border-t border-border/60 pt-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Mover a la etapa anterior"
            disabled={!canMoveBack}
            onClick={() => onMove(lead, 'back')}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Mover a la siguiente etapa"
            disabled={!canMoveForward}
            onClick={() => onMove(lead, 'forward')}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Editar a ${lead.name}`}
            onClick={() => onEdit(lead)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Eliminar a ${lead.name}`}
            className={cn('text-destructive')}
            onClick={() => onDelete(lead)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  )
}