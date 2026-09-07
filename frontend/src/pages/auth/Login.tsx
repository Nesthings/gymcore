import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Lock, LogIn, Mail, UserRound } from 'lucide-react'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OtpInput } from '@/components/ui/otp-input'
import { apiFetch, decodeJwtPayload } from '@/lib/api'
import { homeForRole } from '@/lib/nav'
import { useAuth } from '@/lib/auth'

interface LoginResponse {
  access_token: string
  role: string
}

interface TwoFactorRequiredResponse {
  requires_2fa: boolean
  challenge_token: string
}

export function Login() {
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Estado 2FA
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeSubmitting, setCodeSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await apiFetch<LoginResponse | TwoFactorRequiredResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: email.trim(), password }),
      })
      if ('requires_2fa' in res && res.requires_2fa) {
        setChallenge(res.challenge_token)
        setCode('')
        return
      }
      login((res as LoginResponse).access_token)
      const from = (location.state as { from?: { pathname: string } } | null)?.from
      const dest =
        from && from.pathname !== '/' ? from.pathname : homeForRole((res as LoginResponse).role)
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!challenge) return
    setCodeError(null)
    setCodeSubmitting(true)
    try {
      const res = await apiFetch<LoginResponse>('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ challenge_token: challenge, code: code.trim() }),
      })
      login(res.access_token)
      const payload = decodeJwtPayload(res.access_token)
      navigate(homeForRole(typeof payload?.role === 'string' ? payload.role : undefined), { replace: true })
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'El código de verificación es incorrecto')
    } finally {
      setCodeSubmitting(false)
    }
  }

  if (isAuthenticated) {
    return <Navigate to={homeForRole(user?.role)} replace />
  }

  if (challenge) {
    return (
      <AuthLayout
        title="Verificación en dos pasos"
        subtitle="Ingresa el código de 6 dígitos de tu aplicación de autenticación."
      >
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-2fa-code">Código de verificación</Label>
            <OtpInput
              value={code}
              onChange={(v) => setCode(v)}
              autoFocus
              disabled={codeSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Usa Microsoft Authenticator u otra app de autenticación para obtener el código.
            </p>
          </div>

          {codeError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{codeError}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={codeSubmitting}>
            {codeSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Verificando…
              </span>
            ) : (
              <>
                <LogIn /> Verificar
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setChallenge(null)
              setCode('')
              setCodeError(null)
            }}
            className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Volver al inicio de sesión
          </button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Ingresa con el correo y contraseña de tu cuenta; identificamos tu gimnasio y rol automáticamente."
      footer={
        <Link to="/forgot-password" className="font-medium text-primary hover:text-primary-hover">
          ¿Perdiste tu contraseña? Recupérala aquí
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              className="pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
              autoFocus
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">Contraseña</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              Entrando…
            </span>
          ) : (
            <>
              <LogIn /> Iniciar sesión
            </>
          )}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <UserRound className="size-3.5" aria-hidden="true" />
          Acceso para el personal del gimnasio y administradores de plataforma.
        </p>
      </form>
    </AuthLayout>
  )
}