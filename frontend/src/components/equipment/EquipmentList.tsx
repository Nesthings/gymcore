import { useMemo, useState } from 'react'
import { ArrowUpRight, Dumbbell } from 'lucide-react'

import { EquipmentShape } from '@/components/equipment/EquipmentShape'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ASSET_STATUS_META,
  fmtDate,
  type AssetStatus,
  type EquipmentAsset,
} from '@/lib/equipment'
import { cn } from '@/lib/utils'

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'operativo', label: 'Operativos' },
  { value: 'mantenimiento_proximo', label: 'Mantenimiento próximo' },
  { value: 'mantenimiento_vencido', label: 'Mantenimiento vencido' },
  { value: 'fuera_servicio', label: 'Fuera de servicio' },
  { value: 'retirado', label: 'Retirados' },
]

export function EquipmentList({
  assets,
  onSelect,
}: {
  assets: EquipmentAsset[]
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')

  const categories = useMemo(
    () => Array.from(new Set(assets.map((a) => a.category_name ?? 'Otros'))).sort(),
    [assets],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return assets.filter((a) => {
      if (status !== 'all' && a.status !== (status as AssetStatus)) return false
      if (category !== 'all' && (a.category_name ?? 'Otros') !== category) return false
      if (q) {
        const hay = [a.display_name, a.brand_name, a.model_name, a.type_name, a.asset_number, a.serial_number]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [assets, search, category, status])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar equipo, marca, modelo…" className="sm:max-w-xs" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin equipos"
          description="No hay equipos que coincidan con los filtros."
          icon={Dumbbell}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipo</TableHead>
                <TableHead className="hidden md:table-cell">Categoría / Tipo</TableHead>
                <TableHead className="hidden lg:table-cell">Activo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden xl:table-cell">Próximo mantenimiento</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const meta = ASSET_STATUS_META[a.status]
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-12 shrink-0">
                          <EquipmentShape typeName={a.type_name} categoryName={a.category_name} status={a.status} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{a.display_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[a.brand_name, a.model_name].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm">{a.category_name}</span>
                      <span className="ml-1 text-xs text-muted-foreground">· {a.type_name}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">{a.asset_number ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant as never}>
                        <span className={cn('mr-1 size-1.5 rounded-full', meta.dot)} /> {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <span className="text-sm text-muted-foreground">{fmtDate(a.next_due_at)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" aria-label="Ver detalles" onClick={() => onSelect(a.id)}>
                        <ArrowUpRight />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}