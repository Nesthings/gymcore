import { useEffect, useState } from 'react'
import { Loader2, Package } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { PRODUCT_CATEGORY_SUGGESTIONS } from '@/lib/product'
import type { SaleProduct } from '@/lib/product'

export function ProductFormDialog({
  open,
  product,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  product: SaleProduct | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [active, setActive] = useState(true)
  const [threshold, setThreshold] = useState('5')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(product?.name ?? '')
    setCategory(product?.category ?? '')
    setPrice(product?.price != null ? String(product.price) : '')
    setStock(product?.stock_quantity != null ? String(product.stock_quantity) : '')
    setActive(product?.active ?? true)
    setPhotoFile(null)
    setError(null)
    apiFetch<{ stock_alert_threshold?: number }>('/gyms/me')
      .then((c) => setThreshold(String(c.stock_alert_threshold ?? 5)))
      .catch(() => undefined)
  }, [open, product])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const body = JSON.stringify({
        name,
        category,
        price: price ? Number(price) : null,
        stock_quantity: Number(stock) || 0,
        active,
      })
      let id: string
      if (product) {
        await apiFetch(`/products/${product.id}`, { method: 'PATCH', body })
        id = product.id
      } else {
        const created = await apiFetch<SaleProduct>('/products', { method: 'POST', body })
        id = created.id
      }
      if (photoFile) {
        const form = new FormData()
        form.append('file', photoFile)
        await apiFetch(`/products/${id}/photo`, { method: 'POST', body: form })
      }
      await apiFetch('/gyms/me', {
        method: 'PATCH',
        body: JSON.stringify({ stock_alert_threshold: Number(threshold) || 5 }),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>
            Registra un producto de venta (suplementos, ropa, accesorios…) con su categoría y una
            foto opcional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-name">Nombre *</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Proteína whey 2 kg"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-category">Categoría *</Label>
              <Input
                id="p-category"
                list="product-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Suplementos, Ropa, Accesorios…"
                required
              />
              <datalist id="product-categories">
                {PRODUCT_CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-price">Precio</Label>
              <Input
                id="p-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-stock">Cantidad en existencia</Label>
              <Input
                id="p-stock"
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-threshold">Umbral de alerta de stock</Label>
            <Input
              id="p-threshold"
              type="number"
              min="0"
              step="0.5"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="5"
            />
            <p className="text-xs text-muted-foreground">
              Unidades para marcar "Stock bajo" en el catálogo de productos.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Producto activo
          </label>

          <div className="flex items-center gap-3 rounded-md border border-border/60 p-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
              {photoFile ? (
                <img
                  src={URL.createObjectURL(photoFile)}
                  alt="Foto nueva"
                  className="size-full object-cover"
                />
              ) : product?.photo_url ? (
                <img
                  src={product.photo_url}
                  alt={product.name}
                  className="size-full object-cover"
                />
              ) : (
                <Package className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                id="p-photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" size="sm">
                <label htmlFor="p-photo" className="cursor-pointer">
                  {photoFile || product?.photo_url ? 'Cambiar foto' : 'Subir foto'}
                </label>
              </Button>
              <p className="text-xs text-muted-foreground">
                La foto es opcional. Se optimiza automáticamente (máx. 5 MB).
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : 'Guardar producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}