import { apiFetch } from '@/lib/api'

export interface Category {
  id: string
  name: string
  slug: string
  description?: string | null
}

export interface EquipmentType {
  id: string
  category_id: string
  name: string
  slug: string
  is_custom: boolean
}

export interface Brand {
  id: string
  name: string
}

export interface Recommendation {
  id: string
  task: string
  task_type: string
  interval_days: number
  frequency: string
  instructions?: string | null
  manufacturer_recommended: boolean
  source?: string | null
  source_document?: string | null
}

export interface EquipmentModel {
  id: string
  brand_id: string
  type_id: string
  name: string
  description?: string | null
  width_m?: number | null
  depth_m?: number | null
  height_m?: number | null
  image_url?: string | null
  manual_url?: string | null
  maintenance_guide_url?: string | null
  is_global: boolean
  active: boolean
  recommendations: Recommendation[]
}

export interface Catalog {
  categories: Category[]
  types: EquipmentType[]
  brands: Brand[]
  models: EquipmentModel[]
}

export type AssetStatus =
  | 'operativo'
  | 'mantenimiento_proximo'
  | 'mantenimiento_vencido'
  | 'fuera_servicio'
  | 'retirado'

export interface EquipmentAsset {
  id: string
  gym_id: string
  branch_id?: string | null
  room_id?: string | null
  zone_id?: string | null
  equipment_model_id?: string | null
  category_id?: string | null
  type_id?: string | null
  brand_id?: string | null
  category_name?: string | null
  type_name?: string | null
  brand_name?: string | null
  model_name?: string | null
  custom_name?: string | null
  display_name: string
  asset_number?: string | null
  serial_number?: string | null
  position_x: number
  position_y: number
  rotation: number
  width_m?: number | null
  depth_m?: number | null
  height_m?: number | null
  status: AssetStatus
  installation_date?: string | null
  purchase_date?: string | null
  notes?: string | null
  next_due_at?: string | null
  open_incidents: number
}

export interface MaintenanceTaskItem {
  id: string
  name: string
  task_type: string
  interval_days: number
  frequency: string
  last_completed_at?: string | null
  next_due_at?: string | null
  status: string
  manufacturer_recommended: boolean
  source?: string | null
  source_document?: string | null
}

export interface MaintenanceRecordItem {
  task_name: string
  task_type: string
  completed_at: string
  notes?: string | null
  cost?: number | null
  replaced_parts?: string[] | null
}

export interface IncidentItem {
  id: string
  category: string
  title: string
  description?: string | null
  priority: string
  status: string
  took_out_of_service: boolean
  created_at: string
  resolved_at?: string | null
  resolution_notes?: string | null
}

export interface EquipmentDetail extends EquipmentAsset {
  maintenance: MaintenanceTaskItem[]
  maintenance_history: MaintenanceRecordItem[]
  incidents: IncidentItem[]
}

export interface Zone {
  id: string
  name: string
  color: string
}

export interface Room {
  id: string
  name: string
  width_m: number
  length_m: number
}

export interface GymLayoutConfig {
  gym_id: string
  width_m: number
  length_m: number
  notice_days: number
  zones: Zone[]
  rooms: Room[]
}

export interface TodayCheckin {
  id: string
  member_id: string
  member_name: string
  photo_url?: string | null
  checked_at: string
  checked_out_at?: string | null
}

// --------------------------------------------------------------------------
// API
// --------------------------------------------------------------------------

export async function fetchCatalog(): Promise<Catalog> {
  return apiFetch<Catalog>('/equipment-catalog')
}

export async function fetchAssets(params?: Record<string, string>): Promise<EquipmentAsset[]> {
  const q = new URLSearchParams(params)
  return apiFetch<EquipmentAsset[]>(`/equipment?${q.toString()}`)
}

export async function fetchAsset(id: string): Promise<EquipmentDetail> {
  return apiFetch<EquipmentDetail>(`/equipment/${id}`)
}

