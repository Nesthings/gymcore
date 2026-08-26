import { Dumbbell } from 'lucide-react'

import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-background px-4 py-12">
      {/* Aura volt/lime sutil de fondo (energía de gimnasio, sin ruido) */}
      <div
        className={cn(
          'pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full blur-3xl',
          isDark ? 'bg-lime-400/10' : 'bg-lime-400/15',
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          isDark ? 'bg-[radial-gradient(circle_at_50%_0%,transparent,var(--background)_70%)]' : '',
        )}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-card">
          <Dumbbell className="size-8 text-primary" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          GymCore
        </h1>
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
        <div className="mb-6">
          <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>

      {footer && <p className="relative text-sm text-muted-foreground">{footer}</p>}
    </div>
  )
}