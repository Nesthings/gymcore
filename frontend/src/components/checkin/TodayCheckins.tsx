import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, History, LogOut } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'

interface TodayCheckin {
  id: string
  member_name: string
  checked_at: string
  checked_out_at?: string | null
  duration_min?: number | null
  branch_name?: string
}

function fmtMin(min: number) {
  return min >= 60 ? `${Math.round(min / 60)} h ${min % 60} min` : `${min} min`
}

/**
 * TodayCheckins: lista de check-ins del día con cierre de sesión (check-out)
 * para medir el tiempo de entrenamiento.
 */
export function TodayCheckins({
  refreshKey,
  onCheckedOut,
}: {
  refreshKey: number
  onCheckedOut?: () => void
}) {
  const [checkins, setCheckins] = useState<TodayCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [closingId, setClosingId] = useState<string | null>(null)
  const { toast } = useToast()

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

  const closeSession = useCallback(
    async (id: string) => {
      setClosingId(id)
      try {
        const res = await apiFetch<{ duration_min: number }>(`/checkins/${id}/checkout`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
        toast({
          title: 'Salida registrada',
          description: `Sesión cerrada · ${fmtMin(res.duration_min)} de entrenamiento.`,
          variant: 'success',
        })
        setCheckins((list) =>
          list.map((c) =>
            c.id === id ? { ...c, checked_out_at: new Date().toISOString(), duration_min: res.duration_min } : c,
          ),
        )
        onCheckedOut?.()
      } catch (err) {
        toast({
          title: 'No se pudo cerrar la sesión',
          description: err instanceof Error ? err.message : 'Intenta de nuevo.',
          variant: 'error',
        })
      } finally {
        setClosingId(null)
      }
    },
    [toast, onCheckedOut],
  )

  if (error) {
    return <ErrorState description={error} onRetry={() => setTick((t) => t + 1)} />
  }

  const open = checkins.filter((c) => !c.checked_out_at).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {checkins.length} visitas hoy · <span className="font-medium text-foreground">{open}</span> en el
          gimnasio
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
          {checkins.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Avatar name={c.member_name} className="size-9 border-2 border-primary/20" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{c.member_name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.checked_out_at
                    ? `salió ${new Date(c.checked_out_at).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}${c.duration_min != null ? ` · ${fmtMin(c.duration_min)}` : ''}`
                    : c.branch_name ?? 'Sucursal principal'}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                {new Date(c.checked_at).toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {!c.checked_out_at && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={closingId === c.id}
                  onClick={() => closeSession(c.id)}
                >
                  <LogOut /> Salida
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}