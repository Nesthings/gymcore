import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, QrCode, ScanLine } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { useToast } from '@/components/ui/toast'
import QrCamera, { requestCameraPermission } from '@/components/checkin/QrCamera'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

interface MemberOption {
  id: string
  full_name: string
  email?: string | null
  photo_url?: string | null
  membership?: { plan_name?: string | null } | null
}

interface CheckinResult {
  ok: boolean
  member_name: string
  plan_active: boolean
  message?: string
}

/**
 * CheckinScanner: buscador de socios + registro de check-in, con modo QR
 * opcional (qr-scanner). Muestra un indicador de éxito con animación sutil.
 */
export function CheckinScanner({
  onChecked,
}: {
  onChecked?: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberOption[]>([])
  const [selected, setSelected] = useState<MemberOption | null>(null)
  const [scanMode, setScanMode] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<CheckinResult | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!query.trim() || selected) {
      setResults([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      apiFetch<MemberOption[]>(
        `/members?search=${encodeURIComponent(query.trim())}&limit=6&status=active`,
      )
        .then((res) => {
          if (alive) setResults(res)
        })
        .catch(() => undefined)
    }, 150)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query, selected])

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setSelected(null)
  }, [])

  const handleQr = useCallback(
    async (data: string) => {
      setScanMode(false)
      setSubmitting(true)
      setCameraError(null)
      try {
        const res = await apiFetch<CheckinResult>('/checkin', {
          method: 'POST',
          body: JSON.stringify({ qr_token: data }),
        })
        if (res.ok) {
          setSuccess(res)
          toast({
            title: 'Check-in registrado',
            description: `${res.member_name} · ${res.message ?? 'Acceso confirmado'}`,
            variant: 'success',
          })
          onChecked?.()
        } else {
          toast({
            title: 'Check-in no válido',
            description: res.message ?? 'El código no corresponde a un socio activo.',
            variant: 'warning',
          })
        }
      } catch (err) {
        toast({
          title: 'No se pudo registrar el check-in',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        })
      } finally {
        setSubmitting(false)
      }
    },
    [onChecked, toast],
  )

  const submit = async () => {
    if (!selected) return
    setSubmitting(true)
    setSuccess(null)
    try {
      const res = await apiFetch<CheckinResult>('/checkin', {
        method: 'POST',
        body: JSON.stringify({ member_id: selected.id }),
      })
      if (res.ok) {
        setSuccess(res)
        toast({
          title: 'Check-in registrado',
          description: `${res.member_name} · ${res.message ?? 'Acceso confirmado'}`,
          variant: 'success',
        })
        onChecked?.()
      } else {
        toast({
          title: 'Check-in no válido',
          description: res.message ?? 'La membresía del socio no está activa.',
          variant: 'warning',
        })
      }
    } catch (err) {
      toast({
        title: 'No se pudo registrar el check-in',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleQrResult = useCallback((data: string) => handleQr(data), [handleQr])

  const handleQrError = useCallback((message: string) => {
    setCameraError(message)
    setScanMode(false)
  }, [])

  const startScan = useCallback(async () => {
    setCameraError(null)
    const ok = await requestCameraPermission()
    if (!ok) {
      setCameraError('No se pudo acceder a la cámara. Revisa los permisos o busca al socio por nombre.')
      return
    }
    setScanMode(true)
  }, [])

  return (
    <div className="space-y-4">
      {success ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-success/30 bg-success/5 px-6 py-12 text-center animate-in zoom-in-95 fade-in-0 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success animate-in zoom-in-90 fade-in-0 duration-500 motion-reduce:animate-none">
            <CheckCircle2 className="size-9" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{success.member_name}</p>
            <p className="text-sm text-muted-foreground">
              {success.message ?? 'Check-in registrado correctamente.'}
            </p>
          </div>
          <div className="mt-1 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSuccess(null)
                clear()
              }}
            >
              Registrar otro
            </Button>
            <Button size="sm" onClick={startScan}>
              <ScanLine /> Escanear QR
            </Button>
          </div>
        </div>
      ) : scanMode ? (
        <QrCamera
          onResult={handleQrResult}
          onError={handleQrError}
          onClose={() => setScanMode(false)}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <SearchInput
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelected(null)
              }}
              onClear={clear}
              placeholder="Buscar socio por nombre o correo…"
            />
            <Button
              variant="outline"
              onClick={startScan}
            >
              <QrCode /> Escanear QR
            </Button>
          </div>

          {cameraError && (
            <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
              {cameraError}
            </p>
          )}

          {!selected && results.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelected(m)
                    setResults([])
                    setQuery(m.full_name)
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <Avatar
                    src={m.photo_url}
                    name={m.full_name}
                    className="size-9 border-2 border-primary/20"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {m.full_name}
                    </span>
                    {m.email && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.email}
                      </span>
                    )}
                  </span>
                  {m.membership?.plan_name && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {m.membership.plan_name}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  src={selected.photo_url}
                  name={selected.full_name}
                  className="size-10 shrink-0 border-2 border-primary/20"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {selected.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selected.membership?.plan_name ?? 'Sin membresía activa'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 sm:ml-auto">
                <Button variant="outline" size="sm" onClick={clear}>
                  Cambiar
                </Button>
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={submitting}
                  className={cn('transition-transform active:scale-[0.98]')}
                >
                  {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Registrar check-in
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}