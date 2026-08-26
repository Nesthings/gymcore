import {
  Dumbbell,
  History,
  Home,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  UserRound,
} from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { usePermissions } from '@/lib/permissions'
import { useNavConfig } from '@/lib/nav-config'
import { MODULE_META, NAV_ROUTES } from '@/lib/nav'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const SIDEBAR_KEY = 'gymcore_sidebar_collapsed'

const ROLE_LABEL: Record<string, string> = {
  'super-admin': 'Administrador de plataforma',
  admin: 'Administrador',
  recepcion: 'Recepción',
  coach: 'Entrenador',
}

interface Branch {
  id: string
  name: string
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { hasComponent } = usePermissions()
  const { pinned, pin } = useNavConfig()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [gymName, setGymName] = useState<string>('')
  const [gymLogoUrl, setGymLogoUrl] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState<string>('')
  const [navDragOver, setNavDragOver] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })
  const profileRef = useRef<HTMLDivElement>(null)

  const branchStorageKey = `gymcore_branch_${user?.sub ?? 'guest'}`

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      // sin almacenamiento
    }
  }, [collapsed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setCollapsed((c) => !c)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!user?.gym_id) {
      setProfileLoading(false)
      return
    }
    let cancelled = false
    setProfileLoading(true)
    Promise.all([
      apiFetch<{ photo_url?: string | null; full_name?: string | null }>('/auth/me'),
      apiFetch<{ name?: string; logo_url?: string | null }>('/gyms/me'),
      apiFetch<Branch[]>('/branches'),
    ])
      .then(([me, gym, br]) => {
        if (cancelled) return
        if (me.photo_url) setAvatarUrl(me.photo_url)
        if (me.full_name) setFullName(me.full_name)
        if (gym.name) setGymName(gym.name)
        if (gym.logo_url) setGymLogoUrl(gym.logo_url)
        setBranches(br)
        setBranchId((prev) => {
          if (prev && br.some((b) => b.id === prev)) return prev
          try {
            const stored = localStorage.getItem(branchStorageKey)
            if (stored && br.some((b) => b.id === stored)) return stored
          } catch {
            // sin almacenamiento
          }
          return br[0]?.id ?? ''
        })
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.gym_id, user?.sub, branchStorageKey])

  useEffect(() => {
    try {
      if (branchId) localStorage.setItem(branchStorageKey, branchId)
    } catch {
      // sin almacenamiento
    }
  }, [branchId, branchStorageKey])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const NAV_ITEMS = NAV_ROUTES.filter(
    (i) =>
      i.component === 'dashboard' || (pinned.includes(i.component) && hasComponent(i.component)),
  ).map((i) => ({
    ...i,
    icon: MODULE_META[i.component].icon,
  }))

  const principalItems = NAV_ITEMS.filter((i) => i.component === 'dashboard')
  const moduleItems = NAV_ITEMS.filter((i) => i.component !== 'dashboard')

  const handleNavDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setNavDragOver(false)
    const component = e.dataTransfer.getData('text/plain')
    if (component && component !== 'dashboard') pin(component)
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const displayName = fullName ?? user?.role ?? ''

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group flex cursor-grab items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 active:cursor-grabbing',
      collapsed && 'justify-center px-2',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground',
    )

  const renderNavItem = (item: (typeof NAV_ITEMS)[number]) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      draggable={item.component !== 'dashboard'}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.component)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => {
        if (window.innerWidth < 768) setCollapsed(true)
      }}
      title={
        item.component !== 'dashboard'
          ? collapsed
            ? item.label
            : 'Arrastra al Inicio para quitar de la barra'
          : item.label
      }
      className={navLinkClass}
    >
      <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {collapsed === false && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen flex-col overflow-hidden border-r border-border bg-card transition-[width,transform] duration-100 ease-out md:sticky md:top-0 md:translate-x-0',
          collapsed ? 'w-16 -translate-x-full md:w-16 md:translate-x-0' : 'w-64 translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2.5 border-b border-border px-4 py-4',
            collapsed && 'justify-center px-2',
          )}
        >
          <div className="bg-brand-gradient flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-primary-foreground shadow-card">
            {gymLogoUrl ? (
              <img src={gymLogoUrl} alt={gymName} className="size-full object-cover" />
            ) : (
              <Dumbbell className="size-5" aria-hidden="true" />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="break-words font-display text-sm font-semibold text-foreground">
                {gymName || 'GymCore'}
              </p>
              <p className="text-xs text-muted-foreground">Panel de gimnasio</p>
            </div>
          )}
        </div>

        <nav
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setNavDragOver(true)
          }}
          onDragLeave={() => setNavDragOver(false)}
          onDrop={handleNavDrop}
          className={cn(
            'flex-1 space-y-4 overflow-y-auto p-3 transition-colors',
            navDragOver && 'rounded-lg bg-primary/10 outline-2 outline-dashed outline-primary/40',
          )}
        >
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                Principal
              </p>
            )}
            {principalItems.map(renderNavItem)}
          </div>
          {moduleItems.length > 0 && (
            <div className="space-y-1">
              {!collapsed && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                  Módulos
                </p>
              )}
              {moduleItems.map(renderNavItem)}
            </div>
          )}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expandir menú (Ctrl+Shift+B)' : 'Colapsar menú (Ctrl+Shift+B)'}
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-accent hover:text-foreground active:scale-[0.98]"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden="true" />
              )}
            </button>
            {pathname !== '/' && (
              <NavLink
                to="/"
                className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-accent hover:text-foreground active:scale-[0.98]"
                title="Volver al inicio"
                aria-label="Volver al inicio"
              >
                <Home className="size-4" aria-hidden="true" />
              </NavLink>
            )}
            {profileLoading ? (
              <span className="ml-1 hidden h-4 w-32 animate-pulse rounded bg-secondary sm:block" />
            ) : (
              <p className="ml-1 hidden text-sm text-muted-foreground sm:block">
                Hola, <span className="font-semibold text-foreground">{displayName}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user?.gym_id && branches.length > 0 && (
              <div className="hidden items-center gap-1.5 sm:flex">
                <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="h-9 w-auto min-w-36 justify-between gap-2 rounded-lg border border-border bg-card text-sm shadow-card">
                    <SelectValue placeholder="Sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <ThemeToggle />
            <NotificationBell />
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="flex size-9 items-center justify-center overflow-hidden rounded-full border-2 border-primary/30 bg-secondary text-xs font-semibold text-secondary-foreground transition-colors hover:bg-accent active:scale-[0.98]"
                aria-label="Menú de perfil"
              >
                {profileLoading ? (
                  <span className="block size-full animate-pulse bg-secondary" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="size-full object-cover" />
                ) : (
                  <span>{displayName?.[0]?.toUpperCase() ?? user?.role?.[0]?.toUpperCase()}</span>
                )}
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-dialog">
                  <div className="border-b border-border bg-muted/40 px-3 py-3">
                    <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.role ? ROLE_LABEL[user.role] ?? user.role : ''}
                    </p>
                  </div>
                  <div className="p-1.5">
                    <NavLink
                      to="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <UserRound className="size-4" aria-hidden="true" />
                      Ver perfil
                    </NavLink>
                    {hasComponent('configuracion') && (
                      <NavLink
                        to="/configuracion"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Settings2 className="size-4" aria-hidden="true" />
                        Configuración del gimnasio
                      </NavLink>
                    )}
                    {hasComponent('auditoria') && (
                      <NavLink
                        to="/auditoria"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <History className="size-4" aria-hidden="true" />
                        Auditoría
                      </NavLink>
                    )}
                  </div>
                  <div className="border-t border-border p-1.5">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}