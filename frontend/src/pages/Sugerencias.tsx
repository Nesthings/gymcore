import { useCallback, useEffect, useState } from 'react'
import { CheckCheck, Inbox, MessageSquare } from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'

interface Suggestion {
  id: string
  member_id?: string | null
  member_name?: string | null
  message: string
  status: 'new' | 'read'
  created_at: string
}

function SkeletonRow() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

export function Sugerencias() {
  const [items, setItems] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await apiFetch<Suggestion[]>('/suggestions'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las sugerencias')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, tick])

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/suggestions/${id}/read`, { method: 'POST' })
      setItems((list) => list.map((s) => (s.id === id ? { ...s, status: 'read' } : s)))
    } catch (err) {
      toast({
        title: 'No se pudo marcar',
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
        variant: 'error',
      })
    }
  }

  const markAll = async () => {
    try {
      await apiFetch('/suggestions/read-all', { method: 'POST' })
      setItems((list) => list.map((s) => ({ ...s, status: 'read' })))
    } catch (err) {
      toast({
        title: 'No se pudo marcar todo',
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
        variant: 'error',
      })
    }
  }

  const unread = items.filter((s) => s.status === 'new').length

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Buzón de sugerencias</h1>
            <p className="text-sm text-muted-foreground">
              Comentarios que los socios envían desde su portal.
            </p>
          </div>
          {unread > 0 && (
            <Button size="sm" variant="outline" onClick={markAll}>
              <CheckCheck /> Marcar todas ({unread})
            </Button>
          )}
        </div>

        {error && (
          <ErrorState
            title="No se pudieron cargar las sugerencias"
            description={error}
            onRetry={() => setTick((t) => t + 1)}
          />
        )}

        {loading && (
          <Card className="rounded-2xl">
            <CardContent className="space-y-4 pt-5">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </CardContent>
          </Card>
        )}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            title="Sin sugerencias todavía"
            description="Cuando un socio envíe un comentario desde su portal, aparecerá aquí."
            icon={Inbox}
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((s) => (
              <Card key={s.id} className="rounded-2xl">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="size-4 text-primary" aria-hidden="true" />
                      {s.member_name ?? 'Socio anónimo'}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <Badge variant={s.status === 'new' ? 'warning' : 'secondary'}>
                        {s.status === 'new' ? 'Nueva' : 'Leída'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-foreground">{s.message}</p>
                  {s.status === 'new' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-3"
                      onClick={() => markRead(s.id)}
                    >
                      <CheckCheck /> Marcar como leída
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}