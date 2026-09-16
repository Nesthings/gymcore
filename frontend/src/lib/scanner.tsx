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
// v2: la versión anterior guardaba '0' ante fallos transitorios y dejaba el
// lector desactivado de forma permanente; la nueva clave descarta ese estado.
const PREF_KEY = 'gymcore_scanner_enabled_v2'
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
  scanRate: number
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
  // Generación del arranque: invalida un `start()` en vuelo cuando se detiene,
  // evitando dejar la cámara encendida (leak) en el doble montaje de StrictMode.
  const genRef = useRef(0)
  const warnedRef = useRef(false)
  // Buffer del lector USB tipo teclado (keyboard-wedge): acumula la ráfaga y
  // la procesa al Enter.
  const wedgeRef = useRef<{ buffer: string; last: number; fast: boolean }>({
    buffer: '',
    last: 0,
    fast: true,
  })
  const debounceRef = useRef<Map<string, number>>(new Map())
  const processRef = useRef<(decoded: string) => void>(() => {})
  // ¿El lector fue encendido MANUALMENTE (toggle)? Si es así se mantiene al
  // navegar; si fue auto-arrancado, se apaga al salir de /checkin (evita
  // pedir permiso de cámara en páginas como la ficha del socio).
  const manualRef = useRef(false)
  const [enabled, setEnabled] = useState(false)
  const [activating, setActivating] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  // Diagnóstico: intentos de escaneo por segundo (para saber si el bucle corre).
  const scanCountRef = useRef(0)
  const [scanRate, setScanRate] = useState(0)

  // Excepción: la ficha/credencial del socio NO apaga la cámara. El lector es
  // un proceso de fondo que permanece activo en TODAS las páginas del staff.

  // Rutas públicas (login, portal /m, invitado /g, etc.): en ellas la cámara
  // NUNCA debe encenderse ni pedir permisos, aunque haya una sesión de staff
  // abierta en el mismo navegador (al compartir un link con un cliente).
  const isPublicRoute =
    location.pathname === '/' ||
    ['/login', '/create-gym', '/forgot-password', '/reset-password', '/m', '/g', '/design-system'].some(
      (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
    )

  const storageKey = `${PREF_KEY}:${user?.sub ?? 'guest'}`

  const stopVideoStream = useCallback(() => {
    const v = videoRef.current
    if (v && v.srcObject instanceof MediaStream) {
      v.srcObject.getTracks().forEach((t) => t.stop())
      v.srcObject = null
    }
  }, [])

  const safeDestroy = useCallback((s: QrScanner | null) => {
    // Destruye sin lanzar (un scanner ya destruido o a medio arrancar no debe
    // romper el flujo).
    if (!s) return
    try {
      s.stop()
    } catch {
      // ignorar
    }
    try {
      s.destroy()
    } catch {
      // ignorar
    }
  }, [])

  const stopScanner = useCallback(() => {
    // Invalida cualquier start() en vuelo y apaga el video para no filtrar el
    // stream de cámara (StrictMode monta dos veces los efectos).
    genRef.current += 1
    const s = scannerRef.current
    scannerRef.current = null
    safeDestroy(s)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    stopVideoStream()
  }, [safeDestroy, stopVideoStream])

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

  // Calcula la tasa de escaneo (intentos/segundo) cada segundo.
  useEffect(() => {
    const t = window.setInterval(() => {
      setScanRate(scanCountRef.current)
      scanCountRef.current = 0
    }, 1000)
    return () => window.clearInterval(t)
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Cámara no disponible en este dispositivo')
    if (!videoRef.current) throw new Error('No se pudo montar el video del lector')
    const myGen = ++genRef.current
    // Limpia cualquier instancia previa antes de abrir una cámara nueva.
    const prev = scannerRef.current
    scannerRef.current = null
    safeDestroy(prev)
    stopVideoStream()
    // QrScanner abre y gestiona su propia cámara (no pre-asignamos srcObject:
    // hacerlo degradaba el arranque del bucle de escaneo). Configuración
    // optimizada para rapidez:
    //  - región = marco completo (cobertura)
    //  - canvas de decodificación acotado a ~512 px (decodifica muy rápido)
    //  - 30 escaneos/segundo
    const scanner = new QrScanner(
      videoRef.current,
      (result: QrScanner.ScanResult) => {
        scanCountRef.current += 1
        processRef.current(result.data)
      },
      {
        maxScansPerSecond: 30,
        onDecodeError: () => {
          // Cuenta cada intento de escaneo (incluye "sin QR"), para diagnóstico.
          scanCountRef.current += 1
        },
        calculateScanRegion: (v) => {
          const w = v.videoWidth || 640
          const h = v.videoHeight || 480
          const target = Math.min(Math.max(w, 400), 512)
          return {
            x: 0,
            y: 0,
            width: w,
            height: h,
            downScaledWidth: target,
            downScaledHeight: Math.max(1, Math.round((target * h) / w)),
          }
        },
      },
    )
    scannerRef.current = scanner
    try {
      await scanner.start()
    } catch (err) {
      if (scannerRef.current === scanner) scannerRef.current = null
      safeDestroy(scanner)
      stopVideoStream()
      throw err
    }
    // Si mientras arrancaba se detuvo (StrictMode/navegación), apaga la cámara.
    if (myGen !== genRef.current || scannerRef.current !== scanner) {
      safeDestroy(scanner)
      stopVideoStream()
    }
  }, [safeDestroy, stopVideoStream])

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

  // Guarda de sesión: fuera del staff o sin sesión se apaga el lector.
  useEffect(() => {
    if (!user || !STAFF_ROLES.includes(user.role)) {
      manualRef.current = false
      stopScanner()
      setEnabled(false)
    }
  }, [user, stopScanner])

  // Rutas públicas: se apaga la cámara a la fuerza y se reinicia el estado
  // manual para que al volver a una página del staff se reanude (el toggle
  // persistió '1'). En estas rutas tampoco se pide permiso de cámara.
  useEffect(() => {
    if (isPublicRoute) {
      manualRef.current = false
      stopScanner()
      setEnabled(false)
    }
  }, [isPublicRoute, stopScanner])

  // Auto-inicio (proceso de fondo) para el staff en las páginas del panel.
  // NO depende de la ruta entre páginas del staff: una vez arrancado, navegar
  // no lo detiene; solo el toggle, cerrar sesión o estar en una ruta pública
  // (portal/invitado/login) lo apagan.
  useEffect(() => {
    if (!user || !STAFF_ROLES.includes(user.role)) return
    if (isPublicRoute) return
    if (manualRef.current || enabled) return
    let stored: string | null = null
    try {
      stored = localStorage.getItem(storageKey)
    } catch {
      // sin almacenamiento: se mantiene el default
    }
    if (stored === '0' || (!DEFAULT_ENABLED && stored !== '1')) return
    let cancelled = false
    // Arranque diferido: evita abrir la cámara dos veces por el doble montaje
    // de efectos de React StrictMode en desarrollo.
    const timer = window.setTimeout(async () => {
      if (cancelled) return
      try {
        await start()
        if (!cancelled) setEnabled(true)
        return
      } catch {
        // primer intento fallido (p. ej. cámara ocupada): reintenta una vez.
      }
      await new Promise((r) => window.setTimeout(r, 800))
      if (cancelled) return
      try {
        await start()
        if (!cancelled) setEnabled(true)
      } catch (err) {
        if (cancelled) return
        setEnabled(false)
        // NO se persiste '0': un fallo transitorio no debe desactivar el
        // lector de forma permanente. Se avisa una sola vez por sesión.
        if (!warnedRef.current) {
          warnedRef.current = true
          toast({
            title: 'No se pudo activar el lector QR',
            description:
              err instanceof Error
                ? err.message
                : 'Revisa el permiso de cámara o usa el botón QR de la barra.',
            variant: 'error',
          })
        }
      }
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [user, storageKey, enabled, isPublicRoute, start, toast])

  // Al desmontar (cierre de sesión / cierre de la app) se libera la cámara.
  useEffect(() => {
    return () => stopScanner()
  }, [stopScanner])

  // Lector USB dedicado tipo teclado (keyboard-wedge): el dispositivo "escribe"
  // el código a velocidad máquina y envía Enter. Se bufferiza la ráfaga y se
  // procesa por el mismo flujo que la cámara (check-in / canje). Coexiste con
  // la cámara y no interfiere con el tipeo humano.
  useEffect(() => {
    if (!user || !STAFF_ROLES.includes(user.role)) return
    const FAST_MS = 120 // gap máximo entre teclas de una ráfaga de lector
    const RESET_MS = 400 // si tarda más, se considera tecleo humano/otra cosa

    const strongToken = (v: string) =>
      v.startsWith('gymcore:member:') ||
      v.startsWith('gymcore:pass:') ||
      v.includes('token=') ||
      v.includes('/m?') ||
      v.includes('/g?') ||
      /^[0-9a-fA-F-]{32,36}$/.test(v)

    const onKey = (e: KeyboardEvent) => {
      // Ignora atajos (Ctrl/Meta/Alt) y teclas de control.
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const state = wedgeRef.current
      const now = performance.now()

      if (e.key === 'Enter') {
        const buf = state.buffer
        const fast = state.fast
        state.buffer = ''
        state.last = 0
        state.fast = true
        // Acepta ráfagas rápidas largas o tokens inequívocos (URL/prefix/UUID).
        if (buf && ((fast && buf.length >= 12) || strongToken(buf))) {
          e.preventDefault()
          processRef.current(buf)
        }
        return
      }
      if (e.key === 'Escape') {
        state.buffer = ''
        state.last = 0
        state.fast = true
        return
      }
      // Solo caracteres imprimibles.
      if (e.key.length !== 1) return

      const gap = now - state.last
      if (state.buffer === '' || gap > RESET_MS) {
        state.buffer = e.key
        state.fast = true
      } else {
        if (gap > FAST_MS) state.fast = false
        state.buffer += e.key
      }
      state.last = now
      // Durante una ráfaga (probable lector), evita que el texto caiga en un
      // input (p. ej. el buscador). El tipeo humano no se ve afectado.
      if (state.fast && state.buffer.length >= 2) e.preventDefault()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [user])

  return (
    <ScannerContext.Provider
      value={{ enabled, activating, lastResult, scanRate, enable, disable }}
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