import { useCallback, useEffect, useState } from 'react'
import { Copy, QrCode, RefreshCw, Ticket, X } from 'lucide-react'
import QRCode from 'qrcode'

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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { buildWhatsAppUrl, detectPlatform } from '@/lib/share'
import { cn } from '@/lib/utils'

interface PassPolicy {
  pass_type?: string | null
  pass_period?: string | null
  pass_duration_days?: number | null
  requires_guest: boolean
  ask_phone: boolean
  ask_email: boolean
  expiry_hours?: number
}

interface PassHistoryItem {
  id: string
  pass_type: string
  status: string
  guest_name?: string | null
  generated_at?: string | null
  expires_at?: string | null
  redeemed_at?: string | null
}

interface PassesData {
  policy: PassPolicy
  available: number
  renewal_date?: string | null
  history: PassHistoryItem[]
}

const TYPE_LABEL: Record<string, string> = {
  invitado: 'Pase de invitado',
  dia: 'Pase de día',
  clase: 'Pase de clase',
}

const STATUS_META: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' }> = {
  generated: { label: 'Generado', variant: 'warning' },
  redeemed: { label: 'Usado', variant: 'success' },
  expired: { label: 'Expirado', variant: 'secondary' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
}

export function PassesSection({
  token,
  className,
}: {
  token: string
  className?: string
}) {
  const [data, setData] = useState<PassesData | null>(null)
  const [open, setOpen] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<{ token: string; share_url: string; expires_at: string; guest_name?: string | null } | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<PassesData>(`/member-share/passes?token=${encodeURIComponent(token)}`))
    } catch {
      // best-effort
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!generated) {
      setQr(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(`${window.location.origin}${generated.share_url}`, {
      width: 200,
      margin: 1,
      color: { dark: '#161512' },
    }).then((url) => {
      if (!cancelled) setQr(url)
    })
    return () => {
      cancelled = true
    }
  }, [generated])

  const openGenerate = () => {
    setGenerated(null)
    setQr(null)
    setGuestName('')
    setGuestPhone('')
    setGuestEmail('')
    setOpen(true)
  }

  const generate = async (e: React.FormEvent) => {
    e.preventDefault()
    const policy = data?.policy
    if (policy?.requires_guest && !guestName.trim()) {
      toast({ title: 'Registra al invitado', description: 'Este pase requiere el nombre de la persona.', variant: 'error' })
      return
    }
    setGenerating(true)
    const body: Record<string, string> = {}
    if (guestName.trim()) body.guest_name = guestName.trim()
    if (policy?.ask_phone && guestPhone.trim()) body.guest_phone = guestPhone.trim()
    if (policy?.ask_email && guestEmail.trim()) body.guest_email = guestEmail.trim()
    try {
      const res = await apiFetch<{ token: string; share_url: string; expires_at: string; guest_name?: string | null }>(
        `/member-share/passes/generate?token=${encodeURIComponent(token)}`,
        { method: 'POST', body: JSON.stringify(body) },
      )
      setGenerated(res)
      await load()
    } catch (err) {
      toast({ title: 'No se pudo generar', description: err instanceof Error ? err.message : 'Intenta de nuevo.', variant: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  const cancel = async () => {
    if (!generated) return
    try {
      const passId = data?.history.find((h) => h.status === 'generated')?.id
      if (passId) {
        await apiFetch(`/member-share/passes/${passId}/cancel?token=${encodeURIComponent(token)}`, { method: 'POST' })
      }
    } catch {
      // best-effort
    }
    setOpen(false)
    setGenerated(null)
    await load()
  }

  const copyLink = async () => {
    if (!generated) return
    const url = `${window.location.origin}${generated.share_url}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast({ title: 'No se pudo copiar', variant: 'error' })
    }
  }

  if (!data) return null
  const { policy, available, renewal_date, history } = data
  const hasPasses = policy.pass_type != null && available > 0

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Ticket className="size-4 text-primary" aria-hidden="true" /> Mis pases
        </h2>
        {hasPasses && (
          <Button size="sm" onClick={openGenerate}>
            <QrCode /> Generar pase
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Pases disponibles</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">
          {available}
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            {TYPE_LABEL[policy.pass_type ?? ''] ?? 'pase'}
          </span>
        </p>
        {renewal_date && (
          <p className="mt-1 text-xs text-muted-foreground">
            Se renueva el{' '}
            {new Date(renewal_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long' })}
          </p>
        )}
        {!hasPasses && policy.pass_type != null && available <= 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Ya usaste tus pases de este periodo. Se renuevan automáticamente.
          </p>
        )}
        {policy.pass_type == null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Tu plan actual no incluye pases.
          </p>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historial de invitados
          </p>
          <div className="space-y-1.5">
            {history.map((h) => {
              const meta = STATUS_META[h.status] ?? { label: h.status, variant: 'secondary' as const }
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="truncate font-medium">{h.guest_name ?? 'Invitado'}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {h.redeemed_at &&
                      new Date(h.redeemed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="size-5 text-primary" /> {generated ? 'Tu pase está listo' : 'Generar pase'}
            </DialogTitle>
            <DialogDescription>
              {generated
                ? 'Compártelo con la persona que quieres invitar.'
                : 'Invita a una persona a entrenar contigo.'}
            </DialogDescription>
          </DialogHeader>

          {!generated && (
            <form onSubmit={generate} className="space-y-3">
              {policy.requires_guest && (
                <div className="space-y-1.5">
                  <Label>¿A quién vas a invitar? *</Label>
                  <Input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Nombre del invitado"
                    required
                  />
                </div>
              )}
              {policy.ask_phone && (
                <div className="space-y-1.5">
                  <Label>Teléfono (opcional)</Label>
                  <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="55 1234 5678" />
                </div>
              )}
              {policy.ask_email && (
                <div className="space-y-1.5">
                  <Label>Correo (opcional)</Label>
                  <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="invitado@correo.com" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                El pase es de un solo uso y expira en{' '}
                {policy.expiry_hours ? `${policy.expiry_hours} horas` : '24 horas'}.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={generating}>
                  {generating ? 'Generando…' : 'Generar pase'}
                </Button>
              </div>
            </form>
          )}

          {generated && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center">
                {qr ? <img src={qr} alt="Pase" className="size-44" /> : <div className="size-44 animate-pulse bg-muted" />}
                <p className="text-sm font-medium">
                  {TYPE_LABEL[policy.pass_type ?? ''] ?? 'Pase'} · válido hasta{' '}
                  {new Date(generated.expires_at).toLocaleString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const url = `${window.location.origin}${generated.share_url}`
                      const message = `¡Te invito a entrenar conmigo! ${TYPE_LABEL[policy.pass_type ?? ''] ?? 'Pase'}: ${url}`
                      const whatsappUrl = buildWhatsAppUrl(message)
                      if (detectPlatform() === 'ios') {
                        window.location.href = whatsappUrl
                      } else {
                        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
                      }
                    }}
                  >
                    WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={copyLink}>
                    {copied ? <RefreshCw /> : <Copy />} {copied ? 'Copiado' : 'Copiar enlace'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={cancel}>
                    <X /> Cancelar pase
                  </Button>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                El invitado abre el enlace, ve el QR y lo muestra en recepción para entrar.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}