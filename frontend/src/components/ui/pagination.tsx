import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Pagination: paginación de cliente para listados. Oculta los controles si
 * solo hay una página.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (pageCount <= 1) return null
  return (
    <div
      className={cn(
        'mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground',
        className,
      )}
    >
      <span>
        Página <span className="font-medium text-foreground">{page}</span> de {pageCount}
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}

/**
 * Pagina un arreglo en memoria y devuelve la rebanada de la página actual.
 */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function pageCountFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}
