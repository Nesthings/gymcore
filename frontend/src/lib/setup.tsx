import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export interface Me {
  sub: string
  role: string
  gym_id?: string | null
  branch_id?: string | null
  full_name?: string | null
  photo_url?: string | null
  setup_completed?: boolean | null
}

interface SetupContextValue {
  me: Me | null
  loading: boolean
  refresh: () => Promise<void>
}

const SetupContext = createContext<SetupContextValue | null>(null)

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setMe(null)
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch<Me>('/auth/me')
      setMe(res)
    } catch {
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo<SetupContextValue>(() => ({ me, loading, refresh }), [me, loading, refresh])

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>
}

export function useSetup(): SetupContextValue {
  const ctx = useContext(SetupContext)
  if (!ctx) {
    throw new Error('useSetup debe usarse dentro de <SetupProvider>')
  }
  return ctx
}