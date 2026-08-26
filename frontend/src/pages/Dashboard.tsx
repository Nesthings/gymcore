import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  GripVertical,
  PanelTop,
  ScanLine,
  Sparkles,
  TrendingDown,
  Users,
  Wallet,
  X,
} from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardChart } from '@/components/dashboards/DashboardChart'
import { DashboardTray } from '@/components/dashboards/DashboardTray'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { Separator } from '@/components/ui/separator'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions'
import { useNavConfig } from '@/lib/nav-config'
import { useDashboardConfig } from '@/lib/dashboard-config'
import { DASHBOARD_CATALOG, getDashboard } from '@/lib/dashboards'
import { MODULE_META, NAV_ROUTES } from '@/lib/nav'
import { cn, formatCurrency } from '@/lib/utils'

const SECTION_IDS = ['resumen', 'modulos', 'dashboards'] as const
type SectionId = (typeof SECTION_IDS)[number]

const DEFAULT_SECTION_ORDER: SectionId[] = ['resumen', 'modulos', 'dashboards']

const SECTION_LABELS: Record<SectionId, string> = {
  resumen: 'Resumen del período',
  modulos: 'Módulos',
  dashboards: 'Dashboards',
}

const SECTIONS_KEY_PREFIX = 'gymcore_dashboard_sections_'

// Orden de las tarjetas del Módulo "Módulos" en el Inicio (el resto va después).
const MODULE_CARD_ORDER = ['socios', 'membresias', 'checkin', 'finanzas', 'crm', 'productos']

type Period = 'day' | 'week' | 'month'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Diario' },
  { value: 'week', label: 'Semanal' },
  { value: 'month', label: 'Mensual' },
]

interface GymSummary {
  socios_activos: number
  checkins_hoy: number
  nuevas_membresias: number
  ingresos_mes: number
  morosidad: number
  socios_en_riesgo: number
}

const EMPTY_SUMMARY: GymSummary = {
  socios_activos: 0,
  checkins_hoy: 0,
  nuevas_membresias: 0,
  ingresos_mes: 0,
  morosidad: 0,
  socios_en_riesgo: 0,
}

function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
      </div>
      <p className="stat-number mt-1.5 text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SectionFrame({
  label,
  isFirst,
  isLast,
  onMove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  highlighted,
  children,
}: {
  label: string
  isFirst: boolean
  isLast: boolean
  onMove: (dir: -1 | 1) => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  highlighted: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'group rounded-xl transition-shadow',
        highlighted && 'outline-2 outline-dashed outline-primary/50 outline-offset-4',
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="mb-1.5 flex h-6 items-center justify-between">
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title={`Mover sección: ${label} (arrastra o usa las flechas)`}
          className="inline-flex cursor-grab items-center gap-1 rounded px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground opacity-60 transition hover:bg-accent hover:text-foreground hover:opacity-100 active:cursor-grabbing max-md:opacity-100"
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
          {label}
        </span>
        <span className="flex items-center gap-0.5 opacity-60 transition group-hover:opacity-100 max-md:opacity-100">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label={`Subir ${label}`}
            className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronUp className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label={`Bajar ${label}`}
            className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      </div>
      {children}
    </section>
  )
}

