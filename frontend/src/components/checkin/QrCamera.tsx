import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface QrScannerLike {
  start: () => Promise<void>
  stop: () => void
  destroy: () => void
}

function QrCamera({
  onResult,
  onError,
  onClose,
  hint,
}: {
  onResult: (data: string) => void
  onError: (message: string) => void
  onClose: () => void
  hint?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let scanner: QrScannerLike | null = null
    let cancelled = false

    const boot = async () => {
      try {
        const mod = await import('qr-scanner')
        const QrScannerClass = (mod.default ?? mod) as {
          hasCamera: () => Promise<boolean>
          new (
            video: HTMLVideoElement,
            onDecode: (result: string) => void,
          ): QrScannerLike
        }
        const hasCamera = await QrScannerClass.hasCamera()
        if (!hasCamera) throw new Error('Este dispositivo no tiene cámara disponible')
        if (cancelled || !videoRef.current) return
        scanner = new QrScannerClass(videoRef.current, (result) => {
          onResult(result)
        })
        await scanner.start()
        if (!cancelled) setBusy(false)
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'No se pudo iniciar la cámara')
        }
      }
    }

    boot()
    return () => {
      cancelled = true
      scanner?.stop()
      scanner?.destroy()
    }
  }, [onResult, onError])

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className="aspect-video w-full object-cover"
        />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            Iniciando cámara…
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {hint ?? 'Apunta al código QR para registrarlo.'}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          <X /> Cancelar
        </Button>
      </div>
    </div>
  )
}

export default QrCamera