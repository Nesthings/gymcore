import { useEffect, useState } from 'react'
import { CheckCircle2, History } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'

interface TodayCheckin {
  member_name: string
  checked_at: string
  branch_name?: string
}

/**
 * TodayCheckins: lista de check-ins del día. Se refresca cuando cambia
 * `refreshKey` (p. ej. tras registrar un nuevo check-in).
 */
export function TodayCheckins({ refreshKey }: { refreshKey: number }) {
  const [checkins, setCheckins] = useState<TodayCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiFetch<TodayCheckin[]>('/checkins/today')
      .then((res) => {
        if (cancelled) return
        setCheckins(res)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los check-ins de hoy')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, tick])

  if (error) {
    return <ErrorState description={error} onRetry={() => setTick((t) => t + 1)} />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {checkins.length} visitas registradas hoy
        </p>
        <span className="flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          <CheckCircle2 className="size-3.5" aria-hidden="true" /> En vivo
        </span>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && checkins.length === 0 && (
        <EmptyState
          title="Sin check-ins todavía"
          description="Cuando los socios pasen por recepción, sus visitas aparecerán aquí."
          icon={History}
        />
      )}

      {!loading && checkins.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {checkins.map((c, i) => (
            <div
              key={`${c.checked_at}-${i}`}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Avatar name={c.member_name} className="size-9 border-2 border-primary/20" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{c.member_name}</p>
                <p className="text-xs text-muted-foreground">{c.branch_name ?? 'Sucursal principal'}</p>
              </div>
              <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                {new Date(c.checked_at).toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}