import { createContext, useContext, useEffect, useState } from 'react'

import { useAuth } from '@/lib/auth'

// Módulos fijados en la barra lateral por defecto (el resto aparecen como
// tarjetas en el Inicio y se pueden arrastrar para fijarlos). Solo se fijan
// módulos que existen en NAV_ROUTES (auditoria/configuracion sí son del sidebar).
const DEFAULT_PINNED = [
  'socios',
  'membresias',
  'finanzas',
  'checkin',
  'crm',
  'productos',
  'inteligencia',
  'configuracion',
  'auditoria',
]

interface NavConfigValue {
  pinned: string[]
  pin: (component: string) => void
  unpin: (component: string) => void
}

const NavConfigContext = createContext<NavConfigValue | null>(null)

function storageKey(userId: string | undefined) {
  return `gymcore_pinned_${userId ?? 'guest'}`
}

function loadPinned(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((c) => typeof c === 'string')
    }
  } catch {
    // sin almacenamiento
  }
  return DEFAULT_PINNED
}

export function NavConfigProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const key = storageKey(user?.sub)

  const [pinned, setPinned] = useState<string[]>(() => loadPinned(key))

  useEffect(() => {
    setPinned(loadPinned(key))
  }, [key])

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(pinned))
    } catch {
      // sin almacenamiento
    }
  }, [key, pinned])

  const value: NavConfigValue = {
    pinned,
    pin: (component) =>
      setPinned((list) => (list.includes(component) ? list : [...list, component])),
    unpin: (component) => setPinned((list) => list.filter((x) => x !== component)),
  }

  return <NavConfigContext.Provider value={value}>{children}</NavConfigContext.Provider>
}

export function useNavConfig(): NavConfigValue {
  const ctx = useContext(NavConfigContext)
  if (!ctx) {
    throw new Error('useNavConfig debe usarse dentro de <NavConfigProvider>')
  }
  return ctx
}