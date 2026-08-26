import { useEffect, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'

export interface Lead {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  source?: string | null
  status: string
  value?: number | null
  notes?: string | null
  created_at: string
}

export const PIPELINE_STAGES = ['nuevo', 'contacto', 'propuesta', 'ganado', 'perdido']

export const STAGE_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  contacto: 'Contacto',
  propuesta: 'Propuesta',
  ganado: 'Ganado',
  perdido: 'Perdido',
}

const SOURCES = ['Referido', 'Redes sociales', 'Web', 'Llamada', 'Walk-in', 'Evento']

export function LeadFormDialog({
  open,
  lead,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  lead: Lead | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('nuevo')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    setName(lead?.name ?? '')
    setPhone(lead?.phone ?? '')
    setEmail(lead?.email ?? '')
    setSource(lead?.source ?? '')
    setValue(lead?.value != null ? String(lead.value) : '')
    setNotes(lead?.notes ?? '')
    setStatus(lead?.status ?? 'nuevo')
    setError(null)
  }, [open, lead])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('El nombre del lead es obligatorio.')
      return
    }
    setSubmitting(true)
    try {
      const body = JSON.stringify({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        source: source || null,
        value: value ? Number(value) : null,
        notes: notes.trim() || null,
        status,
      })
      if (lead) {
        await apiFetch(`/leads/${lead.id}`, { method: 'PATCH', body })
        toast({ title: 'Lead actualizado', variant: 'success' })
      } else {
        await apiFetch('/leads', { method: 'POST', body })
        toast({ title: 'Lead registrado', description: `${name.trim()} entró al pipeline.`, variant: 'success' })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el lead')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" aria-hidden="true" />
            {lead ? 'Editar lead' : 'Nuevo lead'}
          </DialogTitle>
          <DialogDescription>
            {lead
              ? 'Actualiza la información y la etapa del lead.'
              : 'Captura un prospecto para incorporarlo al pipeline.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="55 1234 5678"
              />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lead@email.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fuente</Label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">—</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Valor estimado (MXN)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="ej. 1500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Etapa</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s] ?? s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interés, plan sugerido, seguimientos…"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}