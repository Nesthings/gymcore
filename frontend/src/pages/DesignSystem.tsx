import { Bell, Check, ChevronDown, Info, Inbox, Plus, Search, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const palette = [
  { name: 'background', token: 'bg-background', hex: '#f5f4f1' },
  { name: 'foreground', token: 'bg-foreground', hex: '#161512' },
  { name: 'card', token: 'bg-card', hex: '#fbfaf7' },
  { name: 'primary', token: 'bg-primary', hex: '#a3e635' },
  { name: 'primary-foreground', token: 'bg-primary-foreground', hex: '#17160e' },
  { name: 'secondary', token: 'bg-secondary', hex: '#e9e7e0' },
  { name: 'muted', token: 'bg-muted', hex: '#eeede8' },
  { name: 'accent', token: 'bg-accent', hex: '#e5e3db' },
  { name: 'destructive', token: 'bg-destructive', hex: '#c34a42' },
  { name: 'success', token: 'bg-success', hex: '#4d7c0f' },
  { name: 'warning', token: 'bg-warning', hex: '#a16207' },
  { name: 'info', token: 'bg-info', hex: '#4c596b' },
  { name: 'chart-1', token: 'bg-chart-1', hex: '#a3e635' },
  { name: 'chart-2', token: 'bg-chart-2', hex: '#65a30d' },
  { name: 'chart-3', token: 'bg-chart-3', hex: '#f59e0b' },
]

const darkPalette = [
  { name: 'background', token: 'bg-background', hex: '#121110' },
  { name: 'card', token: 'bg-card', hex: '#1a1917' },
  { name: 'primary', token: 'bg-primary', hex: '#ef4444' },
  { name: 'primary-foreground', token: 'bg-primary-foreground', hex: '#17080a' },
  { name: 'muted', token: 'bg-muted', hex: '#1d1c18' },
  { name: 'muted-foreground', token: 'bg-muted-foreground', hex: '#9b968b' },
]

const typeScale = [
  { label: 'Display / h1', cls: 'text-3xl font-bold tracking-tight', sample: 'Súbele a tu fuerza' },
  { label: 'h2', cls: 'text-2xl font-bold tracking-tight', sample: 'Súbele a tu fuerza' },
  { label: 'h3', cls: 'text-xl font-semibold', sample: 'Súbele a tu fuerza' },
  { label: 'h4', cls: 'text-base font-semibold', sample: 'Súbele a tu fuerza' },
  { label: 'Body', cls: 'text-base', sample: 'Registra el check-in de tus socios hoy.' },
  { label: 'Small / caption', cls: 'text-sm text-muted-foreground', sample: 'Última actualización hace 5 min' },
]

const statNumbers = [
  { label: 'Socios activos', value: '1,284' },
  { label: 'Check-ins hoy', value: '342' },
  { label: 'Ingresos del mes', value: '$84,500' },
  { label: 'Socios en riesgo', value: '37' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Separator className="flex-1" />
      </div>
      {children}
    </section>
  )
}

export function DesignSystem() {
  return (
    <div className="mx-auto max-w-5xl space-y-14 px-6 py-10">
      <header className="space-y-2">
        <Badge variant="secondary">GymCore · design system</Badge>
        <h1 className="text-3xl font-bold tracking-tight">Sistema de diseño — GymCore</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Identidad "energía de gimnasio": neutrales cálidos tipo carbón, un solo acento volt/lime
          (#a3e635), Space Grotesk para display, Geist para UI y Geist Mono para números.
          Botones pill, cards rounded-2xl, inputs rounded-lg. Esta página muestra los tokens y
          componentes que usan todas las pantallas.
        </p>
      </header>

      <Section title="Paleta — modo claro">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {palette.map((c) => (
            <div key={c.name} className="space-y-2">
              <div className={`h-16 w-full rounded-xl ${c.token} shadow-card`} />
              <div>
                <p className="text-xs font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Paleta — modo oscuro (charcoal)">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {darkPalette.map((c) => (
              <div key={c.name} className="space-y-2">
                <div className={`h-16 w-full rounded-xl ${c.token} shadow-card`} />
                <div>
                  <p className="text-xs font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Números y estadísticas (Geist Mono · tabular-nums)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statNumbers.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <p className="stat-number text-2xl font-bold tracking-tight text-foreground">
                {s.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía (Space Grotesk + Geist)">
        <div className="space-y-2 rounded-xl border border-border bg-card p-6 shadow-card">
          {typeScale.map((t) => (
            <p key={t.label} className={`${t.cls} py-1`}>
              {t.label} — {t.sample}
            </p>
          ))}
        </div>
      </Section>

      <Section title="Botones (pill)">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Eliminar</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xs">XS</Button>
          <Button size="sm">SM</Button>
          <Button size="lg">LG</Button>
          <Button disabled>Deshabilitado</Button>
          <Button>
            <Plus />
            Nuevo
          </Button>
          <Button size="icon" aria-label="Notificaciones">
            <Bell />
          </Button>
        </div>
      </Section>

      <Section title="Inputs y campos (rounded-lg)">
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del socio</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="name" placeholder="Ej. Ana García" className="pl-9" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sel">Plan</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section title="Badges de estado">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secundario</Badge>
          <Badge variant="success">Activa</Badge>
          <Badge variant="warning">Vence pronto</Badge>
          <Badge variant="destructive">Vencida</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      <Section title="Card (rounded-2xl)">
        <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Check-ins de hoy</CardTitle>
              <CardDescription>Resumen del día en tu sucursal</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="stat-number text-4xl font-bold text-primary">342</p>
              <p className="text-sm text-muted-foreground">
                12 membresías vencen hoy · 8 renovaciones
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">
                Ver check-in
              </Button>
            </CardFooter>
          </Card>
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle>Riesgo de abandono</CardTitle>
              <CardDescription>Socios que requieren atención</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-warning" />
              <p className="text-sm text-muted-foreground">37 socios sin visitar en 14+ días</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Tabla">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Último check-in</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: 'Ana García', plan: 'Mensual', checkin: 'Hoy 08:10', st: 'activa' },
                { name: 'Luis Pérez', plan: 'Trimestral', checkin: 'Hace 3 días', st: 'riesgo' },
                { name: 'María López', plan: 'Anual', checkin: 'Ayer 18:40', st: 'activa' },
              ].map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.plan}</TableCell>
                  <TableCell>{row.checkin}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.st === 'activa'
                          ? 'success'
                          : row.st === 'riesgo'
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {row.st}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={`Editar ${row.name}`}>
                      <Search />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Estados diseñados">
        <div className="grid gap-4 lg:grid-cols-3">
          <EmptyState
            title="Sin socios aún"
            description="Registra tu primer socio para empezar a operar."
            icon={Inbox}
            action={<Button size="sm">Registrar socio</Button>}
          />
          <LoadingState label="Cargando socios…" />
          <ErrorState description="No pudimos cargar los socios." onRetry={() => undefined} />
        </div>
      </Section>

      <Section title="Skeleton (carga esqueleto)">
        <div className="flex max-w-lg items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-card">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </Section>

      <Section title="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              Abrir dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar acción</DialogTitle>
              <DialogDescription>
                Esta acción registra el evento en la bitácora del gimnasio.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 rounded-md bg-secondary p-4 text-sm text-secondary-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>Los cambios se guardan de inmediato y no se pueden deshacer.</p>
            </div>
            <DialogFooter>
              <Button variant="outline">Cancelar</Button>
              <Button>
                <Check />
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <footer className="flex items-center gap-2 border-t border-border pt-6 text-sm text-muted-foreground">
        <ChevronDown className="size-4" />
        Componentes y tokens listos para operar.
      </footer>
    </div>
  )
}