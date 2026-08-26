import { createContext, useContext, useMemo, useState } from 'react'

import { decodeJwtPayload, getToken, setToken } from '@/lib/api'

export interface SessionUser {
  sub: string
  role: 'super-admin' | 'admin' | 'recepcion' | 'coach'
  gym_id?: string
  branch_id?: string
}

interface AuthContextValue {
  user: SessionUser | null
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function sessionFromToken(token: string | null): SessionUser | null {
  if (!token) return null
  const payload = decodeJwtPayload(token)
  if (!payload?.sub || !payload?.role) return null
  return {
    sub: String(payload.sub),
    role: payload.role as SessionUser['role'],
    gym_id: payload.gym_id ? String(payload.gym_id) : undefined,
    branch_id: payload.branch_id ? String(payload.branch_id) : undefined,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())

  const value = useMemo<AuthContextValue>(() => {
    return {
      user: sessionFromToken(token),
      isAuthenticated: Boolean(token),
      login: (newToken: string) => {
        setToken(newToken)
        setTokenState(newToken)
      },
      logout: () => {
        setToken(null)
        setTokenState(null)
      },
    }
  }, [token])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}