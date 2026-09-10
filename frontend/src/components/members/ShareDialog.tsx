import { useCallback, useEffect, useState } from 'react'
import { Link2, QrCode, RefreshCw, ShieldOff } from 'lucide-react'
import QRCode from 'qrcode'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'

interface ShareInfo {
  share_url: string
  expires_at: string | null
  expires_in_days: number | null
}

export function ShareDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId: string
  memberName: string
}) {
  const [share, setShare] = useState<ShareInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const { toast } = useToast()

  const absolute = share ? `${window.location.origin}${share.share_url}` : null
  // QR de check-in: codifica el UUID del socio (permanente). No depende del
  // share token, así que regenerar/revocar el enlace del portal NO lo rompe.
  const qrValue = `gymcore:member:${memberId}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<ShareInfo>(`/members/${memberId}/share`)
      setShare(res)
    } catch {
      setShare(null)
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    if (open) {
      setShare(null)
      setCopied(false)
      load()
    }
  }, [open, load])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    QRCode.toDataURL(qrValue, { width: 220, margin: 1, color: { dark: '#161512' } }).then((url) => {
      if (!cancelled) setQr(url)
    })
    return () => {
      cancelled = true
    }
  }, [qrValue, open])

  const generate = async (rotate = false) => {
    setLoading(true)
    try {
      const res = await apiFetch<ShareInfo>(`/members/${memberId}/share`, { method: 'POST' })
      setShare(res)
      toast({
        title: rotate ? 'Invitación regenerada' : 'Invitación generada',
        description: rotate
          ? 'El enlace anterior quedó revocado.'
          : 'Comparte el enlace con el socio para que acceda a su portal.',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'No se pudo generar',
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!absolute) return
    try {
      await navigator.clipboard.writeText(absolute)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast({ title: 'No se pudo copiar', variant: 'error' })
    }
  }

  const revoke = async () => {
    setRevoking(true)
    try {
      await apiFetch(`/members/${memberId}/share`, { method: 'DELETE' })
      setShare(null)
      toast({
        title: 'Acceso al portal revocado',
        description:
          'El enlace del portal dejó de funcionar. El QR de check-in sigue activo.',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'No se pudo revocar',
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
        variant: 'error',
      })
    } finally {
      setRevoking(false)
      setConfirmRevoke(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" /> Acceso del socio
          </DialogTitle>
          <DialogDescription>
            El QR de check-in del socio y, si quieres, un enlace para que entre a su portal (foto,
            rachas, historial y registro de peso).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR de check-in (permanente, independiente del enlace del portal) */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-3 text-sm font-medium text-foreground">QR de check-in</p>
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
              <div className="shrink-0 self-center rounded-lg border border-border bg-white p-2">
                {qr ? (
                  <img src={qr} alt={`QR de ${memberName}`} className="size-44" />
                ) : (
                  <div className="size-44 animate-pulse bg-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Badge variant="soft-success">Permanente · para check-in</Badge>
                <p className="text-xs text-muted-foreground">
                  El socio muestra este QR en recepción para registrar su entrada y salida. No cambia
                  ni expira, y no se ve afectado al regenerar o revocar el enlace del portal.
                </p>
              </div>
            </div>
          </div>

          {/* Portal: enlace de invitación (sin vencimiento, revocable) */}
          {loading && !share && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Verificando invitación…
            </p>
          )}

          {!loading && !share && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {memberName} aún no tiene enlace para entrar a su portal (foto, rachas, historial y
                peso).
              </p>
              <Button className="mt-3" size="sm" onClick={() => generate(false)} disabled={loading}>
                <Link2 /> Generar enlace del portal
              </Button>
            </div>
          )}

          {share && absolute && (
            <div className="space-y-2 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                Enlace del portal · sin vencimiento
              </p>
              <p className="break-all rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs text-foreground">
                {absolute}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={copy}>
                  {copied ? 'Copiado' : 'Copiar enlace'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => generate(true)} disabled={loading}>
                  <RefreshCw /> Regenerar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmRevoke(true)}
                >
                  <ShieldOff /> Revocar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={(open) => !open && setConfirmRevoke(false)}
        title="¿Revocar el enlace del portal?"
        description="El enlace del portal dejará de funcionar de inmediato. El QR de check-in sigue activo."
        confirmLabel="Revocar"
        variant="destructive"
        busy={revoking}
        onConfirm={revoke}
      />
    </Dialog>
  )
}