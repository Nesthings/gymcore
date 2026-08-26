import { useCallback, useEffect, useState } from 'react'
import { Link2, QrCode, RefreshCw } from 'lucide-react'
import QRCode from 'qrcode'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  expires_at: string
  expires_in_days: number
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
  const { toast } = useToast()

  const absolute = share ? `${window.location.origin}${share.share_url}` : null

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
      setQr(null)
      setCopied(false)
      load()
    }
  }, [open, load])

  useEffect(() => {
    if (!absolute) {
      setQr(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(absolute, { width: 220, margin: 1, color: { dark: '#161512' } }).then((url) => {
      if (!cancelled) setQr(url)
    })
    return () => {
      cancelled = true
    }
  }, [absolute])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" /> Acceso del socio
          </DialogTitle>
          <DialogDescription>
            Genera un enlace (60 días) para que {memberName} entre a su portal: foto, QR de
            check-in, rachas, historial y registro de peso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading && !share && (
            <p className="py-6 text-center text-sm text-muted-foreground">Verificando invitación…</p>
          )}

          {!loading && !share && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Aún no hay invitación activa para este socio.
              </p>
              <Button className="mt-3" size="sm" onClick={() => generate(false)} disabled={loading}>
                <Link2 /> Generar invitación
              </Button>
            </div>
          )}

          {share && absolute && (
            <>
              <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row">
                <div className="shrink-0 rounded-lg border border-border bg-white p-2">
                  {qr ? (
                    <img src={qr} alt={`QR de ${memberName}`} className="size-44" />
                  ) : (
                    <div className="size-44 animate-pulse bg-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Badge variant="soft-success">Vigente · {share.expires_in_days} días</Badge>
                  <p className="text-xs text-muted-foreground">
                    Vence el{' '}
                    {new Date(share.expires_at).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs text-foreground">
                    {absolute}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={copy}>
                      {copied ? 'Copiado' : 'Copiar enlace'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => generate(true)} disabled={loading}>
                      <RefreshCw /> Regenerar
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                El enlace del portal es personal. Al regenerarlo, el anterior deja de funcionar. El
                QR de arriba es el que el socio muestra en recepción para hacer check-in.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}