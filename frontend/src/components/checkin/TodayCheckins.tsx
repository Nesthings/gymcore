import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, History, LogIn, LogOut } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useScanner } from '@/lib/scanner'
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
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h} h ${m} min` : `${h} h`
  }
  return `${min} min`
}

function fmtElapsed(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000))
  return fmtMin(totalMin)
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

/**
 * TodayCheckins: visitas de hoy con cierre de sesión (check-out). Agrupa
 * socios activos ("en el gimnasio", con tiempo transcurrido en vivo) y los que
 * ya salieron (entrada → salida y duración).
 */
export function TodayCheckins({
  refreshKey,
}: {
  refreshKey: number
}) {
  const [checkins, setCheckins] = useState<TodayCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const { toast } = useToast()
  const { lastResult } = useScanner()

  // Refrescar cuando el lector continuo registra un check-in/pase.
  useEffect(() => {
    if (lastResult) setTick((t) => t + 1)
  }, [lastResult])

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

  // Tic de un minuto para el tiempo transcurrido en vivo de las sesiones abiertas.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

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
            c.id === id
              ? { ...c, checked_out_at: new Date().toISOString(), duration_min: res.duration_min }
              : c,
          ),
        )
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
    [toast],
  )

  if (error) {
    return <ErrorState description={error} onRetry={() => setTick((t) => t + 1)} />
  }

  const open = checkins.filter((c) => !c.checked_out_at)
  const closed = checkins.filter((c) => c.checked_out_at)

  return (
    <div className="space-y-4">
      {/* Resumen del día */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="font-mono text-xl font-bold tabular-nums">{checkins.length}</p>
          <p className="text-xs text-muted-foreground">Visitas hoy</p>
        </div>
        <div className="rounded-xl border border-success/25 bg-success/5 px-3 py-2.5 text-center">
          <p className="font-mono text-xl font-bold tabular-nums text-success">{open.length}</p>
          <p className="text-xs text-muted-foreground">En el gimnasio</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="font-mono text-xl font-bold tabular-nums">{closed.length}</p>
          <p className="text-xs text-muted-foreground">Salieron</p>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
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
        <>
          {/* En el gimnasio */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <LogIn className="size-3.5" aria-hidden="true" /> En el gimnasio
                <span className="relative flex size-2" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
              </h3>
              <span className="text-xs text-muted-foreground">{open.length}</span>
            </div>

            {open.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-center text-sm text-muted-foreground">
                Nadie en el gimnasio en este momento.
              </p>
            ) : (
              open.map((c) => {
                const elapsed = fmtElapsed(now - new Date(c.checked_at).getTime())
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-success/25 bg-success/5 px-4 py-3"
                  >
                    <Avatar
                      name={c.member_name}
                      className="size-10 border-2 border-success/40"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {c.member_name}
                        </p>
                        <Badge variant="soft-success" className="gap-1">
                          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                          En el gimnasio
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Entrada <span className="font-mono tabular-nums text-foreground">{fmtTime(c.checked_at)}</span>
                        <span className="mx-1.5">·</span>
                        Lleva <span className="font-mono font-medium tabular-nums text-success">{elapsed}</span>
                        {c.branch_name ? <span className="mx-1.5">·</span> : null}
                        {c.branch_name}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={closingId === c.id}
                      onClick={() => setConfirmClose(c.id)}
                    >
                      <LogOut /> Salida
                    </Button>
                  </div>
                )
              })
            )}
          </section>

          {/* Salieron */}
          {closed.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" /> Salieron
                </h3>
                <span className="text-xs text-muted-foreground">{closed.length}</span>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                {closed.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <Avatar name={c.member_name} className="size-10 border-2 border-border" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {c.member_name}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <LogIn className="size-3" aria-hidden="true" />
                          <span className="font-mono tabular-nums">{fmtTime(c.checked_at)}</span>
                        </span>
                        <ArrowRight className="size-3" aria-hidden="true" />
                        <span className="flex items-center gap-1">
                          <LogOut className="size-3" aria-hidden="true" />
                          <span className="font-mono tabular-nums">
                            {c.checked_out_at ? fmtTime(c.checked_out_at) : '—'}
                          </span>
                        </span>
                        {c.duration_min != null && (
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            · {fmtMin(c.duration_min)}
                          </span>
                        )}
                        {c.branch_name ? <span>· {c.branch_name}</span> : null}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmClose)}
        onOpenChange={(open) => !open && setConfirmClose(null)}
        title="¿Registrar la salida?"
        description="Se cerrará la sesión del socio y se calculará el tiempo de entrenamiento."
        confirmLabel="Registrar salida"
        variant="default"
        onConfirm={() => {
          const id = confirmClose
          setConfirmClose(null)
          if (id) closeSession(id)
        }}
      />
    </div>
  )
}