import { useEffect, useState } from 'react'
import { CalendarDays, Dumbbell, Loader2 } from 'lucide-react'

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

interface PlanOption {
  id: string
  name: string
  price: number
  duration_days: number
  is_active: boolean
}

interface MemberOption {
  id: string
  full_name: string
  email?: string | null
}

function todayISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * AssignPlanDialog: asigna un plan de membresía a un socio.
 * Si se pasa `memberId` el socio es fijo (detalle de socio); si no, incluye
 * buscador de socios (página de membresías).
 */
export function AssignPlanDialog({
  memberId,
  memberName,
  open,
  onOpenChange,
  onAssigned,
}: {
  memberId?: string | null
  memberName?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssigned: () => void
}) {
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState<MemberOption[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedMemberName, setSelectedMemberName] = useState('')
  const [planId, setPlanId] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [paidAmount, setPaidAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    let alive = true
    apiFetch<PlanOption[]>('/membership-plans')
      .then((res) => {
        if (alive) setPlans(res.filter((p) => p.is_active))
      })
      .catch(() => undefined)
    setMemberQuery('')
    setMemberResults([])
    setSelectedMemberId('')
    setSelectedMemberName('')
    setPlanId('')
    setStartDate(todayISO())
    setPaidAmount('')
    setPaymentMethod('')
    setError(null)
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    if (memberId || !open || !memberQuery.trim()) {
      setMemberResults([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      apiFetch<MemberOption[]>(
        `/members?search=${encodeURIComponent(memberQuery.trim())}&limit=6`,
      )
        .then((res) => {
          if (alive) setMemberResults(res)
        })
        .catch(() => undefined)
    }, 150)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [memberQuery, memberId, open])

  const targetMemberId = memberId ?? selectedMemberId

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!targetMemberId) {
      setError('Selecciona al socio.')
      return
    }
    if (!planId) {
      setError('Selecciona el plan.')
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        plan_id: planId,
        start_date: startDate || null,
      }
      if (paidAmount) body.paid_amount = Number(paidAmount)
      if (paymentMethod) body.payment_method = paymentMethod
      await apiFetch(`/members/${targetMemberId}/memberships`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast({
        title: 'Membresía asignada',
        description: 'El plan quedó activado para el socio.',
        variant: 'success',
      })
      onAssigned()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar la membresía')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="size-5 text-primary" aria-hidden="true" /> Asignar membresía
          </DialogTitle>
          <DialogDescription>
            {memberId && memberName
              ? `${memberName} · Selecciona el plan y la fecha de inicio.`
              : 'Selecciona al socio y el plan a activar.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          {!memberId && (
            <div className="space-y-2">
              <Label>Socio *</Label>
              <Input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Buscar por nombre o correo…"
              />
              {memberResults.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-border">
                  {memberResults.map((m) => {
                    const active = selectedMemberId === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(m.id)
                          setSelectedMemberName(m.full_name)
                          setMemberQuery('')
                          setMemberResults([])
                        }}
                        className={
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent ' +
                          (active ? 'bg-primary/5' : '')
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {m.full_name}
                          </span>
                          {m.email && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {m.email}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              {selectedMemberId && selectedMemberName && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {selectedMemberName}
                    </span>
                    <span className="block text-xs text-success">
                      Socio seleccionado ✓
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground"
                    onClick={() => {
                      setSelectedMemberId('')
                      setSelectedMemberName('')
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Plan *</Label>
            <Select
              value={planId}
              onValueChange={(value) => {
                setPlanId(value)
                const plan = plans.find((p) => p.id === value)
                if (plan) setPaidAmount(String(plan.price))
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.duration_days} días
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha de inicio</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monto pagado</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Opcional" />
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <CalendarDays />} Activar plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}