export async function createAsset(body: unknown): Promise<EquipmentAsset> {
  return apiFetch<EquipmentAsset>('/equipment', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateAsset(id: string, body: unknown): Promise<EquipmentAsset> {
  return apiFetch<EquipmentAsset>(`/equipment/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export async function updatePosition(id: string, x: number, y: number, rotation: number): Promise<EquipmentAsset> {
  return apiFetch<EquipmentAsset>(`/equipment/${id}/position`, {
    method: 'PATCH',
    body: JSON.stringify({ position_x: x, position_y: y, rotation }),
  })
}

export async function duplicateAsset(id: string): Promise<EquipmentAsset> {
  return apiFetch<EquipmentAsset>(`/equipment/${id}/duplicate`, { method: 'POST' })
}

export async function retireAsset(id: string): Promise<EquipmentAsset> {
  return apiFetch<EquipmentAsset>(`/equipment/${id}/retire`, { method: 'POST' })
}

export async function deleteAsset(id: string): Promise<void> {
  return apiFetch<void>(`/equipment/${id}`, { method: 'DELETE' })
}

export async function fetchLayout(): Promise<GymLayoutConfig> {
  return apiFetch<GymLayoutConfig>('/gym-layout')
}

export async function saveLayout(body: Omit<GymLayoutConfig, 'gym_id'>): Promise<GymLayoutConfig> {
  return apiFetch<GymLayoutConfig>('/gym-layout', { method: 'PUT', body: JSON.stringify(body) })
}

export async function createCustomType(body: { name: string; category_id: string }): Promise<EquipmentType> {
  return apiFetch<EquipmentType>('/equipment-catalog/types', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function createCustomModel(body: unknown): Promise<unknown> {
  return apiFetch('/equipment-catalog/models/custom', { method: 'POST', body: JSON.stringify(body) })
}

export async function addMaintenanceTask(assetId: string, body: unknown): Promise<unknown> {
  return apiFetch(`/equipment/${assetId}/maintenance`, { method: 'POST', body: JSON.stringify(body) })
}

export async function applyRecommendations(assetId: string): Promise<{ created: number }> {
  return apiFetch<{ created: number }>(`/equipment/${assetId}/maintenance/apply-recommendations`, {
    method: 'POST',
  })
}

export async function completeMaintenance(assetId: string, taskId: string, body: unknown): Promise<unknown> {
  return apiFetch(`/equipment/${assetId}/maintenance/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateMaintenanceTask(assetId: string, taskId: string, body: unknown): Promise<unknown> {
  return apiFetch(`/equipment/${assetId}/maintenance/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteMaintenanceTask(assetId: string, taskId: string): Promise<void> {
  return apiFetch(`/equipment/${assetId}/maintenance/${taskId}`, { method: 'DELETE' })
}

export async function createIncident(assetId: string, body: unknown): Promise<IncidentItem> {
  return apiFetch<IncidentItem>(`/equipment/${assetId}/incidents`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateIncident(id: string, body: unknown): Promise<IncidentItem> {
  return apiFetch<IncidentItem>(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

export const ASSET_STATUS_META: Record<AssetStatus, { label: string; variant: string; dot: string }> = {
  operativo: { label: 'Operativo', variant: 'soft-success', dot: 'bg-success' },
  mantenimiento_proximo: { label: 'Mantenimiento próximo', variant: 'soft-warning', dot: 'bg-warning' },
  mantenimiento_vencido: { label: 'Mantenimiento vencido', variant: 'soft-destructive', dot: 'bg-destructive' },
  fuera_servicio: { label: 'Fuera de servicio', variant: 'soft-destructive', dot: 'bg-destructive' },
  retirado: { label: 'Retirado', variant: 'soft-secondary', dot: 'bg-muted-foreground' },
}

export const INCIDENT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'ruido_extraño', label: 'Ruido extraño' },
  { value: 'movimiento_irregular', label: 'Movimiento irregular' },
  { value: 'cable_desgastado', label: 'Cable desgastado' },
  { value: 'pieza_suelta', label: 'Pieza suelta' },
  { value: 'tapiceria_danada', label: 'Tapicería dañada' },
  { value: 'consola_pantalla', label: 'Consola / pantalla' },
  { value: 'no_funciona', label: 'No funciona' },
  { value: 'otro', label: 'Otro' },
]

export const TASK_TYPE_LABELS: Record<string, string> = {
  cleaning: 'Limpieza',
  inspection: 'Inspección',
  lubrication: 'Lubricación',
  adjustment: 'Ajuste',
  functional_test: 'Prueba funcional',
  electrical: 'Eléctrico',
  technical_service: 'Servicio técnico',
  replacement: 'Reemplazo',
}

export const TASK_STATUS_META: Record<string, { label: string; variant: string }> = {
  scheduled: { label: 'Programado', variant: 'soft-secondary' },
  due_soon: { label: 'Próximo', variant: 'soft-warning' },
  due: { label: 'Vence hoy', variant: 'soft-warning' },
  overdue: { label: 'Vencido', variant: 'soft-destructive' },
  completed: { label: 'Completado', variant: 'soft-success' },
  skipped: { label: 'Omitido', variant: 'soft-secondary' },
  disabled: { label: 'Deshabilitado', variant: 'soft-secondary' },
}

export const INCIDENT_PRIORITY_META: Record<string, { label: string; variant: string }> = {
  low: { label: 'Baja', variant: 'soft-secondary' },
  medium: { label: 'Media', variant: 'soft-warning' },
  high: { label: 'Alta', variant: 'soft-destructive' },
  critical: { label: 'Crítica', variant: 'soft-destructive' },
}

export const INCIDENT_STATUS_META: Record<string, { label: string; variant: string }> = {
  open: { label: 'Abierta', variant: 'soft-destructive' },
  in_progress: { label: 'En curso', variant: 'soft-warning' },
  resolved: { label: 'Resuelta', variant: 'soft-success' },
  closed: { label: 'Cerrada', variant: 'soft-secondary' },
}

export function fmtDuration(ms: number): string {
  if (ms < 0) return '0m'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

export function fmtDate(value?: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function defaultDimensions(typeName?: string | null): { w: number; d: number } {
  const t = (typeName ?? '').toLowerCase()
  if (t.includes('treadmill') || t.includes('rowing') || t.includes('ski')) return { w: 2.1, d: 0.9 }
  if (t.includes('bike') || t.includes('stepper') || t.includes('stair')) return { w: 0.65, d: 1.25 }
  if (t.includes('elliptical')) return { w: 1.1, d: 2.1 }
  if (t.includes('rack') || t.includes('smith') || t.includes('cage')) return { w: 1.5, d: 1.5 }
  if (t.includes('leg press') || t.includes('hack')) return { w: 1.8, d: 2.4 }
  if (t.includes('bench')) return { w: 0.55, d: 1.4 }
  if (t.includes('row')) return { w: 1.3, d: 1.7 }
  if (t.includes('pulldown') || t.includes('crossover') || t.includes('trainer') || t.includes('pec'))
    return { w: 1.6, d: 1.9 }
  return { w: 1.2, d: 1.2 }
}