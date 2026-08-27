import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'

// Catálogo de componentes (pantallas) del panel de gimnasio.
// Se usa para controlar acceso por usuario vía /users/{id}/components.
export const COMPONENT_CATALOG: { slug: string; label: string; description?: string }[] = [
  { slug: 'dashboard', label: 'Dashboard', description: 'Resumen operativo del gimnasio' },
  { slug: 'socios', label: 'Socios', description: 'Expedientes y perfiles de socios' },
  { slug: 'membresias', label: 'Membresías', description: 'Planes y membresías' },
  { slug: 'finanzas', label: 'Finanzas', description: 'Pagos, ingresos y morosidad' },
  { slug: 'crm', label: 'CRM', description: 'Leads y embudo de captación' },
  { slug: 'checkin', label: 'Check-in', description: 'Registro de acceso por QR' },
  { slug: 'productos', label: 'Productos', description: 'Catálogo de productos de venta' },
  { slug: 'ventas', label: 'Ventas', description: 'Ventas e ingresos de mostrador' },
  { slug: 'inteligencia', label: 'Inteligencia', description: 'Riesgo de abandono y analítica' },
  { slug: 'configuracion', label: 'Configuración', description: 'Gimnasio, sucursales y equipo' },
  { slug: 'auditoria', label: 'Auditoría', description: 'Bitácora de cambios' },
]

interface PermissionsContextValue {
  components: string[]
  loading: boolean
  hasComponent: (component: string) => boolean
  refresh: () => void
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [components, setComponents] = useState<string[]>([])
  // Empieza en "loading" cuando hay sesión: evita que una URL directa redirija
  // a inicio antes de que se carguen los componentes (carrera en ProtectedRoute).
  const [loading, setLoading] = useState<boolean>(() => Boolean(user?.gym_id))

  const load = useCallback(async () => {
    if (!user?.gym_id) {
      setComponents([])
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch<{ components: string[] }>('/users/me/components')
      setComponents(res.components)
    } catch {
      setComponents([])
    } finally {
      setLoading(false)
    }
  }, [user?.gym_id])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo<PermissionsContextValue>(
    () => ({
      components,
      loading,
      hasComponent: (component: string) => components.includes(component),
      refresh: load,
    }),
    [components, loading, load],
  )

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext)
  if (!ctx) {
    throw new Error('usePermissions debe usarse dentro de <PermissionsProvider>')
  }
  return ctx
}