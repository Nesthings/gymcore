import * as React from 'react'
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  title: string
  description?: string
  variant: ToastVariant
  duration: number
}

interface ToastApi {
  toast: (input: {
    title: string
    description?: string
    variant?: ToastVariant
    duration?: number
  }) => void
}

const ToastContext = React.createContext<ToastApi | null>(null)

function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <Toaster>')
  return ctx
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="size-5" aria-hidden="true" />,
  error: <XCircle className="size-5" aria-hidden="true" />,
  info: <Info className="size-5" aria-hidden="true" />,
  warning: <TriangleAlert className="size-5" aria-hidden="true" />,
}

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-info',
  warning: 'text-warning',
}

let counter = 0

function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const dismiss = React.useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback<ToastApi['toast']>(
    ({ title, description, variant = 'info', duration = 4000 }) => {
      const id = ++counter
      setToasts((list) => [...list.slice(-3), { id, title, description, variant, duration }])
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration)
      }
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 shadow-dialog animate-in slide-in-from-bottom-4 fade-in-0"
            role="status"
          >
            <span className={cn('mt-0.5 shrink-0', ICON_STYLES[t.variant])}>
              {ICONS[t.variant]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar notificación"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export { Toaster, useToast }
