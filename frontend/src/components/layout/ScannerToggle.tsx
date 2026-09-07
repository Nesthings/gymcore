import { useState } from 'react'
import { Loader2, QrCode } from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useScanner } from '@/lib/scanner'
import { cn } from '@/lib/utils'

/**
 * ScannerToggle: botón de la barra superior para activar/desactivar el lector
 * QR continuo. Al desactivarlo pide confirmación para evitar apagados por error.
 */
export function ScannerToggle() {
  const { enabled, activating, enable, disable } = useScanner()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (enabled) {
            setConfirmOpen(true)
          } else {
            void enable()
          }
        }}
        disabled={activating}
        title={enabled ? 'Desactivar lector QR' : 'Activar lector QR continuo'}
        aria-label={enabled ? 'Lector QR activo: desactivar' : 'Activar lector QR continuo'}
        aria-pressed={enabled}
        className={cn(
          'relative flex size-9 items-center justify-center rounded-lg border shadow-card transition-colors active:scale-[0.98]',
          enabled
            ? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25'
            : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        {activating ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <QrCode className="size-4" aria-hidden="true" />
        )}
        {enabled && (
          <span className="absolute -right-0.5 -top-0.5 flex size-2.5" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-success" />
          </span>
        )}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Desactivar el lector QR?"
        description="Los socios dejarán de poder registrarse por cámara hasta que lo vuelvas a activar. El buscador manual seguirá disponible."
        confirmLabel="Desactivar"
        variant="destructive"
        onConfirm={() => {
          setConfirmOpen(false)
          disable()
        }}
      />
    </>
  )
}