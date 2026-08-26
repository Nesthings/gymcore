import { cn } from '@/lib/utils'

/**
 * RiskScoreRing: dona SVG del score de riesgo 0-100.
 * Colores semánticos: bajo → volt (primary), medio → ámbar, alto → rojo.
 * El número central usa fuente mono tabular para alineación consistente.
 */
export function RiskScoreRing({
  score,
  size = 44,
  stroke = 4,
  className,
}: {
  score: number
  size?: number
  stroke?: number
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  const color =
    clamped >= 70 ? 'stroke-destructive' : clamped >= 40 ? 'stroke-warning' : 'stroke-primary'

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      role="img"
      aria-label={`Riesgo ${clamped} de 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(color, 'transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]')}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold tabular-nums"
        style={{ fontSize: size / 4 }}
      >
        {clamped}
      </span>
    </div>
  )
}