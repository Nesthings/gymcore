import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'

interface Post {
  id: string
  title: string
  message: string
  active: boolean
  created_at: string
  author?: string | null
}

export function ComunicadosSection() {
  const [posts, setPosts] = useState<Post[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      setPosts(await apiFetch<Post[]>('/posts'))
    } catch {
      // best-effort
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      toast({ title: 'Título y mensaje requeridos', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      await apiFetch('/posts', { method: 'POST', body: JSON.stringify({ title: title.trim(), message: message.trim() }) })
      setOpen(false)
      setTitle('')
      setMessage('')
      await load()
      toast({ title: 'Comunicado publicado', variant: 'success' })
    } catch (err) {
      toast({ title: 'No se pudo publicar', description: err instanceof Error ? err.message : 'Intenta de nuevo.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (p: Post) => {
    await apiFetch(`/posts/${p.id}`, { method: 'PATCH', body: JSON.stringify({ active: !p.active }) })
    await load()
  }

  const remove = async (p: Post) => {
    await apiFetch(`/posts/${p.id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Megaphone className="size-4 text-primary" aria-hidden="true" /> Comunicados
          </h2>
          <p className="text-sm text-muted-foreground">
            Lo que publiques aparecerá en el feed de novedades del portal del socio.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Publicar
        </Button>
      </div>

      {posts.length === 0 && (
        <EmptyState
          title="Sin comunicados"
          description="Publica novedades, retos o avisos para tus socios."
          icon={Megaphone}
        />
      )}

      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <Badge variant={p.active ? 'soft-success' : 'secondary'}>
                    {p.active ? 'Visible' : 'Oculto'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {p.author ? ` · ${p.author}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" onClick={() => toggle(p)}>
                  {p.active ? 'Ocultar' : 'Mostrar'}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo comunicado</DialogTitle>
            <DialogDescription>Aparecerá en el feed del portal del socio.</DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Nueva máquina disponible" required />
            </div>
            <div className="space-y-1.5">
              <Label>Mensaje *</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Detalles del aviso…" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Publicar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}