import { useEffect, useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
]

interface MemberWithMembership {
  id: string
  member_id: string
  member_name: string
  plan_name?: string
}

function todayISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * PaymentFormDialog: registra un pago. El socio se elige entre quienes tienen
 * una membresía activa (el cobro suele ser la renovación del plan).
 */
export function PaymentFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [members, setMembers] = useState<MemberWithMembership[]>([])
  const [memberId, setMemberId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [concept, setConcept] = useState('')
  const [paidAt, setPaidAt] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    let alive = true
    apiFetch<MemberWithMembership[]>('/memberships?status=active')
      .then((res) => {
        if (alive) setMembers(res)
      })
      .catch(() => undefined)
    setMemberId('')
    setAmount('')
    setMethod('')
    setConcept('')
    setPaidAt(todayISO())
    setError(null)
    return () => {
      alive = false
    }
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!memberId) {
      setError('Selecciona al socio.')
      return
    }
    if (!amount || Number(amount) <= 0) {
      setError('Ingresa un monto válido.')
      return
    }
    if (!method) {
      setError('Selecciona el método de pago.')
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        member_id: memberId,
        amount: Number(amount),
        method,
      }
      if (concept.trim()) body.concept = concept.trim()
      if (paidAt) body.paid_at = paidAt
      await apiFetch('/payments', { method: 'POST', body: JSON.stringify(body) })
      toast({
        title: 'Pago registrado',
        description: 'El pago quedó registrado y el socio está al corriente.',
        variant: 'success',
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-primary" aria-hidden="true" /> Registrar pago
          </DialogTitle>
          <DialogDescription>
            Cobro de membresía o concepto adicional para un socio.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="space-y-2">
            <Label>Socio con membresía activa *</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona al socio" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.member_id}>
                    {m.member_name}
                    {m.plan_name ? ` · ${m.plan_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay socios con membresía activa para cobrar.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monto *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="599"
              />
            </div>
            <div className="space-y-2">
              <Label>Método *</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Efectivo" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Concepto</Label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="ej. Membresía mensual"
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha de pago</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <CreditCard />} Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}