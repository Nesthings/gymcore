import { useState } from 'react'
import { Plus, Scale } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface WeightRecord {
  id: string
  weight_kg: number
  notes?: string | null
  recorded_at: string
}

const AXIS_TICK = { fontSize: 11, fill: 'var(--muted-foreground)' }

export function WeightChart({
  memberId,
  records,
  onChanged,
  className,
}: {
  memberId: string
  records: WeightRecord[]
  onChanged: () => void
  className?: string
}) {
  const [kg, setKg] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const data = records
    .slice()
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((r) => ({
      label: new Date(r.recorded_at).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
      }),
      peso: r.weight_kg,
    }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(kg)
    if (!value || value < 20 || value > 400) {
      toast({ title: 'Peso inválido', description: 'Ingresa un peso entre 20 y 400 kg.', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      await apiFetch(`/members/${memberId}/weights`, {
        method: 'POST',
        body: JSON.stringify({ weight_kg: value, notes: notes.trim() || null }),
      })
      setKg('')
      setNotes('')
      onChanged()
      toast({ title: 'Peso registrado', variant: 'success' })
    } catch (err) {
      toast({
        title: 'No se pudo registrar',
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={cn('rounded-2xl', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="size-4 text-primary" /> Progreso de peso
        </CardTitle>
        <CardDescription>
          {records.length === 0
            ? 'Registra el primer peso para empezar el seguimiento.'
            : `${records.length} registro${records.length === 1 ? '' : 's'} · última medición ${data[data.length - 1]?.label ?? '—'}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {records.length === 0 ? (
          <EmptyState
            title="Sin mediciones"
            description="Agrega un peso y aparecerá la tendencia."
            icon={Scale}
            className="border border-dashed"
          />
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin - 2', 'dataMax + 2']}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="peso"
                  name="Peso (kg)"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#weightArea)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="weight-kg">Peso (kg)</Label>
            <Input
              id="weight-kg"
              type="number"
              step="0.1"
              min={20}
              max={400}
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="p. ej. 78.5"
              className="w-28"
              required
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="weight-notes">Nota (opcional)</Label>
            <Input
              id="weight-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="p. ej. medición en ayunas"
            />
          </div>
          <Button type="submit" size="sm" disabled={saving}>
            <Plus /> Registrar
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}