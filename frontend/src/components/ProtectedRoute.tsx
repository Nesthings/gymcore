import { Navigate, useLocation } from 'react-router-dom'
import { Loader2, ShieldX } from 'lucide-react'

import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions'
import { useSetup } from '@/lib/setup'
import { firstAllowedRoute } from '@/lib/nav'

const ROLE_HOME: Record<string, string> = {
  'super-admin': '/platform',
  admin: '/',
  recepcion: '/',
  coach: '/',
}

const STAFF_ROLES = ['admin', 'recepcion', 'coach']

function AccessDenied() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldX className="size-6" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold">Acceso restringido</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tu rol no tiene permisos para ver esta sección. Contacta al admin del gimnasio.
      </p>
    </div>
  )
}

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
    </div>
  )
}

export function ProtectedRoute({
  children,
  roles,
  component,
}: {
  children: React.ReactNode
  roles?: string[]
  component?: string
}) {
  const { isAuthenticated, user } = useAuth()
  const { hasComponent, loading: permsLoading } = usePermissions()
  const { me, loading: setupLoading } = useSetup()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return <AccessDenied />
  }

  // Wizard de configuración: SOLO la primera vez que el admin entra a un
  // gimnasio nuevo (setup_completed=false). Se evalúa ANTES del check de
  // componente para que el admin nuevo no se tope con "sin permisos".
  if (
    user?.role === 'admin' &&
    !setupLoading &&
    me?.setup_completed === false &&
    location.pathname !== '/setup'
  ) {
    return <Navigate to="/setup" replace />
  }

  // El check de componente solo aplica al staff del gimnasio. Mientras los
  // permisos cargan, mostramos un estado de carga en vez de denegar.
  const isStaff = user && STAFF_ROLES.includes(user.role)
  if (isStaff && component) {
    if (permsLoading) {
      return <RouteLoading />
    }
    if (!hasComponent(component)) {
      // Si no tiene acceso a esta pantalla, lo llevamos a la primera ruta a
      // la que sí tiene acceso, en vez de mostrar "Acceso restringido".
      return <Navigate to={firstAllowedRoute(hasComponent)} replace />
    }
  }

  // Si ya está autenticado y visita una página sin rol específico, lo manda a su home
  if (location.pathname === '/' && user && user.role in ROLE_HOME) {
    const home = ROLE_HOME[user.role]
    if (home !== '/') {
      return <Navigate to={home} replace />
    }
  }

  return children
}