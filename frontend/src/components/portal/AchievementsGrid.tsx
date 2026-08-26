import { Award, Lock } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface Achievement {
  key: string
  emoji: string
  title: string
  description: string
  unlocked: boolean
  progress: number
  progress_label: string
}

export function AchievementsGrid({
  data,
  className,
}: {
  data: { summary: { unlocked: number; locked: number; total: number }; items: Achievement[] } | null
  className?: string
}) {
  if (!data) return null
  const { summary, items } = data

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Award className="size-4 text-primary" aria-hidden="true" /> Tus logros
        </h2>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-primary">🏆 {summary.unlocked} desbloqueados</span>
          <span className="mx-1.5">·</span>
          <span className="flex items-center gap-1">
            <Lock className="size-3" aria-hidden="true" /> {summary.locked} por desbloquear
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((a) => (
          <div
            key={a.key}
            className={cn(
              'rounded-xl border p-3 text-center transition-colors',
              a.unlocked
                ? 'border-primary/30 bg-primary/5'
                : 'border-border/60 bg-card opacity-75',
            )}
          >
            <p className="text-2xl" aria-hidden="true">
              {a.unlocked ? a.emoji : '🔒'}
            </p>
            <p
              className={cn(
                'mt-1 line-clamp-2 min-h-[2.25rem] text-xs font-semibold leading-tight',
                a.unlocked ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {a.title}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className={cn('h-full rounded-full', a.unlocked ? 'bg-primary' : 'bg-muted-foreground/40')}
                style={{ width: `${Math.max(6, Math.round(a.progress * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {a.unlocked ? '✓ Desbloqueado' : a.progress_label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}