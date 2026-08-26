import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Building2, Dumbbell, Loader2 } from 'lucide-react'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'

interface LoginResponse {
  access_token: string
}

export function CreateGym() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { login } = useAuth()
  const navigate = useNavigate()

  const [gymName, setGymName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError('Falta el enlace de invitación.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await apiFetch<LoginResponse>('/create-gym', {
        method: 'POST',
        body: JSON.stringify({
          invite_token: token,
          name: gymName,
          admin_name: fullName,
          admin_email: email,
          admin_password: password,
        }),
      })
      login(res.access_token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el gimnasio')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Crear mi gimnasio" subtitle="Bienvenido, configura tu gimnasio y tu acceso">
      {!token ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Falta el enlace de invitación.</span>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cg-name">Nombre del gimnasio *</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cg-name"
                className="pl-9"
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder="ej. IronHouse Fitness"
                required
              />
            </div>
          </div>

          <div className="rounded-md border border-border p-4">
            <div className="mb-1 flex items-center gap-2">
              <Dumbbell className="size-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-medium">Primer administrador (tú)</p>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              El administrador tiene acceso a todo: configura el gimnasio, agrega sucursales y
              equipo, y gestiona socios, membresías, pagos y check-in.
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cg-fullname">Nombre completo *</Label>
                <Input
                  id="cg-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cg-email">Correo *</Label>
                <Input
                  id="cg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cg-password">Contraseña *</Label>
                <Input
                  id="cg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {submitting ? 'Creando…' : 'Crear gimnasio y entrar'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}