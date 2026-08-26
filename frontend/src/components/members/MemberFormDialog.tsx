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

export interface MemberFormData {
  id?: string
  full_name: string
  email?: string | null
  phone?: string | null
  birth_date?: string | null
  gender?: string | null
  emergency_contact?: string | null
  notes?: string | null
}

const GENDERS = [
  { value: 'hombre', label: 'Hombre' },
  { value: 'mujer', label: 'Mujer' },
  { value: 'otro', label: 'Otro' },
]

/**
 * MemberFormDialog: alta y edición de un socio. Usa POST /members para
 * crear y PATCH /members/{id} para actualizar.
 */
export function MemberFormDialog({
  open,
  member,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  member: MemberFormData | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    setFullName(member?.full_name ?? '')
    setEmail(member?.email ?? '')
    setPhone(member?.phone ?? '')
    setBirthDate(member?.birth_date ?? '')
    setGender(member?.gender ?? '')
    setEmergencyContact(member?.emergency_contact ?? '')
    setNotes(member?.notes ?? '')
    setError(null)
  }, [open, member])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!fullName.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSubmitting(true)
    try {
      const body = JSON.stringify({
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        gender: gender || null,
        emergency_contact: emergencyContact.trim() || null,
        notes: notes.trim() || null,
      })
      if (member?.id) {
        await apiFetch(`/members/${member.id}`, { method: 'PATCH', body })
        toast({
          title: 'Socio actualizado',
          description: 'Los datos se guardaron correctamente.',
          variant: 'success',
        })
      } else {
        await apiFetch('/members', { method: 'POST', body })
        toast({
          title: 'Socio registrado',
          description: `${fullName.trim()} quedó dado de alta.`,
          variant: 'success',
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar al socio')
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
            {member?.id ? 'Editar socio' : 'Nuevo socio'}
          </DialogTitle>
          <DialogDescription>
            {member?.id
              ? 'Actualiza la información del socio.'
              : 'Registra a un nuevo socio del gimnasio.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="space-y-2">
            <Label>Nombre completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="socio@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="55 1234 5678"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de nacimiento</Label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Género</Label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">—</option>
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Contacto de emergencia</Label>
            <Input
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="Nombre y teléfono de contacto alternativo"
            />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Restricciones, objetivos, observaciones…"
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