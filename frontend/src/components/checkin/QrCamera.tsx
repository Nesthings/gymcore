import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import workerPath from 'qr-scanner/qr-scanner-worker.min.js?url'
import { Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

// qr-scanner carga su worker calculando la URL relativa a su propio módulo.
// Con Vite (dev/build) esa URL no existe, así que se fija explícitamente con
// un import `?url` para que Vite emita y sirva el worker correctamente.
QrScanner.WORKER_PATH = workerPath

/** Pide el permiso de cámara DENTRO del gesto del usuario (clic). */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return false
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch {
    return false
  }
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
  // Refs estables: el efecto de la cámara se ejecuta UNA vez; los callbacks se
  // actualizan en un efecto aparte (no durante el render) para no reiniciar.
  const resultRef = useRef(onResult)
  const errorRef = useRef(onError)
  useEffect(() => {
    resultRef.current = onResult
    errorRef.current = onError
  }, [onResult, onError])

  useEffect(() => {
    let scanner: QrScanner | null = null
    let cancelled = false

    const boot = async () => {
      try {
        const hasCamera = await QrScanner.hasCamera()
        if (!hasCamera) throw new Error('Este dispositivo no tiene cámara disponible')
        if (cancelled || !videoRef.current) return
        scanner = new QrScanner(videoRef.current, (result) => {
          resultRef.current(result)
        })
        await scanner.start()
        if (!cancelled) setBusy(false)
      } catch (err) {
        if (!cancelled) {
          errorRef.current(err instanceof Error ? err.message : 'No se pudo iniciar la cámara')
        }
      }
    }

    boot()
    return () => {
      cancelled = true
      scanner?.stop()
      scanner?.destroy()
    }
  }, [])

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