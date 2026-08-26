import { createContext, useContext, useEffect, useState } from 'react'

import { useAuth } from '@/lib/auth'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// El tema se guarda POR USUARIO (última elección recordada). Sin sesión
// (login/signup) usa una clave genérica.
function themeKey(userId?: string): string {
  return userId ? `gymcore_theme:${userId}` : 'gymcore_theme'
}

function readStored(key: string): Theme {
  try {
    const stored = localStorage.getItem(key)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // sin almacenamiento
  }
  return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const key = themeKey(user?.sub)
  const [theme, setTheme] = useState<Theme>(() => readStored(key))

  // Al cambiar de usuario (login/logout) se carga el tema de ESE usuario.
  useEffect(() => {
    setTheme(readStored(key))
  }, [key])

  useEffect(() => {
    // El dark mode vive en el atributo `data-theme="dark"` del <html>.
    // NOTA: usar setAttribute (no toggleAttribute), que pondría el atributo
    // vacío (`data-theme=""`) y no matchearía el selector `[data-theme='dark']`.
    const el = document.documentElement
    if (theme === 'dark') {
      el.setAttribute('data-theme', 'dark')
    } else {
      el.removeAttribute('data-theme')
    }
    try {
      localStorage.setItem(key, theme)
    } catch {
      // ignorar
    }
  }, [theme, key])

  const value: ThemeContextValue = {
    theme,
    toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  }
  return ctx
}