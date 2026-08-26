import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Loader2, MailCheck } from 'lucide-react'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

interface ForgotResponse {
  message: string
  reset_token?: string
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [devToken, setDevToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await apiFetch<ForgotResponse>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(res.message)
      setDevToken(res.reset_token ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al solicitar la recuperación')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace para restablecerla"
      footer={
        <Link to="/login" className="font-medium text-primary hover:text-primary-hover">
          Volver a iniciar sesión
        </Link>
      }
    >
      {message ? (
        <div className="space-y-4 text-center">
          <MailCheck className="mx-auto size-10 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{message}</p>
          {devToken && (
            <div className="rounded-md border border-border bg-secondary p-3 text-left text-xs">
              <p className="mb-1 font-semibold text-secondary-foreground">
                Token de reset (solo dev):
              </p>
              <code className="break-all text-secondary-foreground">{devToken}</code>
              <p className="mt-2 text-muted-foreground">
                Abre{' '}
                <Link
                  to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                  className="font-medium text-primary"
                >
                  este enlace
                </Link>{' '}
                para probar el flujo.
              </p>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo de tu cuenta</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Enviando…
              </>
            ) : (
              'Enviar enlace'
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
