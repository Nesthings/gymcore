import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Target, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface Goal {
  id: string
  goal_type: string
  title?: string | null
  target_value: number
  current: number | null
  progress: number
  label?: string
  end_date?: string | null
}

const GOAL_TYPES: { value: string; label: string; unit: string }[] = [
  { value: 'peso', label: 'Peso', unit: 'kg' },
  { value: 'entrenamientos_semana', label: 'Entrenamientos por semana', unit: 'sesiones' },
  { value: 'visitas_mes', label: 'Visitas mensuales', unit: 'visitas' },
  { value: 'tiempo_entrenado', label: 'Tiempo entrenado', unit: 'min' },
  { value: 'consistencia', label: 'Consistencia (racha)', unit: 'días' },
  { value: 'personalizado', label: 'Personalizado', unit: '' },
]

export function GoalsCard({
  token,
  className,
}: {
  token: string
  className?: string
}) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [goalType, setGoalType] = useState('peso')
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      setGoals(await apiFetch<Goal[]>(`/member-share/goals?token=${encodeURIComponent(token)}`))
    } catch {
      // best-effort
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const openNew = () => {
    setEditing(null)
    setGoalType('peso')
    setTitle('')
    setTarget('')
    setOpen(true)
  }

  const openEdit = (g: Goal) => {
    setEditing(g)
    setGoalType(g.goal_type)
    setTitle(g.title ?? '')
    setTarget(String(g.target_value))
    setOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(target)
    if (!value || value <= 0) {
      toast({ title: 'Meta inválida', description: 'Ingresa una meta positiva.', variant: 'error' })
      return
    }
    setSaving(true)
    const body = JSON.stringify({
      goal_type: goalType,
      title: goalType === 'personalizado' ? title.trim() || 'Mi objetivo' : undefined,
      target_value: value,
    })
    try {
      if (editing) {
        await apiFetch(`/member-share/goals/${editing.id}?token=${encodeURIComponent(token)}`, {
          method: 'PATCH',
          body,
        })
      } else {
        await apiFetch(`/member-share/goals?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          body,
        })
      }
      setOpen(false)
      await load()
      toast({ title: editing ? 'Objetivo actualizado' : 'Objetivo creado', variant: 'success' })
    } catch (err) {
      toast({
        title: 'No se pudo guardar',
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (g: Goal) => {
    try {
      await apiFetch(`/member-share/goals/${g.id}?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      })
      await load()
    } catch {
      toast({ title: 'No se pudo eliminar', variant: 'error' })
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4 text-primary" aria-hidden="true" /> Mi objetivo
        </h2>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus /> Objetivo
        </Button>
      </div>

      {goals.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
          Aún no tienes objetivos. Fíjate una meta (peso, visitas, consistencia…) para mantenerte
          motivado.
        </p>
      )}

      {goals.map((g) => (
        <div
          key={g.id}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {g.title ?? GOAL_TYPES.find((t) => t.value === g.goal_type)?.label ?? 'Objetivo'}
            </p>
            <div className="flex items-center gap-1">
              <Button size="icon-xs" variant="ghost" onClick={() => openEdit(g)} aria-label="Editar">
                <Pencil className="size-3.5" aria-hidden="true" />
              </Button>
              <Button size="icon-xs" variant="ghost" className="text-destructive" onClick={() => remove(g)} aria-label="Eliminar">
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
          {g.current != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Actual: <span className="font-mono font-semibold tabular-nums text-foreground">{g.current}</span>{' '}
              · Meta: <span className="font-mono font-semibold tabular-nums text-foreground">{g.target_value}</span>
            </p>
          )}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={cn('h-full rounded-full', g.progress >= 1 ? 'bg-success' : 'bg-primary')}
              style={{ width: `${Math.max(6, Math.round(g.progress * 100))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {g.label ?? `${Math.round(g.progress * 100)}%`}
            {g.progress >= 1 ? ' · ¡Meta cumplida! 🎉' : ''}
          </p>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar objetivo' : 'Nuevo objetivo'}</DialogTitle>
            <DialogDescription>
              Define una meta alcanzable. El progreso se calcula con tu actividad real.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo de objetivo</Label>
              <Select value={goalType} onValueChange={setGoalType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {goalType === 'personalizado' && (
              <div className="space-y-1.5">
                <Label>Nombre del objetivo</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Objetivo de agosto" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>
                Meta{' '}
                {GOAL_TYPES.find((t) => t.value === goalType)?.unit
                  ? `(${GOAL_TYPES.find((t) => t.value === goalType)?.unit})`
                  : ''}
              </Label>
              <Input
                type="number"
                step="0.1"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="p. ej. 16"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}