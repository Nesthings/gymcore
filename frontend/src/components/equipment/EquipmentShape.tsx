import { useId } from 'react'

import type { AssetStatus } from '@/lib/equipment'

const STATUS_META: Record<AssetStatus, { fill: string; stroke: string; dash?: boolean }> = {
  operativo: { fill: 'var(--primary)', stroke: 'var(--primary-hover)' },
  mantenimiento_proximo: { fill: 'var(--warning)', stroke: '#d4a72f' },
  mantenimiento_vencido: { fill: 'var(--destructive)', stroke: '#ff5c5c' },
  fuera_servicio: { fill: 'var(--destructive)', stroke: '#7f1d1d', dash: true },
  retirado: { fill: 'var(--muted-foreground)', stroke: '#6b7280', dash: true },
}

/**
 * Siluetas top-down (vista superior) de los equipos sobre el plano.
 * Cada silueta se dibuja en un viewBox 0..100 y el contenedor la escala al
 * footprint real (width_m × depth_m). La rotación la aplica el contenedor.
 *
 * Mejoras: sombra suave, degradado por estado, siluetas con detalle por tipo,
 * huella/base tenue y estados claros (× fuera de servicio, atenuado retirado).
 */
export function EquipmentShape({
  typeName,
  categoryName,
  status,
}: {
  typeName?: string | null
  categoryName?: string | null
  status: AssetStatus
}) {
  const t = (typeName ?? '').toLowerCase()
  const c = (categoryName ?? '').toLowerCase()
  const meta = STATUS_META[status]
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradientId = `eg-${uid}`
  const shadowId = `es-${uid}`
  const dimmed = status === 'retirado'
  const outOfService = status === 'fuera_servicio'

  const paint = {
    fill: `url(#${gradientId})`,
    stroke: meta.stroke,
    strokeWidth: 2.5,
    strokeDasharray: meta.dash ? '5 4' : undefined,
  }
  const detail = {
    fill: 'color-mix(in srgb, var(--muted-foreground) 22%, transparent)',
    stroke: meta.stroke,
    strokeWidth: 1.5,
    strokeOpacity: 0.6,
    strokeDasharray: meta.dash ? '4 3' : undefined,
  }
  const solid = { fill: meta.stroke, stroke: 'none' }

  let body: React.ReactNode

  if (t.includes('treadmill') || t.includes('rowing') || t.includes('ski')) {
    body = (
      <>
        <rect x={6} y={32} width={88} height={34} rx={17} {...paint} />
        <rect x={14} y={45} width={72} height={7} rx={3.5} {...detail} />
        <rect x={10} y={6} width={80} height={18} rx={7} {...paint} />
        <rect x={20} y={10} width={34} height={10} rx={2} {...solid} opacity={0.7} />
        <rect x={40} y={22} width={20} height={8} rx={4} {...paint} />
      </>
    )
  } else if (t.includes('bike') || t.includes('stepper') || t.includes('stair')) {
    body = (
      <>
        <circle cx={50} cy={22} r={11} {...paint} />
        <circle cx={50} cy={78} r={8} {...paint} />
        <rect x={42} y={26} width={16} height={54} rx={8} {...paint} />
        <rect x={28} y={6} width={44} height={10} rx={5} {...paint} />
        <rect x={44} y={12} width={12} height={10} rx={4} {...solid} opacity={0.7} />
      </>
    )
  } else if (t.includes('elliptical')) {
    body = (
      <>
        <rect x={6} y={14} width={88} height={12} rx={6} {...paint} />
        <rect x={12} y={74} width={76} height={12} rx={6} {...paint} />
        <rect x={30} y={4} width={40} height={12} rx={5} {...paint} />
        <rect x={46} y={30} width={8} height={40} rx={3} {...paint} />
        <circle cx={22} cy={46} r={7} {...paint} />
        <circle cx={78} cy={46} r={7} {...paint} />
      </>
    )
  } else if (t.includes('rack') || t.includes('smith') || t.includes('cage')) {
    body = (
      <>
        <rect x={12} y={12} width={76} height={76} rx={8} {...paint} />
        <rect x={12} y={12} width={11} height={11} rx={2} {...solid} />
        <rect x={77} y={12} width={11} height={11} rx={2} {...solid} />
        <rect x={12} y={77} width={11} height={11} rx={2} {...solid} />
        <rect x={77} y={77} width={11} height={11} rx={2} {...solid} />
        <rect x={22} y={46} width={56} height={7} rx={3.5} {...paint} />
        <rect x={28} y={24} width={44} height={5} rx={2.5} {...detail} />
        <circle cx={15} cy={48} r={3} {...solid} />
        <circle cx={85} cy={48} r={3} {...solid} />
      </>
    )
  } else if (t.includes('leg press') || t.includes('hack')) {
    body = (
      <>
        <polygon points="24,14 76,10 88,86 30,90" {...paint} />
        <rect x={14} y={36} width={20} height={30} rx={7} {...paint} />
        <rect x={30} y={50} width={44} height={8} rx={4} {...paint} />
        <circle cx={72} cy={26} r={6} {...paint} />
        <rect x={34} y={60} width={34} height={6} rx={3} {...detail} />
      </>
    )
  } else if (t.includes('bench')) {
    body = (
      <>
        <rect x={16} y={32} width={68} height={26} rx={10} {...paint} />
        <rect x={22} y={60} width={16} height={18} rx={5} {...paint} />
        <rect x={62} y={60} width={16} height={18} rx={5} {...paint} />
        <rect x={24} y={38} width={20} height={14} rx={6} {...detail} />
      </>
    )
  } else if (t.includes('pulldown') || t.includes('crossover') || t.includes('trainer') || t.includes('pec')) {
    body = (
      <>
        <rect x={8} y={4} width={84} height={10} rx={5} {...paint} />
        <rect x={6} y={8} width={16} height={84} rx={5} {...paint} />
        <rect x={78} y={8} width={16} height={84} rx={5} {...paint} />
        <rect x={26} y={48} width={48} height={14} rx={6} {...paint} />
        <circle cx={14} cy={20} r={4} {...solid} />
        <circle cx={86} cy={20} r={4} {...solid} />
        <circle cx={14} cy={78} r={4} {...solid} />
        <circle cx={86} cy={78} r={4} {...solid} />
      </>
    )
  } else if (t.includes('dumbbell') || t.includes('plate') || t.includes('barbell')) {
    body = (
      <>
        <polygon points="28,20 72,20 84,80 16,80" {...paint} />
        <rect x={24} y={34} width={52} height={7} rx={3.5} {...detail} />
        <rect x={20} y={52} width={60} height={7} rx={3.5} {...detail} />
        <circle cx={50} cy={66} r={8} {...paint} />
      </>
    )
  } else if (t.includes('sled')) {
    body = (
      <>
        <polygon points="22,22 80,20 88,72 26,80" {...paint} />
        <circle cx={36} cy={46} r={8} {...paint} />
        <rect x={46} y={40} width={30} height={10} rx={5} {...detail} />
      </>
    )
  } else if (t.includes('plyo') || t.includes('box')) {
    body = (
      <>
        <rect x={20} y={20} width={60} height={60} rx={8} {...paint} />
        <rect x={20} y={20} width={60} height={16} rx={6} {...detail} />
        <rect x={40} y={40} width={20} height={20} rx={4} {...solid} opacity={0.5} />
      </>
    )
  } else if (c.includes('cardio')) {
    body = (
      <>
        <rect x={6} y={30} width={88} height={40} rx={16} {...paint} />
        <rect x={30} y={8} width={40} height={14} rx={5} {...paint} />
        <rect x={36} y={12} width={28} height={6} rx={3} {...solid} opacity={0.7} />
      </>
    )
  } else if (c.includes('free')) {
    body = (
      <>
        <rect x={16} y={16} width={68} height={68} rx={8} {...paint} />
        <rect x={34} y={34} width={32} height={32} rx={6} {...detail} />
        <rect x={16} y={16} width={10} height={10} rx={2} {...solid} />
        <rect x={74} y={74} width={10} height={10} rx={2} {...solid} />
      </>
    )
  } else if (c.includes('functional')) {
    body = (
      <>
        <circle cx={34} cy={34} r={12} {...paint} />
        <circle cx={66} cy={66} r={12} {...paint} />
        <rect x={20} y={56} width={60} height={10} rx={5} {...paint} />
      </>
    )
  } else {
    body = <rect x={18} y={18} width={64} height={64} rx={12} {...paint} />
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      className="block"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={meta.fill} stopOpacity={0.55} />
          <stop offset="100%" stopColor={meta.fill} stopOpacity={0.16} />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.8" floodColor="#000000" floodOpacity="0.28" />
        </filter>
      </defs>

      {/* Huella/base tenue para que la máquina se lea como objeto del plano */}
      <rect
        x={3}
        y={3}
        width={94}
        height={94}
        rx={16}
        fill="color-mix(in srgb, var(--muted-foreground) 9%, transparent)"
        stroke="none"
      />

      <g filter={`url(#${shadowId})`} opacity={dimmed ? 0.55 : 1}>
        {body}
        {outOfService && (
          <g stroke="var(--destructive)" strokeWidth={5} strokeLinecap="round" opacity={0.85}>
            <line x1={24} y1={24} x2={76} y2={76} />
            <line x1={76} y1={24} x2={24} y2={76} />
          </g>
        )}
      </g>
    </svg>
  )
}