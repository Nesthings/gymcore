import { CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success'

export interface SmartAlertItem {
  id: string
  rule_key: string
  severity: AlertSeverity
  title: string
  description: string
  member_name?: string | null
  member_id: string
  triggered_at: string
  link: string
  metadata?: Record<string, unknown>
}

export interface SmartAlertsData {
  summary: {
    critical: number
    warning: number
    info: number
    success: number
    total: number
  }
  items: SmartAlertItem[]
}

export const EMPTY_ALERTS: SmartAlertsData = {
  summary: { critical: 0, warning: 0, info: 0, success: 0, total: 0 },
  items: [],
}

export const SEVERITY_META: Record<
  AlertSeverity,
  {
    label: string
    icon: LucideIcon
    badge: 'destructive' | 'warning' | 'info' | 'success'
    dot: string
    text: string
  }
> = {
  critical: {
    label: 'Críticos',
    icon: CircleAlert,
    badge: 'destructive',
    dot: 'bg-destructive',
    text: 'text-destructive',
  },
  warning: {
    label: 'Importantes',
    icon: TriangleAlert,
    badge: 'warning',
    dot: 'bg-warning',
    text: 'text-warning',
  },
  info: {
    label: 'Informativos',
    icon: Info,
    badge: 'info',
    dot: 'bg-info',
    text: 'text-info',
  },
  success: {
    label: 'Resueltos',
    icon: CheckCircle2,
    badge: 'success',
    dot: 'bg-success',
    text: 'text-success',
  },
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}