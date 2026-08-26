import { Target } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Goal } from '@/components/portal/GoalsCard'

export function GoalCardStaff({ goal }: { goal: Goal }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <Target className="size-3.5 text-primary" aria-hidden="true" />
        <p className="truncate text-sm font-medium">{goal.title ?? 'Objetivo'}</p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn('h-full rounded-full', goal.progress >= 1 ? 'bg-success' : 'bg-primary')}
          style={{ width: `${Math.max(6, Math.round(goal.progress * 100))}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {goal.label ?? `${Math.round(goal.progress * 100)}%`} · meta {goal.target_value}
      </p>
    </div>
  )
}