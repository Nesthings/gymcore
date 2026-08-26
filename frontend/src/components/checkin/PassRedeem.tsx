import { useState } from 'react'
import { PartyPopper, Ticket } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'

export function PassRedeem() {
  const [token, setToken] = useState('')
  const [result, setResult] = useState<{
    guest_name: string
    inviter_name?: string | null
    lead_id: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) {
      toast({ title: 'Ingresa el token del pase', variant: 'error' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await apiFetch<{ guest_name: string; inviter_name?: string | null; lead_id: string }>(
        '/passes/redeem',
        { method: 'POST', body: JSON.stringify({ token: token.trim() }) },
      )
      setResult(res)
      setToken('')
      toast({
        title: 'Pase canjeado',
        description: `${res.guest_name} entró gracias a un pase de invitado.`,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'No se pudo canjear',
        description: err instanceof Error ? err.message : 'Verifica el token.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={redeem} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="pass-token">Token del pase</Label>
          <Input
            id="pass-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Pega el token del QR del invitado"
            className="font-mono"
          />
        </div>
        <Button type="submit" disabled={busy}>
          <Ticket /> Canjear
        </Button>
      </form>

      {result && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <PartyPopper className="size-4 text-primary" aria-hidden="true" /> ¡Pase canjeado!
          </p>
          <p className="mt-1 text-muted-foreground">
            <span className="font-medium text-foreground">{result.guest_name}</span> entró al gimnasio
            {result.inviter_name ? ` · invitado por ${result.inviter_name}` : ''}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Se creó un lead automáticamente en el CRM para dar seguimiento (fuente: pase de invitado).
          </p>
        </div>
      )}
    </div>
  )
}