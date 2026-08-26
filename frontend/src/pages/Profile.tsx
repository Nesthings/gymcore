import { useCallback, useEffect, useState } from 'react'
import { Camera, Loader2, Save, UserRound } from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'

interface Me {
  id: string
  full_name: string
  email: string
  role: string
  phone?: string | null
  branch_name?: string | null
  photo_url?: string | null
  job_title?: string | null
  description?: string | null
}

export function Profile() {
  const [me, setMe] = useState<Me | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [description, setDescription] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<Me>('/users/me')
      setMe(res)
      setFullName(res.full_name)
      setPhone(res.phone ?? '')
      setJobTitle(res.job_title ?? '')
      setDescription(res.description ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu perfil')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const uploadPhoto = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await apiFetch(`/users/${me?.id}/photo`, { method: 'POST', body: form })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la foto')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        full_name: fullName,
        phone: phone || null,
        job_title: jobTitle || null,
        description: description || null,
      }
      if (newPassword) {
        body.current_password = currentPassword
        body.new_password = newPassword
      }
      await apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify(body) })
      setCurrentPassword('')
      setNewPassword('')
      setSuccess(true)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">Tu cuenta de staff del gimnasio</p>
      </div>

      <div className="max-w-lg space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Datos de la cuenta</CardTitle>
            <CardDescription>
              {me?.email} · {me?.role} {me?.branch_name ? `· ${me.branch_name}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-secondary">
                  {me?.photo_url ? (
                    <img
                      src={me.photo_url}
                      alt="Foto de perfil"
                      className="size-full object-cover"
                    />
                  ) : (
                    <UserRound className="size-full p-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    id="profile-photo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadPhoto(f)
                      e.currentTarget.value = ''
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={uploading}>
                    <label
                      htmlFor="profile-photo"
                      className="flex cursor-pointer items-center gap-2"
                    >
                      {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
                      {me?.photo_url ? 'Cambiar foto' : 'Subir foto'}
                    </label>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    JPEG/PNG · máx. 5 MB · se limpian metadatos
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nombre completo</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cargo / puesto</Label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="ej. Coach de fuerza"
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve presentación profesional…"
                  rows={3}
                />
              </div>

              <div className="rounded-md border border-border p-4">
                <p className="mb-3 text-sm font-medium">Cambiar contraseña</p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Contraseña actual</Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nueva contraseña (mín. 8)</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-success">Perfil actualizado correctamente.</p>}

              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <Save />} Guardar cambios
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}