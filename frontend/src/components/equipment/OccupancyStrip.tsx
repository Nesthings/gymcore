import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { fmtDuration, type TodayCheckin } from '@/lib/equipment'

const TICK_MS = 30_000

export function OccupancyStrip({ refreshKey }: { refreshKey: number }) {
  const [open, setOpen] = useState<TodayCheckin[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    apiFetch<TodayCheckin[]>('/checkins/today')
      .then((res) => {
        if (!cancelled) setOpen(res.filter((c) => !c.checked_out_at))
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo actualizar')
          toast({ title: 'Ocupación', description: 'No se pudo actualizar la información.', variant: 'error' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, tick, toast])

  // Refresco ligero: el reloj local actualiza las duraciones sin polling al backend.
  useEffect(() => {
    const t = window.setInterval(() => {
      setTick((v) => v + 1)
      setNow(Date.now())
    }, TICK_MS)
    return () => window.clearInterval(t)
  }, [])

  const people = open ?? []
  const count = people.length

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" /> Ahora en el gimnasio · {count}
        </h2>
        <span className="text-xs text-muted-foreground">Basado en check-ins activos</span>
      </div>

      {error && (
        <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
          No se pudo actualizar la información.{' '}
          <button className="font-medium underline" onClick={() => setTick((v) => v + 1)}>
            Reintentar
          </button>
        </p>
      )}

      {open === null && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-40 shrink-0 space-y-2 rounded-xl border border-border bg-card p-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      )}

      {open !== null && people.length === 0 && (
        <EmptyState
          title="No hay miembros registrados actualmente"
          description="Cuando alguien haga check-in, aparecerá aquí."
          icon={Users}
        />
      )}

      {open !== null && people.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {people.map((p) => (
            <Link
              key={p.id}
              to={`/socios/${p.member_id}`}
              className="w-40 shrink-0 rounded-xl border border-border bg-card p-3 shadow-card transition-colors hover:border-primary/40"
            >
              <Avatar
                src={p.photo_url}
                name={p.member_name}
                className="size-10 border-2 border-primary/20"
              />
              <p className="mt-2 truncate text-sm font-medium">{p.member_name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-success">
                <span className="size-1.5 rounded-full bg-success" /> Dentro
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtDuration(now - new Date(p.checked_at).getTime())}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}