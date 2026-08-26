import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Clock, Dumbbell, QrCode } from 'lucide-react'
import QRCode from 'qrcode'

import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { apiFetch } from '@/lib/api'

interface GuestPassData {
  token: string
  pass_type: string
  gym: { name: string; logo_url?: string | null }
  inviter_name?: string | null
  guest_name?: string | null
  expires_at: string
}

const TYPE_LABEL: Record<string, string> = {
  invitado: 'Pase de invitado',
  dia: 'Pase de día',
  clase: 'Pase de clase',
}

export function GuestPass() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [data, setData] = useState<GuestPassData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [qr, setQr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      setError('Falta el enlace del pase.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await apiFetch<GuestPassData>(`/guest-pass?token=${encodeURIComponent(token)}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el pase')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!showQr || !token) return
    let cancelled = false
    QRCode.toDataURL(`gymcore:pass:${token}`, { width: 220, margin: 1, color: { dark: '#161512' } }).then((url) => {
      if (!cancelled) setQr(url)
    })
    return () => {
      cancelled = true
    }
  }, [showQr, token])

  if (loading) return <LoadingState label="Cargando tu pase…" />

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <ErrorState
          title={error?.toLowerCase().includes('expirado') || error?.toLowerCase().includes('utilizado') ? 'Pase no válido' : 'No se pudo cargar'}
          description={error ?? 'Revisa el enlace del pase.'}
          className="max-w-md"
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-elevated">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          {data.gym.logo_url ? (
            <img src={data.gym.logo_url} alt="" className="size-12 rounded-full object-cover" />
          ) : (
            <Dumbbell className="size-6" aria-hidden="true" />
          )}
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight">{data.gym.name}</h1>
        <p className="mt-3 text-sm text-foreground">
          <span className="font-semibold">{data.inviter_name ?? 'Un socio'}</span> te ha invitado a
          entrenar.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{TYPE_LABEL[data.pass_type] ?? 'Pase'}</p>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Válido hasta</span>
          <span className="font-medium">
            {new Date(data.expires_at).toLocaleString('es-MX', {
              day: '2-digit',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {!showQr ? (
          <Button className="mt-5 w-full" onClick={() => setShowQr(true)}>
            <QrCode /> Mostrar QR
          </Button>
        ) : (
          <div className="mt-5">
            <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
              {qr ? (
                <img src={qr} alt="Pase" className="size-52" />
              ) : (
                <div className="size-52 animate-pulse bg-muted" />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Muéstralo en recepción para entrar. Es de un solo uso.
            </p>
          </div>
        )}

        {data.guest_name && (
          <p className="mt-4 text-xs text-muted-foreground">Invitación para {data.guest_name}</p>
        )}
      </div>
    </div>
  )
}