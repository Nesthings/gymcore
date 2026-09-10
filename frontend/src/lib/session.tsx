import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/lib/auth'

const INACTIVITY_MS = 60 * 60 * 1000 // 1 hora sin actividad

/**
 * Cierra la sesión tras una hora de inactividad (pointer, teclado, scroll,
 * touch). Se monta dentro del router; no renderiza nada.
 */
export function InactivityGuard() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const timer = useRef<number | undefined>(undefined)

  const reset = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      logout()
      navigate('/login', { replace: true })
    }, INACTIVITY_MS)
  }, [logout, navigate])

  useEffect(() => {
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']
    for (const e of events) {
      window.addEventListener(e, reset, { passive: true } as AddEventListenerOptions)
    }
    reset()
    return () => {
      window.clearTimeout(timer.current)
      for (const e of events) {
        window.removeEventListener(e, reset)
      }
    }
  }, [reset])

  return null
}