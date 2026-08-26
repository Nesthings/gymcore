import { Dumbbell } from 'lucide-react'

import { cn } from '@/lib/utils'

interface FeedItem {
  id: string
  title: string
  message: string
  created_at: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export function FeedList({
  items,
  className,
}: {
  items: FeedItem[] | null
  className?: string
}) {
  if (!items || items.length === 0) return null
  return (
    <div className={cn('space-y-3', className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Dumbbell className="size-4 text-primary" aria-hidden="true" /> Novedades
      </h2>
      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{p.title}</p>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {relativeTime(p.created_at)}
              </span>
            </div>
            {p.message && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.message}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}