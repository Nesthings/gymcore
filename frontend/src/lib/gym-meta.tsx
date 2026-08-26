import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'

interface Branch {
  id: string
  name: string
}

interface GymMeta {
  name?: string
  logo_url?: string | null
}

interface GymMetaValue {
  photoUrl: string | null
  fullName: string | null
  gymName: string
  gymLogoUrl: string | null
  branches: Branch[]
  branchId: string
  setBranchId: (id: string) => void
  loading: boolean
  refresh: () => Promise<void>
}

const GymMetaContext = createContext<GymMetaValue | null>(null)

export function GymMetaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [gymName, setGymName] = useState('')
  const [gymLogoUrl, setGymLogoUrl] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState('')
  const [loading, setLoading] = useState(false)
  const branchStorageKey = `gymcore_branch_${user?.sub ?? 'guest'}`
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (!user?.gym_id) {
      setPhotoUrl(null)
      setFullName(null)
      setGymName('')
      setGymLogoUrl(null)
      setBranches([])
      setBranchId('')
      return
    }
    // Evita colapsar peticiones duplicadas del mismo tick.
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    try {
      const [me, gym, br] = await Promise.all([
        apiFetch<{ photo_url?: string | null; full_name?: string | null }>('/auth/me'),
        apiFetch<GymMeta>('/gyms/me'),
        apiFetch<Branch[]>('/branches'),
      ])
      setPhotoUrl(me.photo_url ?? null)
      setFullName(me.full_name ?? null)
      setGymName(gym.name ?? '')
      setGymLogoUrl(gym.logo_url ?? null)
      setBranches(br)
      setBranchId((prev) => {
        if (prev && br.some((b) => b.id === prev)) return prev
        try {
          const stored = localStorage.getItem(branchStorageKey)
          if (stored && br.some((b) => b.id === stored)) return stored
        } catch {
          // sin almacenamiento
        }
        return br[0]?.id ?? ''
      })
    } catch {
      // best-effort: el layout se queda con lo que haya
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }, [user?.gym_id, branchStorageKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    try {
      if (branchId) localStorage.setItem(branchStorageKey, branchId)
    } catch {
      // sin almacenamiento
    }
  }, [branchId, branchStorageKey])

  const value = useMemo<GymMetaValue>(
    () => ({
      photoUrl,
      fullName,
      gymName,
      gymLogoUrl,
      branches,
      branchId,
      setBranchId,
      loading,
      refresh,
    }),
    [photoUrl, fullName, gymName, gymLogoUrl, branches, branchId, loading, refresh],
  )

  return <GymMetaContext.Provider value={value}>{children}</GymMetaContext.Provider>
}

export function useGymMeta(): GymMetaValue {
  const ctx = useContext(GymMetaContext)
  if (!ctx) {
    throw new Error('useGymMeta debe usarse dentro de <GymMetaProvider>')
  }
  return ctx
}