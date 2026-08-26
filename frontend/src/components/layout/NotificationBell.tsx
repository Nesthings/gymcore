import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'

import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  message: string
  link?: string | null
  read_at?: string | null
  created_at: string
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const [c, n] = await Promise.all([
        apiFetch<{ count: number }>('/notifications/unread-count'),
        apiFetch<Notification[]>('/notifications'),
      ])
      setCount(c.count)
      setItems(n)
    } catch {
      // sin servidor no pasa nada
    }
  }

  useEffect(() => {
    load()
    // Solo sondea mientras la pestaña está visible (ahorra requests en segundo plano).
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' })
      await load()
    } catch {
      // ignorar
    }
  }

  const handleClick = async (n: Notification) => {
    setOpen(false)
    if (n.link) navigate(n.link)
    await markRead(n.id)
  }

  const markAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' })
      await load()
    } catch {
      // ignorar
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent"
        aria-label="Notificaciones"
      >
        <Bell className="size-4" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-dialog">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Notificaciones</p>
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
            >
              <CheckCheck className="size-3.5" /> Marcar todas
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Sin notificaciones
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={cn(
                    'block w-full border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-accent',
                    !n.read_at && 'bg-accent/40',
                  )}
                >
                  <p className="text-sm font-medium">{n.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {n.read_at ? ' · leída' : ''}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
