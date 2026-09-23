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
  'ventas',
  'inteligencia',
  'layout',
  'configuracion',
  'auditoria',
]

interface NavConfigValue {
  pinned: string[]
  pin: (component: string) => void
  unpin: (component: string) => void
}

interface StoredNavConfig {
  pinned: string[]
  /** Módulos que el usuario quitó explícitamente de la barra. */
  removed: string[]
}

const NavConfigContext = createContext<NavConfigValue | null>(null)

function storageKey(userId: string | undefined) {
  return `gymcore_pinned_${userId ?? 'guest'}`
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((c) => typeof c === 'string')
}

function loadConfig(key: string): StoredNavConfig {
  let saved: StoredNavConfig | null = null
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (isStringArray(parsed)) {
        // Formato antiguo (solo la lista de fijados).
        saved = { pinned: parsed, removed: [] }
      } else if (parsed && isStringArray(parsed.pinned)) {
        saved = {
          pinned: parsed.pinned,
          removed: isStringArray(parsed.removed) ? parsed.removed : [],
        }
      }
    }
  } catch {
    // sin almacenamiento
  }

  if (!saved) return { pinned: [...DEFAULT_PINNED], removed: [] }

  // Respeta la personalización del usuario y solo agrega módulos nuevos del
  // producto que el usuario no haya quitado explícitamente. Así, quitar u
  // ordenar módulos SÍ persiste entre sesiones.
  const pinned = [...saved.pinned]
  for (const c of DEFAULT_PINNED) {
    if (!pinned.includes(c) && !saved.removed.includes(c)) pinned.push(c)
  }
  return { pinned, removed: saved.removed }
}

export function NavConfigProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const key = storageKey(user?.sub)

  // Guardamos la config junto con la clave a la que pertenece: así nunca
  // escribimos la personalización de un usuario sobre la de otro al cambiar
  // de sesión.
  const [state, setState] = useState<{ key: string; config: StoredNavConfig }>(() => ({
    key,
    config: loadConfig(key),
  }))

  useEffect(() => {
    setState({ key, config: loadConfig(key) })
  }, [key])

  useEffect(() => {
    if (state.key !== key) return
    try {
      localStorage.setItem(key, JSON.stringify(state.config))
    } catch {
      // sin almacenamiento
    }
  }, [key, state])

  const value: NavConfigValue = {
    pinned: state.config.pinned,
    pin: (component) =>
      setState((s) =>
        s.config.pinned.includes(component)
          ? s
          : {
              ...s,
              config: {
                pinned: [...s.config.pinned, component],
                removed: s.config.removed.filter((x) => x !== component),
              },
            },
      ),
    unpin: (component) =>
      setState((s) => ({
        ...s,
        config: {
          pinned: s.config.pinned.filter((x) => x !== component),
          removed: s.config.removed.includes(component)
            ? s.config.removed
            : [...s.config.removed, component],
        },
      })),
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
