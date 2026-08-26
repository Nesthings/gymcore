import { Link } from 'react-router-dom'
import { ArrowRight, Dumbbell } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { EMPTY_ALERTS, SEVERITY_META, relativeTime } from '@/lib/smart-alerts'
import type { SmartAlertsData } from '@/lib/smart-alerts'
import { cn } from '@/lib/utils'

const SEV_ORDER = ['critical', 'warning', 'info', 'success'] as const

export function SmartAlertsList({ data }: { data: SmartAlertsData }) {
  const d = data ?? EMPTY_ALERTS
  const items = d.items ?? []

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5">
        {SEV_ORDER.map((sev) => {
          const meta = SEVERITY_META[sev]
          const count = d.summary?.[sev] ?? 0
          return (
            <Badge key={sev} variant={meta.badge} className="gap-1">
              <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden="true" />
              {count}
              <span className="hidden font-normal sm:inline">{meta.label.toLowerCase()}</span>
            </Badge>
          )
        })}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {d.summary?.total ?? 0} en riesgo
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Sin socios en riesgo"
          description="No hay socios que requieran atención en este momento."
          icon={Dumbbell}
          className="flex-1"
        />
      ) : (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {items.map((a) => {
            const meta = SEVERITY_META[a.severity] ?? SEVERITY_META.info
            const Icon = meta.icon
            return (
              <Link
                key={a.id}
                to={a.link}
                className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card p-2.5 transition-colors hover:bg-accent"
              >
                <span className={cn('mt-0.5 shrink-0', meta.text)}>
                  <Icon className="size-4 text-current" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-semibold">{a.title}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {relativeTime(a.triggered_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {a.member_name && (
                      <span className="font-medium text-foreground">{a.member_name} — </span>
                    )}
                    {a.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Link
        to="/riesgo"
        className="flex shrink-0 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-accent"
      >
        Ver todos <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  )
}