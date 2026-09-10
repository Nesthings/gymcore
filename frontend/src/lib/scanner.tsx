import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import QrScanner from 'qr-scanner'
import workerPath from 'qr-scanner/qr-scanner-worker.min.js?url'

import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { playBeep, playCheckin, playCheckout } from '@/lib/beep'

// qr-scanner carga su worker por una URL relativa que Vite no sirve; se fija
// explícitamente con un import `?url` (documentado para bundlers).
QrScanner.WORKER_PATH = workerPath

const DEBOUNCE_MS = 8_000 // 8s: evita duplicados si el QR queda frente a la cámara, sin sentirse "muerto"
const PREF_KEY = 'gymcore_scanner_enabled'
// Arranque por defecto para el staff: el lector continuo es un proceso de fondo.
// Solo se apaga si el usuario lo desactiva explícitamente (se guarda la preferencia).
const DEFAULT_ENABLED = true

function tokenFromUrl(value: string): string | null {
  try {
    const u = new URL(value, window.location.origin)
    return u.searchParams.get('token')?.trim() ?? null
  } catch {
    return null
  }
}

/** Clasifica el contenido de un QR en socio (check-in) o pase (canje). */
function classifyQr(value: string): { kind: 'member' | 'pass'; key: string } | null {
  const v = value.trim()
  if (!v) return null
  if (v.startsWith('gymcore:pass:')) {
    return { kind: 'pass', key: v.slice('gymcore:pass:'.length).trim() }
  }
  if (v.startsWith('gymcore:member:')) {
    return { kind: 'member', key: v.slice('gymcore:member:'.length).trim() }
  }
  // URL del pase de invitado: /g?token=...
  if (v.startsWith('/g?') || v.includes('/g?')) {
    const t = tokenFromUrl(v)
    return t ? { kind: 'pass', key: t } : null
  }
  // URL del portal del socio: /m?token=...
  if (v.startsWith('/m?') || v.includes('/m?')) {
    const t = tokenFromUrl(v)
    return t ? { kind: 'member', key: t } : null
  }
  if (v.startsWith('token=')) {
    return { kind: 'member', key: v.slice('token='.length).trim() }
  }
  // valor crudo: asumir socio (id o share token)
  return { kind: 'member', key: v }
}

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

const STAFF_ROLES = ['admin', 'recepcion', 'coach']

export function ScannerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const debounceRef = useRef<Map<string, number>>(new Map())
  const processRef = useRef<(decoded: string) => void>(() => {})
  // ¿El lector fue encendido MANUALMENTE (toggle)? Si es así se mantiene al
  // navegar; si fue auto-arrancado, se apaga al salir de /checkin (evita
  // pedir permiso de cámara en páginas como la ficha del socio).
  const manualRef = useRef(false)
  const [enabled, setEnabled] = useState(false)
  const [activating, setActivating] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)

  // Excepción: en la ficha/credencial del socio NO se enciende la cámara
  // (evita pedir el permiso al revisar la credencial del socio).
  const isMemberDetail = /^\/socios\/[^/]+\/?$/.test(location.pathname)

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
      const cls = classifyQr(decoded)
      if (!cls) return

      const now = Date.now()
      const last = debounceRef.current.get(cls.key)
      // El QR suele permanecer frente a la cámara varios frames (decodes
      // ~25/s). El primer decode ya procesó y mostró su toast; los repetidos
      // se ignoran en SILENCIO: toastear cada uno llenaría la cola y expulsaría
      // el resultado (la cola solo muestra 4 a la vez).
      if (last && now - last < DEBOUNCE_MS) return
      debounceRef.current.set(cls.key, now)
      if (debounceRef.current.size > 500) debounceRef.current.clear()

      try {
        if (cls.kind === 'member') {
          // Se manda el contenido completo; el backend resuelve UUID o share
          // token sin romper (y nunca 500). El backend decide la acción:
          // checkin / already_in (sesión activa reciente) / checkout.
          const res = await apiFetch<{
            ok: boolean
            member_name: string
            plan_active: boolean
            action?: string
            message?: string
          }>('/checkin', { method: 'POST', body: JSON.stringify({ qr_token: decoded }) })
          setLastResult({ type: 'member', ok: res.ok, member: res.member_name, at: now })
          if (res.ok) {
            if (res.action === 'checkout') {
              toast({ title: 'Salida registrada', description: res.member_name, variant: 'success' })
              playCheckout()
            } else if (res.action === 'already_in' || res.message?.includes('sesión activa')) {
              toast({ title: res.member_name, description: 'Ya está dentro (sesión activa)', variant: 'info' })
              playBeep(660, 0.09)
            } else if (!res.plan_active) {
              toast({ title: res.member_name, description: res.message ?? 'Sin membresía activa', variant: 'warning' })
              playBeep(440, 0.16)
            } else {
              toast({ title: 'Check-in registrado', description: res.member_name, variant: 'success' })
              playCheckin()
            }
          } else {
            toast({ title: 'Check-in no válido', description: res.message ?? 'El código no corresponde a un socio activo.', variant: 'warning' })
            playBeep(300, 0.2)
          }
        } else {
          const res = await apiFetch<{ guest_name: string; inviter_name?: string | null }>('/passes/redeem', {
            method: 'POST',
            body: JSON.stringify({ token: cls.key }),
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
    if (!videoRef.current) throw new Error('No se pudo montar el video del lector')
    // NO abrimos un stream previo: QrScanner.start() abre su propia cámara.
    // (Si el video ya tiene un stream, start() solo lo reproduce y detenerlo
    // después apagaría la cámara — LED off, sin decodificación.)
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
    manualRef.current = true
    setActivating(true)
    try {
      // getUserMedia por sí solo dispara el prompt de permisos dentro del
      // gesto del clic; no hacemos un probe previo (evita abrir/cerrar la
      // cámara dos veces, que puede fallar en algunos navegadores).
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
    manualRef.current = false
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

  // Auto-inicio para el staff en TODAS las páginas (proceso de fondo), con una
  // única excepción: la ficha/credencial del socio (/socios/:id), donde la
  // cámara se apaga para no pedir el permiso al revisar la credencial.
  // Si el usuario lo encendió manualmente (toggle), se mantiene al navegar.
  useEffect(() => {
    if (!user || !STAFF_ROLES.includes(user.role)) return
    if (isMemberDetail) {
      // Excepción: forzar apagado en la ficha del socio.
      manualRef.current = false
      stopScanner()
      setEnabled(false)
      return
    }
    if (manualRef.current) return
    let stored: string | null = null
    try {
      stored = localStorage.getItem(storageKey)
    } catch {
      // sin almacenamiento: se mantiene el default
    }
    if (stored === '0' || (!DEFAULT_ENABLED && stored !== '1')) return
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
      if (!manualRef.current) {
        stopScanner()
        setEnabled(false)
      }
    }
  }, [isMemberDetail, storageKey, user, start, stopScanner])

  return (
    <ScannerContext.Provider
      value={{ enabled, activating, lastResult, enable, disable }}
    >
      {/* El video vive invisible pero DENTRO del viewport y con resolución real
      (640x480) para que el navegador lo pinte y qr-scanner decodifique frames
      nítidos y rápido. Fuera del viewport (-9999px) algunos navegadores no lo
      pintan y el lector queda ciego. */}
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 h-[480px] w-[640px] opacity-0"
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