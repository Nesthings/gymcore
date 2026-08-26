import {
  History,
  LayoutDashboard,
  ScanLine,
  Settings2,
  Target,
  TrendingDown,
  Users,
  Wallet,
  BadgeCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavRoute {
  to: string
  label: string
  component: string
  end?: boolean
}

export interface ModuleMeta {
  icon: LucideIcon
  desc: string
  text: string
  iconBg: string
  pageBg?: string
}

// Catálogo completo de módulos del panel del gimnasio.
// Se usa en el sidebar (AppLayout) y en las tarjetas de "Módulos" del Inicio.
export const NAV_ROUTES: NavRoute[] = [
  { to: '/', label: 'Dashboard', component: 'dashboard', end: true },
  { to: '/socios', label: 'Socios', component: 'socios' },
  { to: '/membresias', label: 'Membresías', component: 'membresias' },
  { to: '/pagos', label: 'Pagos', component: 'finanzas' },
  { to: '/checkin', label: 'Check-in', component: 'checkin' },
  { to: '/crm', label: 'CRM', component: 'crm' },
  { to: '/riesgo', label: 'Riesgo', component: 'inteligencia' },
  { to: '/configuracion', label: 'Configuración', component: 'configuracion' },
  { to: '/auditoria', label: 'Auditoría', component: 'auditoria' },
]

// Meta de cada módulo. La paleta se mantiene en la familia volt/lime con
// apoyo de ámbar y neutros cálidos — nada de acentos arcoíris por módulo.
export const MODULE_META: Record<string, ModuleMeta> = {
  dashboard: {
    icon: LayoutDashboard,
    desc: 'Resumen operativo del gimnasio',
    text: 'text-primary',
    iconBg: 'bg-primary/15',
  },
  socios: {
    icon: Users,
    desc: 'Expedientes y perfiles de socios',
    text: 'text-primary',
    iconBg: 'bg-primary/15',
    pageBg: 'from-lime-100/70 dark:from-lime-400/[0.08]',
  },
  membresias: {
    icon: BadgeCheck,
    desc: 'Planes y membresías activas',
    text: 'text-amber-700 dark:text-amber-300',
    iconBg: 'bg-amber-500/15',
    pageBg: 'from-amber-100/70 dark:from-amber-400/[0.08]',
  },
  finanzas: {
    icon: Wallet,
    desc: 'Pagos, ingresos y morosidad',
    text: 'text-amber-700 dark:text-amber-300',
    iconBg: 'bg-amber-500/15',
    pageBg: 'from-amber-100/70 dark:from-amber-400/[0.08]',
  },
  checkin: {
    icon: ScanLine,
    desc: 'Registro de acceso por QR',
    text: 'text-primary',
    iconBg: 'bg-primary/15',
    pageBg: 'from-lime-100/70 dark:from-lime-400/[0.08]',
  },
  crm: {
    icon: Target,
    desc: 'Leads y embudo de captación',
    text: 'text-stone-700 dark:text-stone-300',
    iconBg: 'bg-stone-500/15',
    pageBg: 'from-stone-100/70 dark:from-stone-400/[0.08]',
  },
  inteligencia: {
    icon: TrendingDown,
    desc: 'Riesgo de abandono y analítica',
    text: 'text-rose-700 dark:text-rose-300',
    iconBg: 'bg-rose-500/15',
    pageBg: 'from-rose-100/70 dark:from-rose-400/[0.08]',
  },
  configuracion: {
    icon: Settings2,
    desc: 'Gimnasio, sucursales y equipo',
    text: 'text-stone-700 dark:text-stone-300',
    iconBg: 'bg-stone-500/15',
    pageBg: 'from-stone-100/70 dark:from-stone-400/[0.08]',
  },
  auditoria: {
    icon: History,
    desc: 'Bitácora de cambios',
    text: 'text-stone-700 dark:text-stone-300',
    iconBg: 'bg-stone-500/15',
    pageBg: 'from-stone-100/70 dark:from-stone-400/[0.08]',
  },
}

export function routeForPath(pathname: string): NavRoute | undefined {
  return NAV_ROUTES.find((r) =>
    r.end ? pathname === r.to : pathname === r.to || pathname.startsWith(`${r.to}/`),
  )
}

// Color de fondo de página según el módulo activo (mismo color que su tarjeta).
export function pageBgForPath(pathname: string): string | undefined {
  if (pathname.startsWith('/socios/')) return MODULE_META.socios.pageBg
  const route = routeForPath(pathname)
  return route ? MODULE_META[route.component]?.pageBg : undefined
}

export function firstAllowedRoute(hasComponent: (c: string) => boolean): string {
  const route = NAV_ROUTES.find((r) => hasComponent(r.component))
  return route?.to ?? '/'
}