export function Dashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<GymSummary | null>(null)
  const { hasComponent } = usePermissions()
  const { pinned, unpin } = useNavConfig()
  const { active, add, remove } = useDashboardConfig()
  const [modulesDragOver, setModulesDragOver] = useState(false)
  const [trayOpen, setTrayOpen] = useState(false)
  const [gridDragOver, setGridDragOver] = useState(false)
  const [trayBtnDragOver, setTrayBtnDragOver] = useState(false)
  const [dashData, setDashData] = useState<Record<string, unknown>>({})
  const [dashError, setDashError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('week')

  const periodHint =
    period === 'day' ? 'hoy' : period === 'week' ? 'últimos 7 días' : 'últimos 30 días'

  const userKey = user?.sub ?? 'anon'
  const branchId = (() => {
    try {
      return localStorage.getItem(`gymcore_branch_${userKey}`) ?? ''
    } catch {
      return ''
    }
  })()

  const [order, setOrder] = useState<SectionId[]>(() => {
    try {
      const raw = localStorage.getItem(SECTIONS_KEY_PREFIX + userKey)
      if (raw) {
        const parsed = JSON.parse(raw) as SectionId[]
        if (
          Array.isArray(parsed) &&
          parsed.length === SECTION_IDS.length &&
          SECTION_IDS.every((s) => parsed.includes(s))
        ) {
          return parsed
        }
      }
    } catch {
      // sin almacenamiento
    }
    return DEFAULT_SECTION_ORDER
  })
  const [dragSection, setDragSection] = useState<SectionId | null>(null)
  const [dragOverSection, setDragOverSection] = useState<SectionId | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(SECTIONS_KEY_PREFIX + userKey, JSON.stringify(order))
    } catch {
      // sin almacenamiento
    }
  }, [order, userKey])

  const moveSection = (id: SectionId, dir: -1 | 1) => {
    setOrder((prev) => {
      const i = prev.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const dropOnSection = (target: SectionId) => {
    const from = dragSection
    setDragSection(null)
    setDragOverSection(null)
    if (!from || from === target) return
    setOrder((prev) => {
      const next = [...prev]
      const fi = next.indexOf(from)
      const ti = next.indexOf(target)
      if (fi < 0 || ti < 0) return prev
      next.splice(fi, 1)
      next.splice(ti, 0, from)
      return next
    })
  }

  const loadSummary = useCallback(async () => {
    if (!user?.gym_id) return
    try {
      const res = await apiFetch<GymSummary>(`/dashboard/summary?period=${period}`)
      setSummary(res)
    } catch {
      // Resumen aún no disponible: los chips quedan en "—".
      setSummary(EMPTY_SUMMARY)
    }
  }, [user?.gym_id, period])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (active.length === 0) {
      setDashData({})
      return
    }
    let cancelled = false
    setDashData({})
    setDashError(null)
    const params = new URLSearchParams({ slugs: active.join(','), period })
    if (branchId) params.set('branch_id', branchId)
    apiFetch<Record<string, unknown>>(`/dashboards/data?${params}`)
      .then((res) => {
        if (!cancelled) setDashData(res)
      })
      .catch((err) => {
        if (!cancelled) setDashError(err instanceof Error ? err.message : 'No se pudo cargar')
      })
    return () => {
      cancelled = true
    }
  }, [active, period, branchId])

  const moduleItems = NAV_ROUTES.filter(
    (r) =>
      r.component !== 'dashboard' && !pinned.includes(r.component) && hasComponent(r.component),
  ).sort((a, b) => {
    const ai = MODULE_CARD_ORDER.indexOf(a.component)
    const bi = MODULE_CARD_ORDER.indexOf(b.component)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  const handleModulesDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setModulesDragOver(false)
    const component = e.dataTransfer.getData('text/plain')
    if (component) unpin(component)
  }

  const availableDashboards = DASHBOARD_CATALOG.filter((d) => !active.includes(d.slug))

  const handleGridDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setGridDragOver(false)
    const slug = e.dataTransfer.getData('text/plain')
    if (slug && getDashboard(slug)) add(slug)
  }

  const handleTrayButtonDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setTrayBtnDragOver(false)
    const slug = e.dataTransfer.getData('text/plain')
    if (slug && getDashboard(slug)) remove(slug)
  }

  const kpis: { label: string; value: number | string; icon: React.ElementType; hint?: string }[] =
    summary
      ? [
          { label: 'Socios activos', value: summary.socios_activos, icon: Users, hint: 'con membresía vigente' },
          { label: 'Check-ins hoy', value: summary.checkins_hoy, icon: ScanLine, hint: 'asistencias del día' },
          { label: 'Nuevas membresías', value: summary.nuevas_membresias, icon: BadgeCheck, hint: periodHint },
          { label: 'Ingresos del mes', value: formatCurrency(summary.ingresos_mes), icon: Wallet, hint: 'MXN' },
          { label: 'Morosidad', value: summary.morosidad, icon: TrendingDown, hint: 'adeudos pendientes' },
          { label: 'Socios en riesgo', value: summary.socios_en_riesgo, icon: Sparkles, hint: 'posible abandono' },
        ]
      : [
          { label: 'Socios activos', value: '—', icon: Users },
          { label: 'Check-ins hoy', value: '—', icon: ScanLine },
          { label: 'Nuevas membresías', value: '—', icon: BadgeCheck },
          { label: 'Ingresos del mes', value: '—', icon: Wallet },
          { label: 'Morosidad', value: '—', icon: TrendingDown },
          { label: 'Socios en riesgo', value: '—', icon: Sparkles },
        ]

  return (
    <AppLayout>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('es-MX', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            · resumen operativo del gimnasio
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="success" size="xl" className="w-full sm:w-auto">
          <Link to="/checkin">
            <ScanLine className="size-5" aria-hidden="true" />
            Check-in de socios
          </Link>
        </Button>
        <Button asChild variant="soft" size="xl" className="w-full sm:w-auto">
          <Link to="/socios">
            <Users className="size-5" aria-hidden="true" />
            Nuevo socio
          </Link>
        </Button>
      </div>

      <p className="mb-5 text-xs text-muted-foreground">
        Arrastra las secciones o usa las flechas para ordenarlas a tu gusto
      </p>

      <div className="space-y-8">
        {order.map((id, idx) => {
          const isFirst = idx === 0
          const isLast = idx === order.length - 1
          const frame = (label: string, children: React.ReactNode) => (
            <SectionFrame
              key={id}
              label={label}
              isFirst={isFirst}
              isLast={isLast}
              onMove={(dir) => moveSection(id, dir)}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', id)
                e.dataTransfer.effectAllowed = 'move'
                setDragSection(id)
              }}
              onDragEnd={() => {
                setDragSection(null)
                setDragOverSection(null)
              }}
              onDragOver={(e) => {
                if (dragSection && dragSection !== id) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverSection(id)
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                dropOnSection(id)
              }}
              highlighted={Boolean(dragSection && dragSection !== id && dragOverSection === id)}
            >
              {children}
            </SectionFrame>
          )

          switch (id) {
            case 'resumen':
              return frame(
                SECTION_LABELS.resumen,
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {kpis.map((k) => (
                    <KpiCard key={k.label} {...k} />
                  ))}
                </div>,
              )
            case 'modulos':
              return frame(
                SECTION_LABELS.modulos,
                <>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setModulesDragOver(true)
                    }}
                    onDragLeave={() => setModulesDragOver(false)}
                    onDrop={handleModulesDrop}
                    className={cn(
                      'grid grid-cols-2 gap-4 rounded-xl sm:grid-cols-3 lg:grid-cols-4',
                      modulesDragOver && 'outline-2 outline-dashed outline-primary/40',
                    )}
                  >
                    {moduleItems.map((m) => {
                      const meta = MODULE_META[m.component]
                      return (
                        <Link
                          key={m.to}
                          to={m.to}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', m.component)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          title="Arrastra a la barra lateral para fijarlo"
                          className="group flex cursor-grab flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-card transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-glow active:cursor-grabbing"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'flex size-10 shrink-0 items-center justify-center rounded-xl',
                                meta.iconBg,
                              )}
                            >
                              <meta.icon
                                className={cn('size-5', meta.text)}
                                aria-hidden="true"
                              />
                            </span>
                            <p className="truncate text-sm font-semibold">{m.label}</p>
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{meta.desc}</p>
                        </Link>
                      )
                    })}
                    {moduleItems.length === 0 && (
                      <p className="col-span-full text-sm text-muted-foreground">
                        Todos los módulos están en la barra lateral. Arrastra uno aquí para
                        quitarlo.
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Arrastra un módulo al sidebar para fijarlo, o desde el sidebar a aquí para
                    quitarlo.
                  </p>
                </>,
              )
            case 'dashboards':
              return frame(
                SECTION_LABELS.dashboards,
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="flex rounded-full border border-border bg-card p-0.5">
                      {PERIODS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setPeriod(p.value)}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                            period === p.value
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTrayOpen((o) => !o)}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        setTrayBtnDragOver(true)
                      }}
                      onDragLeave={() => setTrayBtnDragOver(false)}
                      onDrop={handleTrayButtonDrop}
                      className={cn(trayBtnDragOver && 'border-primary/40 bg-primary/10')}
                    >
                      <PanelTop className="size-4" aria-hidden="true" />
                      Bandeja de dashboards
                    </Button>
                  </div>

                  <DashboardTray
                    open={trayOpen}
                    available={availableDashboards}
                    onClose={() => setTrayOpen(false)}
                  />

                  {dashError && (
                    <ErrorState
                      description={dashError}
                      onRetry={() => window.location.reload()}
                      className="mb-4"
                    />
                  )}

                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setGridDragOver(true)
                    }}
                    onDragLeave={() => setGridDragOver(false)}
                    onDrop={handleGridDrop}
                    className={cn(
                      'grid gap-4 rounded-xl sm:grid-cols-2 xl:grid-cols-3',
                      gridDragOver && 'outline-2 outline-dashed outline-primary/40',
                      active.length === 0 &&
                        'border border-dashed border-border/60 bg-card/40 p-10',
                    )}
                  >
                    {active.length === 0 ? (
                      <p className="col-span-full text-center text-sm text-muted-foreground">
                        Arrastra aquí un dashboard de la bandeja para dibujarlo.
                      </p>
                    ) : (
                      active.map((slug) => {
                        const def = getDashboard(slug)
                        if (!def) return null
                        return (
                          <Card
                            key={slug}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', slug)
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            title="Arrastra a la bandeja para quitarlo"
                            className="group relative cursor-grab gap-3 active:cursor-grabbing"
                          >
                            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-0">
                              <CardTitle className="font-display text-base">{def.title}</CardTitle>
                              <button
                                type="button"
                                onClick={() => remove(slug)}
                                aria-label={`Quitar ${def.title}`}
                                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              >
                                <X className="size-4" />
                              </button>
                            </CardHeader>
                            <CardContent className="h-60">
                              {dashData[slug] ? (
                                <DashboardChart slug={slug} data={dashData[slug]} />
                              ) : (
                                <LoadingState label="Cargando…" />
                              )}
                            </CardContent>
                          </Card>
                        )
                      })
                    )}
                  </div>
                </>,
              )
            default:
              return null
          }
        })}
      </div>

      <Separator className="mt-8" />
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Dumbbell className="size-3.5" aria-hidden="true" />
        Los datos del dashboard se actualizan según la sucursal seleccionada arriba.
      </p>
    </AppLayout>
  )
}