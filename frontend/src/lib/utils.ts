import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Moneda en formato MXN (es-MX). `decimals` controla los centavos (0 por
// defecto para agregados; 2 para importes de transacción).
export function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

// Número compacto (es-MX): 1.2k, 12.5k, 1.4M…
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

// Fecha y hora en español (es-MX).
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}