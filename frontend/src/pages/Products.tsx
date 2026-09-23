import { useCallback, useEffect, useMemo, useState } from 'react'
import { Package, PackageMinus, PackageX, Pencil, Plus, Trash2 } from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { ProductFormDialog } from '@/components/products/ProductFormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { ListToolbar } from '@/components/ui/list-toolbar'
import { LoadingState } from '@/components/ui/loading-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination, pageCountFor, paginate } from '@/components/ui/pagination'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatChip } from '@/components/ui/stat-chip'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { SaleProduct } from '@/lib/product'

export function Products() {
  const [products, setProducts] = useState<SaleProduct[]>([])
  const [threshold, setThreshold] = useState(5)
  const [confirm, setConfirm] = useState<{ title: string; onConfirm: () => void } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SaleProduct | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<'name_asc' | 'price_desc' | 'price_asc' | 'stock_asc'>('name_asc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 12
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, gym] = await Promise.all([
        apiFetch<SaleProduct[]>('/products'),
        apiFetch<{ stock_alert_threshold?: number }>('/gyms/me'),
      ])
      setProducts(res)
      setThreshold(gym.stock_alert_threshold ?? 5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los productos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = products.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)),
    )
    const sorted = [...list]
    if (sort === 'price_desc') sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    else if (sort === 'price_asc') sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    else if (sort === 'stock_asc') sorted.sort((a, b) => a.stock_quantity - b.stock_quantity)
    else sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return sorted
  }, [products, search, category, sort])

  useEffect(() => {
    setPage(1)
  }, [search, category, sort])

  const pageCount = pageCountFor(filtered.length, PAGE_SIZE)
  const paged = paginate(filtered, page, PAGE_SIZE)

  const remove = async (p: SaleProduct) => {
    setConfirm({
      title: `¿Eliminar el producto "${p.name}"?`,
      onConfirm: async () => {
        try {
          await apiFetch(`/products/${p.id}`, { method: 'DELETE' })
          toast({ title: 'Producto eliminado', variant: 'success' })
          load()
        } catch (err) {
          toast({
            title: 'No se pudo eliminar el producto',
            description: err instanceof Error ? err.message : undefined,
            variant: 'error',
          })
        }
        setConfirm(null)
      },
    })
  }

  return (
    <AppLayout>
      <PageHeader
        title="Productos"
        subtitle="Catálogo de productos de venta: suplementos, ropa, accesorios, snacks…"
        icon={Package}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus /> Nuevo producto
          </Button>
        }
      />

      {!loading && !error && products.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <StatChip
            label="Agotados"
            value={products.filter((p) => p.stock_quantity <= 0).length}
            icon={PackageX}
            tint="bg-destructive/10 text-destructive"
          />
          <StatChip
            label="Stock bajo"
            value={
              products.filter((p) => p.stock_quantity > 0 && p.stock_quantity < threshold).length
            }
            icon={PackageMinus}
            tint="bg-warning/10 text-warning"
          />
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <ListToolbar>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Buscar producto…"
            className="w-full sm:w-64"
            aria-label="Buscar producto"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44" aria-label="Filtrar por categoría">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-44" aria-label="Ordenar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Nombre (A-Z)</SelectItem>
              <SelectItem value="price_desc">Precio (mayor)</SelectItem>
              <SelectItem value="price_asc">Precio (menor)</SelectItem>
              <SelectItem value="stock_asc">Menor existencia</SelectItem>
            </SelectContent>
          </Select>
        </ListToolbar>
      )}

      {error && <ErrorState description={error} onRetry={load} className="mb-6" />}
      {loading && <LoadingState label="Cargando productos…" />}

      {!loading && !error && products.length === 0 && (
        <EmptyState
          title="Sin productos"
          description="Agrega el primer producto que venda tu gimnasio."
          icon={Package}
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus /> Nuevo producto
            </Button>
          }
        />
      )}

      {!loading && !error && products.length > 0 && filtered.length === 0 && (
        <EmptyState
          title="Sin resultados"
          description="Ajusta la búsqueda o los filtros."
          icon={Package}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {paged.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
            >
              <div className="flex aspect-square items-center justify-center bg-secondary/40">
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt={p.name}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Package className="size-10 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1.5 p-3">
                <p className="truncate font-medium" title={p.name}>
                  {p.name}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{p.category}</Badge>
                  {!p.active && <Badge variant="outline">Inactivo</Badge>}
                </div>
                <p className="text-sm font-semibold">
                  {p.price != null ? formatCurrency(p.price, 2) : 'Sin precio'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.stock_quantity <= 0 ? (
                    <span className="font-medium text-destructive">Agotado</span>
                  ) : p.stock_quantity < threshold ? (
                    <span className="font-medium text-warning">
                      {p.stock_quantity} en existencia · Bajo
                    </span>
                  ) : (
                    <span>{p.stock_quantity} en existencia</span>
                  )}
                </p>
                <div className="flex justify-end gap-1 pt-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${p.name}`}
                    onClick={() => {
                      setEditing(p)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Eliminar ${p.name}`}
                    className="text-destructive"
                    onClick={() => remove(p)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}

      <ProductFormDialog
        open={formOpen}
        product={editing}
        onOpenChange={setFormOpen}
        onSaved={() => {
          setFormOpen(false)
          setEditing(null)
          load()
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.title ?? ''}
        description="El producto dejará de estar disponible para la venta. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => confirm?.onConfirm()}
      />
    </AppLayout>
  )
}