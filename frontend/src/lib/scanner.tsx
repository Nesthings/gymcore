import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import workerPath from 'qr-scanner/qr-scanner-worker.min.js?url'

import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { playBeep } from '@/lib/beep'

// qr-scanner carga su worker por una URL relativa que Vite no sirve; se fija
// explícitamente con un import `?url` (documentado para bundlers).
QrScanner.WORKER_PATH = workerPath

const DEBOUNCE_MS = 120_000 // 2 min: evita duplicados si el QR queda frente a la cámara
const PREF_KEY = 'gymcore_scanner_enabled'

export interface ScanResult {
  type: 'member' | 'pass'
  ok: boolean
  member?: string
  guest?: string
  at: number
}

interface ScannerValue {
  enabled: boolean
  activating: boolean
  lastResult: ScanResult | null
  enable: () => Promise<void>
  disable: () => void
}

const ScannerContext = createContext<ScannerValue | null>(null)

async function requestCameraPermission(): Promise<boolean> {
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

export function ScannerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const debounceRef = useRef<Map<string, number>>(new Map())
  const processRef = useRef<(decoded: string) => void>(() => {})
  const [enabled, setEnabled] = useState(false)
  const [activating, setActivating] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)

  const storageKey = `${PREF_KEY}:${user?.sub ?? 'guest'}`

  const stopScanner = useCallback(() => {
    scannerRef.current?.stop()
    scannerRef.current?.destroy()
    scannerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Procesa un QR decodificado: socio -> check-in, pase -> canje.
  const process = useCallback(
    async (decoded: string) => {
      const value = decoded.trim()
      let kind: 'member' | 'pass'
      let payload: string
      if (value.startsWith('gymcore:member:')) {
        kind = 'member'
        payload = value.slice('gymcore:member:'.length)
      } else if (value.startsWith('gymcore:pass:')) {
        kind = 'pass'
        payload = value.slice('gymcore:pass:'.length)
      } else {
        return // QR ajeno al gimnasio: ignorar
      }
      if (!payload) return

      const now = Date.now()
      const last = debounceRef.current.get(payload)
      if (last && now - last < DEBOUNCE_MS) return
      debounceRef.current.set(payload, now)
      if (debounceRef.current.size > 500) debounceRef.current.clear()

      try {
        if (kind === 'member') {
          const res = await apiFetch<{
            ok: boolean
            member_name: string
            plan_active: boolean
            message?: string
          }>('/checkin', { method: 'POST', body: JSON.stringify({ qr_token: decoded }) })
          setLastResult({ type: 'member', ok: res.ok, member: res.member_name, at: now })
          if (res.ok) {
            if (res.message?.includes('sesión activa')) {
              toast({ title: res.member_name, description: 'Ya está registrado (sesión activa)', variant: 'info' })
              playBeep(660, 0.09)
            } else if (!res.plan_active) {
              toast({ title: res.member_name, description: res.message ?? 'Sin membresía activa', variant: 'warning' })
              playBeep(440, 0.16)
            } else {
              toast({ title: 'Check-in registrado', description: res.member_name, variant: 'success' })
              playBeep()
            }
          } else {
            toast({ title: 'Check-in no válido', description: res.message ?? 'El código no corresponde a un socio activo.', variant: 'warning' })
            playBeep(300, 0.2)
          }
        } else {
          const res = await apiFetch<{ guest_name: string; inviter_name?: string | null }>('/passes/redeem', {
            method: 'POST',
            body: JSON.stringify({ token: payload }),
          })
          setLastResult({ type: 'pass', ok: true, guest: res.guest_name, at: now })
          toast({
            title: 'Pase canjeado',
            description: `${res.guest_name} entró${res.inviter_name ? ` · invitado por ${res.inviter_name}` : ''}.`,
            variant: 'success',
          })
          playBeep()
        }
      } catch (err) {
        toast({
          title: 'Error de lectura',
          description: err instanceof Error ? err.message : 'No se pudo registrar.',
          variant: 'error',
        })
        playBeep(280, 0.25)
      }
    },
    [toast],
  )

  useEffect(() => {
    processRef.current = process
  }, [process])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Cámara no disponible en este dispositivo')
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    })
    streamRef.current = stream
    if (!videoRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      throw new Error('No se pudo montar el video del lector')
    }
    videoRef.current.srcObject = stream
    const scanner = new QrScanner(videoRef.current, (decoded) => processRef.current(decoded))
    scannerRef.current = scanner
    try {
      await scanner.start()
    } catch (err) {
      scannerRef.current = null
      throw err
    }
  }, [])

  const enable = useCallback(async () => {
    if (activating) return
    setActivating(true)
    try {
      const ok = await requestCameraPermission()
      if (!ok) throw new Error('No se pudo acceder a la cámara. Revisa los permisos.')
      await start()
      setEnabled(true)
      try {
        localStorage.setItem(storageKey, '1')
      } catch {
        // sin almacenamiento
      }
      toast({ title: 'Lector QR activado', description: 'Se registrarán los check-ins automáticamente.', variant: 'success' })
    } catch (err) {
      stopScanner()
      setEnabled(false)
      try {
        localStorage.setItem(storageKey, '0')
      } catch {
        // sin almacenamiento
      }
      toast({
        title: 'No se pudo activar el lector',
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
        variant: 'error',
      })
    } finally {
      setActivating(false)
    }
  }, [activating, start, stopScanner, toast, storageKey])

  const disable = useCallback(() => {
    stopScanner()
    setEnabled(false)
    try {
      localStorage.setItem(storageKey, '0')
    } catch {
      // sin almacenamiento
    }
  }, [stopScanner, storageKey])

  // Pausar al pasar la pestaña a segundo plano; reanudar al volver.
  useEffect(() => {
    if (!enabled) return
    const onVis = () => {
      if (document.hidden) {
        scannerRef.current?.stop()
      } else {
        scannerRef.current?.start().catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [enabled])

  // Auto-inicio al cargar si la preferencia quedó activada (y el permiso ya
  // está concedido). Sin toast: si falla, el toggle queda OFF para un tap.
  useEffect(() => {
    let stored = false
    try {
      stored = localStorage.getItem(storageKey) === '1'
    } catch {
      // sin almacenamiento: se mantiene OFF
    }
    if (!stored) return
    let cancelled = false
    ;(async () => {
      try {
        await start()
        if (!cancelled) setEnabled(true)
      } catch {
        try {
          localStorage.setItem(storageKey, '0')
        } catch {
          // sin almacenamiento
        }
      }
    })()
    return () => {
      cancelled = true
      stopScanner()
    }
  }, [storageKey, start, stopScanner])

  return (
    <ScannerContext.Provider
      value={{ enabled, activating, lastResult, enable, disable }}
    >
      {/* El video vive off-screen (fuera de la vista) pero con tamaño real para
          que qr-scanner pueda decodificar. */}
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden="true"
        className="pointer-events-none fixed -left-[9999px] top-0 h-40 w-40 opacity-0"
      />
      {children}
    </ScannerContext.Provider>
  )
}

export function useScanner(): ScannerValue {
  const ctx = useContext(ScannerContext)
  if (!ctx) throw new Error('useScanner debe usarse dentro de <ScannerProvider>')
  return ctx
}