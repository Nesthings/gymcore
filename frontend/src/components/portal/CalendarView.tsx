import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface CalendarEntry {
  checked_at: string
  checked_out_at?: string | null
  duration_min?: number | null
}

export interface CalendarDay {
  date: string
  entries: CalendarEntry[]
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function fmtMin(min?: number | null) {
  if (min == null) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

export function CalendarView({
  data,
  className,
}: {
  data: { year: number; month: number; days: CalendarDay[] } | null
  className?: string
}) {
  const [selected, setSelected] = useState<CalendarDay | null>(null)

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarDay>()
    data?.days.forEach((d) => map.set(d.date, d))
    return map
  }, [data])

  const cells = useMemo(() => {
    if (!data) return []
    const first = new Date(data.year, data.month - 1, 1)
    const startWeekday = (first.getDay() + 6) % 7 // lunes = 0
    const daysInMonth = new Date(data.year, data.month, 0).getDate()
    const lead: (null | number)[] = Array.from({ length: startWeekday }, () => null)
    const nums = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    return [...lead, ...nums]
  }, [data])

  if (!data) return null

  return (
    <div className={cn('space-y-3', className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <CalendarDays className="size-4 text-primary" aria-hidden="true" />
        Mi calendario · {MONTHS[data.month - 1]} {data.year}
      </h2>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((n, i) => {
            if (n == null) return <span key={`e-${i}`} />
            const iso = `${data.year}-${String(data.month).padStart(2, '0')}-${String(n).padStart(2, '0')}`
            const day = byDate.get(iso)
            const today = new Date().toISOString().slice(0, 10) === iso
            return (
              <button
                key={i}
                type="button"
                disabled={!day}
                onClick={() => day && setSelected(day)}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors',
                  day
                    ? 'cursor-pointer bg-primary/10 font-semibold text-primary hover:bg-primary/20'
                    : 'text-muted-foreground/50',
                  today && 'ring-1 ring-primary/40',
                )}
                aria-label={iso}
              >
                {n}
                {day && <span className="text-xs leading-none" aria-hidden="true">🔥</span>}
              </button>
            )
          })}
        </div>
      </div>

      <Dialog open={selected != null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selected
                ? new Date(selected.date + 'T12:00:00').toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                  })
                : ''}
            </DialogTitle>
            <DialogDescription>Entrenamiento registrado</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selected?.entries.map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
              >
                <span>
                  🕐 Entrada:{' '}
                  <span className="font-mono tabular-nums">
                    {new Date(e.checked_at).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
                <span className="font-medium">⏱️ {fmtMin(e.duration_min) ?? '—'}</span>
              </div>
            ))}
            {selected && selected.entries.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin registros ese día.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}