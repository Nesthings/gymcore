import { Badge } from '@/components/ui/badge'

type RiskVariant = 'soft-success' | 'soft-warning' | 'soft-destructive' | 'soft-secondary'

const RISK_CONFIG: Record<string, { label: string; variant: RiskVariant }> = {
  bajo: { label: 'Bajo', variant: 'soft-success' },
  medio: { label: 'Medio', variant: 'soft-warning' },
  alto: { label: 'Alto', variant: 'soft-destructive' },
  low: { label: 'Bajo', variant: 'soft-success' },
  medium: { label: 'Medio', variant: 'soft-warning' },
  high: { label: 'Alto', variant: 'soft-destructive' },
  none: { label: 'Sin riesgo', variant: 'soft-secondary' },
}

export function RiskBadge({
  level,
  className,
}: {
  level?: string | null
  className?: string
}) {
  if (!level) {
    return (
      <Badge variant="soft-secondary" className={className}>
        Sin riesgo
      </Badge>
    )
  }
  const cfg = RISK_CONFIG[level.toLowerCase()] ?? { label: level, variant: 'soft-secondary' }
  return (
    <Badge variant={cfg.variant} className={className}>
      {cfg.label}
    </Badge>
  )
}