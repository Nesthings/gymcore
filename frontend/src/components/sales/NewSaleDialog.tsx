import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Package, Plus, ShieldCheck, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import type { SaleProduct } from '@/lib/product'
import { formatCurrency } from '@/lib/utils'

interface Branch {
  id: string
  name: string
}

interface ProductLine {
  key: string
  product_id: string
  name: string
  price: number
  stock: number
  quantity: number
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
]

export function NewSaleDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<SaleProduct[]>([])
  const [branchId, setBranchId] = useState('')
  const [lines, setLines] = useState<ProductLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ total: number; item_count: number } | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setError(null)
    setDone(null)
    setLines([])
    setPaymentMethod('cash')
    Promise.all([
      apiFetch<Branch[]>('/branches'),
      apiFetch<SaleProduct[]>('/products?active_only=true'),
    ])
      .then(([br, pr]) => {
        if (!alive) return
        setBranches(br)
        setProducts(pr)
        setBranchId((cur) => cur || br[0]?.id || '')
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'No se pudo cargar la información')
      })
    return () => {
      alive = false
    }
  }, [open])

  const subtotal = useMemo(() => lines.reduce((acc, l) => acc + l.price * l.quantity, 0), [lines])

  const productStock = (productId: string) =>
    products.find((p) => p.id === productId)?.stock_quantity ?? 0

  const addProduct = (productId: string) => {
    if (!productId) return
    const prod = products.find((p) => p.id === productId)
    if (!prod || prod.price == null) return
    const price = prod.price
    setLines((list) => [
      ...list,
      {
        key: crypto.randomUUID(),
        product_id: prod.id,
        name: prod.name,
        price,
        stock: prod.stock_quantity,
        quantity: 1,
      },
    ])
  }

  const updateQty = (key: string, value: number) => {
    setLines((list) =>
      list.map((x) =>
        x.key === key ? { ...x, quantity: Math.max(1, Math.min(x.stock, value || 1)) } : x,
      ),
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (lines.length === 0) {
      setError('Agrega al menos un producto.')
      return
    }
    setSubmitting(true)
    try {
      const res = await apiFetch<{ id: string; total: number; item_count: number }>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: branchId || null,
          payment_method: paymentMethod,
          items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
        }),
      })
      setDone(res)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la venta')
    } finally {
      setSubmitting(false)
    }
  }

  const resetAndClose = useCallback(() => {
    setDone(null)
    setLines([])
    setError(null)
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="size-12 text-success" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-semibold">Venta registrada</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Se cobraron {formatCurrency(done.total)} y se descontó el stock del catálogo.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={resetAndClose}>Listo</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" aria-hidden="true" /> Nueva venta
              </DialogTitle>
              <DialogDescription>
                Venta de mostrador de productos — al cobrar se descuenta la existencia.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={submit} className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sucursal</Label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Método de pago</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Productos</Label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    addProduct(e.target.value)
                    e.target.value = ''
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Agregar producto —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.stock_quantity <= 0}>
                      {p.name} · {p.price != null ? formatCurrency(p.price) : '—'}
                      {p.stock_quantity <= 0 ? ' (agotado)' : ` (${p.stock_quantity})`}
                    </option>
                  ))}
                </select>
              </div>

              {lines.length === 0 ? (
                <EmptyState
                  title="Sin productos"
                  description="Selecciona los productos que lleva el cliente."
                  icon={Package}
                  className="py-8"
                />
              ) : (
                <div className="space-y-2">
                  {lines.map((l) => (
                    <div
                      key={l.key}
                      className="flex items-center gap-2 rounded-md border border-border/60 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(l.price)} · quedan {productStock(l.product_id)}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="1"
                        max={productStock(l.product_id)}
                        value={l.quantity}
                        onChange={(e) => updateQty(l.key, Number(e.target.value))}
                        className="w-20"
                      />
                      <span className="w-24 text-right text-sm font-semibold">
                        {formatCurrency(l.price * l.quantity)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Quitar"
                        onClick={() => setLines((list) => list.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetAndClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting || lines.length === 0}>
                  {submitting ? <Loader2 className="animate-spin" /> : <Plus />} Cobrar venta
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}