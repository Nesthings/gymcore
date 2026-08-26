import * as React from 'react'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * ConfirmDialog: reemplaza window.confirm con una variante estilizada.
 * Uso: open, title, description, confirmLabel, variant ('destructive'|'success'|'default'),
 * onConfirm (async opcional), onCancel.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'destructive',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'success' | 'default'
  busy?: boolean
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}) {
  const confirmBtn =
    variant === 'destructive' ? 'destructive' : variant === 'success' ? 'success' : 'default'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div
            className={cn(
              'mb-2 flex size-10 items-center justify-center rounded-full',
              variant === 'destructive' && 'bg-destructive/10 text-destructive',
              variant === 'success' && 'bg-success/10 text-success',
              variant === 'default' && 'bg-primary/10 text-primary',
            )}
          >
            <TriangleAlert className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false)
              onCancel?.()
            }}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button variant={confirmBtn} onClick={onConfirm} disabled={busy}>
            {busy ? 'Procesando…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDialog }
