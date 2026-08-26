import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={toggle}
      className={cn(
        'flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200',
        isDark ? 'border-primary/40 bg-primary/25' : 'border-border bg-secondary',
      )}
    >
      <span
        className={cn(
          'flex size-5 items-center justify-center rounded-full bg-card text-primary shadow-sm transition-transform duration-200',
          isDark ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      >
        {isDark ? <Moon className="size-3" /> : <Sun className="size-3" />}
      </span>
    </button>
  )
}
