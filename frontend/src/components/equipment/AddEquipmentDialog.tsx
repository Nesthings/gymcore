import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Loader2, Plus, Sparkles } from 'lucide-react'

import { EquipmentShape } from '@/components/equipment/EquipmentShape'
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
import { SearchInput } from '@/components/ui/search-input'
import { useToast } from '@/components/ui/toast'
import {
  addMaintenanceTask,
  applyRecommendations,
  createAsset,
  createCustomModel,
  createCustomType,
  defaultDimensions,
  type Catalog,
  type EquipmentAsset,
  type GymLayoutConfig,
  type Recommendation,
} from '@/lib/equipment'
import { cn } from '@/lib/utils'

export function AddEquipmentDialog({
  open,
  onOpenChange,
  catalog,
  layout,
  roomId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog: Catalog
  layout: GymLayoutConfig
  roomId?: string | null
  onCreated: (asset: EquipmentAsset) => void
}) {
  const [step, setStep] = useState(0)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [typeId, setTypeId] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [customType, setCustomType] = useState('')
  const [customBrand, setCustomBrand] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [assetNumber, setAssetNumber] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [customName, setCustomName] = useState('')
  const [notes, setNotes] = useState('')
  const [applyRecs, setApplyRecs] = useState(true)
  const [manualTask, setManualTask] = useState('')
  const [manualTaskDays, setManualTaskDays] = useState('')
  const [width, setWidth] = useState('')
  const [depth, setDepth] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) {
      setStep(0)
      setCategoryId(null)
      setTypeId(null)
      setBrandId(null)
      setModelId(null)
      setSearch('')
      setCustomType('')
      setCustomBrand('')
      setCustomModel('')
      setAssetNumber('')
      setSerialNumber('')
      setCustomName('')
      setNotes('')
      setApplyRecs(true)
      setManualTask('')
      setManualTaskDays('')
    }
  }, [open])

  const types = useMemo(
    () => catalog.types.filter((t) => t.category_id === categoryId),
    [catalog.types, categoryId],
  )
  const type = catalog.types.find((t) => t.id === typeId) ?? null
  const category = catalog.categories.find((c) => c.id === categoryId) ?? null

  const brands = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalog.brands.filter((b) => !q || b.name.toLowerCase().includes(q))
  }, [catalog.brands, search])

  const models = useMemo(
    () =>
      catalog.models.filter(
        (m) =>
          m.type_id === typeId && m.brand_id === brandId && !m.name.toLowerCase().includes('(copia)'),
      ),
    [catalog.models, typeId, brandId],
  )
  const model = catalog.models.find((m) => m.id === modelId) ?? null
  const recs: Recommendation[] = model?.recommendations ?? []

  const dims = (() => {
    if (model?.width_m && model?.depth_m) return { w: model.width_m, d: model.depth_m }
    const f = defaultDimensions(type?.name)
    return { w: Number(width) || f.w, d: Number(depth) || f.d }
  })()

  const resetLower = () => {
    setTypeId(null)
    setBrandId(null)
    setModelId(null)
    setSearch('')
    setCustomBrand('')
    setCustomModel('')
    setWidth('')
    setDepth('')
  }

  const finish = async () => {
    setBusy(true)
    try {
      let finalModelId = modelId
      if (!finalModelId) {
        // Modelo personalizado del gimnasio (no contamina catálogo global)
        const created = await createCustomModel({
          name: customModel.trim() || (type?.name ?? 'Equipo'),
          type_id: typeId,
          brand_name: customBrand.trim() || 'Personalizada',
          width_m: dims.w,
          depth_m: dims.d,
        })
        finalModelId = (created as { id: string }).id
      }
      const asset = await createAsset({
        equipment_model_id: finalModelId,
        room_id: roomId ?? null,
        asset_number: assetNumber.trim() || null,
        serial_number: serialNumber.trim() || null,
        custom_name: customName.trim() || null,
        notes: notes.trim() || null,
        width_m: dims.w,
        depth_m: dims.d,
        position_x: Math.max(1, layout.width_m / 2 - dims.w / 2),
        position_y: Math.max(1, layout.length_m / 2 - dims.d / 2),
      })
      if (applyRecs && recs.length > 0) {
        await applyRecommendations(asset.id)
      }
      if (manualTask.trim() && Number(manualTaskDays) > 0) {
        await addMaintenanceTask(asset.id, {
          name: manualTask.trim(),
          task_type: 'inspection',
          interval_days: Number(manualTaskDays),
          frequency: 'custom',
        })
      }
      toast({ title: 'Equipo agregado', description: 'Ya está en el plano; arrástralo a su lugar.', variant: 'success' })
      onCreated(asset)
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'No se pudo agregar',
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const canFinish = Boolean(typeId) && Boolean(modelId || customModel.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" /> Añadir equipo
          </DialogTitle>
          <DialogDescription>
            {step === 0 && 'Elige la categoría del equipo.'}
            {step === 1 && 'Selecciona el tipo de equipo.'}
            {step === 2 && 'Selecciona la marca.'}
            {step === 3 && 'Selecciona el modelo comercial.'}
            {step === 4 && 'Confirma y coloca el equipo en el plano.'}
          </DialogDescription>
        </DialogHeader>

        {step > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => {
              setStep((s) => s - 1)
              if (step === 1) resetLower()
            }}
          >
            <ArrowLeft /> Atrás
          </Button>
        )}

        {/* Paso 0: categoría */}
        {step === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategoryId(c.id)
                  resetLower()
                  setStep(1)
                }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <EquipmentShape
                  typeName={null}
                  categoryName={c.name}
                  status="operativo"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Paso 1: tipo */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {types.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTypeId(t.id)
                    setStep(2)
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    typeId === t.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground hover:bg-accent',
                  )}
                >
                  {t.name}
                </button>
              ))}
              {types.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin tipos en esta categoría.</p>
              )}
            </div>
            <div className="flex items-end gap-2 border-t border-border pt-3">
              <div className="flex-1 space-y-1">
                <Label>Crear tipo personalizado</Label>
                <Input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Ej. Escaladora"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!customType.trim() || !categoryId}
                onClick={async () => {
                  try {
                    const t = await createCustomType({
                      name: customType.trim(),
                      category_id: categoryId!,
                    })
                    setTypeId(t.id)
                    setStep(2)
                    toast({ title: 'Tipo creado', variant: 'success' })
                  } catch (err) {
                    toast({
                      title: 'No se pudo crear el tipo',
                      description: err instanceof Error ? err.message : undefined,
                      variant: 'error',
                    })
                  }
                }}
              >
                <Plus /> Crear
              </Button>
            </div>
          </div>
        )}

        {/* Paso 2: marca */}
        {step === 2 && (
          <div className="space-y-3">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar marca…" />
            <div className="grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBrandId(b.id)
                    setStep(3)
                  }}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  {b.name}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2 border-t border-border pt-3">
              <div className="flex-1 space-y-1">
                <Label>Otra marca</Label>
                <Input value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} placeholder="Ej. Impulse" />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!customBrand.trim()}
                onClick={() => {
                  setBrandId(null)
                  setStep(3)
                }}
              >
                <Plus /> Usar
              </Button>
            </div>
          </div>
        )}

        {/* Paso 3: modelo */}
        {step === 3 && (
          <div className="space-y-3">
            {models.length > 0 ? (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setModelId(m.id)
                      setWidth(m.width_m ? String(m.width_m) : '')
                      setDepth(m.depth_m ? String(m.depth_m) : '')
                      setCustomName('')
                      setStep(4)
                    }}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.width_m && m.depth_m
                          ? `${m.width_m} × ${m.depth_m} m`
                          : 'Dimensiones no publicadas'}
                        {m.recommendations.length > 0 && ' · con mantenimiento sugerido'}
                      </p>
                    </div>
                    {m.recommendations.length > 0 && <Sparkles className="size-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay modelos publicados para esta marca/tipo. Crea uno personalizado (pertenece a tu
                gimnasio, no al catálogo global).
              </p>
            )}
            <div className="flex items-end gap-2 border-t border-border pt-3">
              <div className="flex-1 space-y-1">
                <Label>Modelo personalizado</Label>
                <Input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="Ej. Modelo 900" />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!customModel.trim()}
                onClick={() => {
                  setModelId(null)
                  setStep(4)
                }}
              >
                <Plus /> Usar
              </Button>
            </div>
          </div>
        )}

        {/* Paso 4: confirmar */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="h-20 w-28 shrink-0">
                <EquipmentShape
                  typeName={type?.name}
                  categoryName={category?.name}
                  status="operativo"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {(model?.name ?? customModel) || type?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {category?.name} · {type?.name} · {model?.name ? brandName() : customBrand || 'Personalizada'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dims.w} × {dims.d} m
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Número de activo</Label>
                <Input value={assetNumber} onChange={(e) => setAssetNumber(e.target.value)} placeholder="LF-TM-001" />
              </div>
              <div className="space-y-1">
                <Label>No. de serie</Label>
                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Nombre personalizado</Label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Ej. Cinta 1" />
              </div>
              <div className="space-y-1">
                <Label>Ancho (m)</Label>
                <Input type="number" step="0.1" min="0.1" value={width} onChange={(e) => setWidth(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fondo (m)</Label>
                <Input type="number" step="0.1" min="0.1" value={depth} onChange={(e) => setDepth(e.target.value)} />
              </div>
            </div>

            {recs.length > 0 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3">
                <input
                  type="checkbox"
                  checked={applyRecs}
                  onChange={(e) => setApplyRecs(e.target.checked)}
                  className="mt-1 size-4 accent-[var(--primary)]"
                />
                <div>
                  <p className="text-sm font-medium">Aplicar recomendaciones del fabricante</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                    {recs.map((r) => (
                      <li key={r.id}>
                        {r.task} · cada {r.interval_days} días
                      </li>
                    ))}
                  </ul>
                </div>
              </label>
            )}

            <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_auto]">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label>Tarea manual (opcional)</Label>
                  <Input value={manualTask} onChange={(e) => setManualTask(e.target.value)} placeholder="Ej. Limpieza semanal" />
                </div>
                <div className="w-28 space-y-1">
                  <Label>Intervalo (días)</Label>
                  <Input type="number" min="1" value={manualTaskDays} onChange={(e) => setManualTaskDays(e.target.value)} />
                </div>
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(3)} disabled={busy}>
                Atrás
              </Button>
              <Button type="button" onClick={finish} disabled={!canFinish || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Check />} Colocar en el plano
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )

  function brandName() {
    const b = catalog.brands.find((x) => x.id === brandId)
    return b?.name ?? ''
  }
}