import { useCallback, useRef, useState } from 'react'
import { PartyPopper, ScanLine, Ticket } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import QrCamera, { requestCameraPermission } from '@/components/checkin/QrCamera'
import { apiFetch } from '@/lib/api'

function extractPassToken(decoded: string): string | null {
  const value = decoded.trim()
  if (!value) return null
  // Caso 1: URL completa o relativa (`https://.../g?token=...` o `/g?token=...`)
  try {
    const url = new URL(value, window.location.origin)
    const t = url.searchParams.get('token')
    if (t && t.trim()) return t.trim()
  } catch {
    // no es URL parseable
  }
  // Caso 2: esquema propio `gymcore:pass:<token>`
  if (value.startsWith('gymcore:pass:')) {
    const t = value.slice('gymcore:pass:'.length).trim()
    return t || null
  }
  // Caso 3: parámetro suelto `token=<token>`
  if (value.startsWith('token=')) {
    const t = value.slice('token='.length).trim()
    return t || null
  }
  // Caso 4: token crudo
  return value
}

export function PassRedeem() {
  const [token, setToken] = useState('')
  const [result, setResult] = useState<{
    guest_name: string
    inviter_name?: string | null
    lead_id: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  // El scanner emite varios `onResult` por el mismo QR; con esta bandera solo
  // se canjea UNA vez por escaneo (evita toasts de "ya utilizado" duplicados).
  const redeemingRef = useRef(false)
  const { toast } = useToast()

  const redeem = useCallback(
    async (rawToken: string) => {
      if (redeemingRef.current) return
      redeemingRef.current = true
      setBusy(true)
      setResult(null)
      try {
        const res = await apiFetch<{
          guest_name: string
          inviter_name?: string | null
          lead_id: string
        }>('/passes/redeem', { method: 'POST', body: JSON.stringify({ token: rawToken }) })
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
        redeemingRef.current = false
      }
    },
    [toast],
  )

  const handleForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) {
      toast({ title: 'Ingresa el token del pase', variant: 'error' })
      return
    }
    redeem(token.trim())
  }

  const openScanner = async () => {
    setCameraError(null)
    const ok = await requestCameraPermission()
    if (!ok) {
      setCameraError('No se pudo acceder a la cámara. Revisa los permisos o pega el token.')
      return
    }
    setScannerOpen(true)
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleForm} className="flex flex-wrap items-end gap-2">
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
        <Button type="button" variant="outline" onClick={openScanner}>
          <ScanLine /> Escanear QR
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

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="size-5 text-primary" /> Escanear pase
            </DialogTitle>
            <DialogDescription>
              Apunta a la cámara al QR del invitado. Se canjeará automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <QrCamera
              onResult={(decoded) => {
                const t = extractPassToken(decoded)
                if (!t) return
                setScannerOpen(false)
                redeem(t)
              }}
              onError={(message) => {
                setCameraError(message)
                setScannerOpen(false)
              }}
              onClose={() => setScannerOpen(false)}
              hint="Apunta al QR del pase del invitado. Se canjeará automáticamente."
            />
            {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}