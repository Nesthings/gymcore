import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import { MODULE_META, NAV_ROUTES } from '@/lib/nav'
import { useNavConfig } from '@/lib/nav-config'

/**
 * Drag & drop de módulos por Pointer Events (mouse y táctil).
 *
 * No usa el DnD nativo de HTML5 (poco fiable) — detecta el arrastre con
 * `pointerdown` + `pointermove` y resuelve el drop con `elementFromPoint` sobre
 * las zonas marcadas con `[data-drop-zone]`:
 *   - `sidebar` → fija el módulo en la barra
 *   - `modules` → lo quita de la barra (vuelve a Inicio)
 */

const DRAG_THRESHOLD = 6

interface ModuleDnDValue {
  dragging: string | null
  start: (component: string, e: React.PointerEvent) => void
  /** Devuelve true una vez si el último gesto fue un arrastre (para no navegar). */
  consumeDragClick: () => boolean
}

const ModuleDnDContext = createContext<ModuleDnDValue | null>(null)

export function ModuleDnDProvider({ children }: { children: React.ReactNode }) {
  const { pin, unpin } = useNavConfig()
  const [dragging, setDragging] = useState<string | null>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const pendingRef = useRef<{ component: string; x: number; y: number } | null>(null)
  const activeRef = useRef<string | null>(null)
  const dragHappenedRef = useRef(false)

  const start = useCallback((component: string, e: React.PointerEvent) => {
    // Solo botón primario (mouse) o touch/pen.
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragHappenedRef.current = false
    pendingRef.current = { component, x: e.clientX, y: e.clientY }
  }, [])

  const consumeDragClick = useCallback(() => {
    if (dragHappenedRef.current) {
      dragHappenedRef.current = false
      return true
    }
    return false
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = pendingRef.current
      if (!p) return
      if (activeRef.current === null) {
        const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y)
        if (dist < DRAG_THRESHOLD) return
        activeRef.current = p.component
        setDragging(p.component)
      }
      e.preventDefault()
      setPos({ x: e.clientX, y: e.clientY })
    }

    const finish = (e: PointerEvent) => {
      const p = pendingRef.current
      pendingRef.current = null
      if (activeRef.current === null) {
        void p
        return
      }
      const component = activeRef.current
      activeRef.current = null
      dragHappenedRef.current = true
      setDragging(null)
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const zone = el?.closest('[data-drop-zone]')?.getAttribute('data-drop-zone')
      if (zone === 'sidebar') pin(component)
      else if (zone === 'modules') unpin(component)
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [pin, unpin])

  const meta = dragging ? MODULE_META[dragging] : undefined
  const label = dragging
    ? NAV_ROUTES.find((r) => r.component === dragging)?.label ?? dragging
    : ''

  return (
    <ModuleDnDContext.Provider value={{ dragging, start, consumeDragClick }}>
      {children}
      {dragging && (
        <div
          className="pointer-events-none fixed z-[200] flex items-center gap-2 rounded-lg border border-primary/40 bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-dialog"
          style={{ left: pos.x + 14, top: pos.y + 14 }}
        >
          {meta?.icon && <meta.icon className="size-4 text-primary" aria-hidden="true" />}
          {label}
        </div>
      )}
    </ModuleDnDContext.Provider>
  )
}

export function useModuleDnD(): ModuleDnDValue {
  const ctx = useContext(ModuleDnDContext)
  if (!ctx) throw new Error('useModuleDnD debe usarse dentro de <ModuleDnDProvider>')
  return ctx
}