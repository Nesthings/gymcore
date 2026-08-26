import { cn } from '@/lib/utils'

function initialsOf(name?: string | null, fallback = '?'): string {
  const source = (name ?? '').trim()
  if (!source) return fallback
  const parts = source.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || fallback
}

/**
 * Avatar: foto o iniciales en un círculo. `className` controla el tamaño
 * (ej. `size-9`, `size-12`). `ringColor` permite acento por sexo/módulo.
 */
function Avatar({
  src,
  name,
  alt,
  className,
  fallbackClassName,
}: {
  src?: string | null
  name?: string | null
  alt?: string
  className?: string
  fallbackClassName?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-secondary-foreground',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt ?? name ?? 'Avatar'} className="size-full object-cover" />
      ) : (
        <span className={cn('px-1', fallbackClassName)}>{initialsOf(name)}</span>
      )}
    </span>
  )
}

export { Avatar, initialsOf }
