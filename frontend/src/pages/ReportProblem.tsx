import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  Loader2,
  Paperclip,
  Send,
  X,
} from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
import { PageHeader } from '@/components/ui/page-header'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/toast'

interface TicketAttachment {
  id: string
  file_type: string
  url: string
  created_at: string
}

interface Ticket {
  id: string
  subject: string
  description: string
  status: string
  resolution_notes?: string | null
  resolved_at?: string | null
  created_at: string
  attachments: TicketAttachment[]
}

const MAX_FILES = 5

export function ReportProblem() {
  const { toast } = useToast()
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [ticketsError, setTicketsError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const loadTickets = useCallback(async () => {
    setTicketsError(null)
    try {
      setTickets(await apiFetch<Ticket[]>('/support-tickets'))
    } catch (err) {
      setTicketsError(err instanceof Error ? err.message : 'No se pudieron cargar tus reportes')
    } finally {
      setTicketsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const onFiles = (list: FileList | null) => {
    if (!list) return
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
    const next = [...files]
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) break
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
      if (!allowed.includes(ext)) {
        toast({ title: 'Formato no permitido', description: `${f.name}: usa JPG, PNG, WebP o PDF.`, variant: 'error' })
        continue
      }
      if (f.size > 10 * 1024 * 1024) {
        toast({ title: 'Archivo demasiado grande', description: `${f.name} supera 10 MB.`, variant: 'error' })
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!subject.trim() || !description.trim()) {
      setError('Escribe un asunto y describe el problema.')
      return
    }
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('subject', subject.trim())
      form.append('description', description.trim())
      for (const f of files) form.append('files', f)
      await apiFetch('/support-tickets', { method: 'POST', body: form })
      toast({ title: 'Reporte enviado', description: 'El equipo de soporte lo revisará.', variant: 'success' })
      setSubject('')
      setDescription('')
      setFiles([])
      setDone(true)
      await loadTickets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el reporte')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setSubject('')
    setDescription('')
    setFiles([])
    setDone(false)
    setError(null)
  }

  return (
    <AppLayout>
      <PageHeader
        title="Reportar un problema"
        subtitle="Cuéntanos qué está fallando y el equipo de soporte lo revisará."
        icon={CircleHelp}
      />

      <div className="max-w-xl space-y-6">
        {done ? (
          <Card className="shadow-card">
            <CardContent
              role="status"
              className="flex flex-col items-center gap-3 py-10 text-center"
            >
              <CheckCircle2 className="size-12 text-success" aria-hidden="true" />
              <p className="text-lg font-semibold">¡Reporte enviado!</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Recibimos tu problema. Verás su estado aquí abajo, en "Mis reportes".
              </p>
              <Button type="button" variant="outline" onClick={reset}>
                Reportar otro problema
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleHelp className="size-5 text-primary" /> Describe el problema
              </CardTitle>
              <CardDescription>
                Incluye todo lo que nos ayude a reproducirlo: pasos, pantalla, mensajes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="report-subject">Asunto</Label>
                  <Input
                    id="report-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="ej. No puedo registrar un check-in"
                    maxLength={200}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="report-description">Cuerpo del mensaje</Label>
                  <Textarea
                    id="report-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe el problema con detalle…"
                    rows={6}
                    maxLength={5000}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="report-files">Archivos adjuntos</Label>
                  <input
                    id="report-files"
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      onFiles(e.target.files)
                      e.currentTarget.value = ''
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={files.length >= MAX_FILES}>
                    <label htmlFor="report-files" className="flex cursor-pointer items-center gap-2">
                      <Paperclip /> Agregar archivos ({files.length}/{MAX_FILES})
                    </label>
                  </Button>
                  {files.length > 0 && (
                    <ul className="space-y-1">
                      {files.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-sm"
                        >
                          <span className="min-w-0 truncate">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                            aria-label={`Quitar ${f.name}`}
                          >
                            <X className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Imágenes (JPG/PNG/WebP) o PDF · máx. 10 MB por archivo.
                  </p>
                </div>

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="animate-spin" /> : <Send />}
                  Enviar reporte
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="size-5 text-primary" /> Mis reportes
            </CardTitle>
            <CardDescription>Tus problemas reportados y su estado de atención.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ticketsError && (
              <ErrorState description={ticketsError} onRetry={loadTickets} />
            )}
            {ticketsLoading ? (
              <LoadingState label="Cargando tus reportes…" />
            ) : tickets.length === 0 ? (
              <EmptyState
                title="Sin reportes"
                description="Usa el formulario de arriba para enviar el primero."
                icon={CircleHelp}
              />
            ) : (
              tickets.map((t) => {
                const open = openId === t.id
                const resolved = t.status === 'resolved'
                return (
                  <div key={t.id} className="rounded-lg border border-border/60 bg-muted/30">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`ticket-panel-${t.id}`}
                      onClick={() => setOpenId(open ? null : t.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          Enviado el {new Date(t.created_at).toLocaleString('es-MX')}
                          {t.attachments.length > 0 ? ` · ${t.attachments.length} adjunto(s)` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={resolved ? 'soft-success' : 'soft-warning'}>
                          {resolved ? 'Resuelto' : 'En revisión'}
                        </Badge>
                        {open ? (
                          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                        )}
                      </div>
                    </button>

                    {open && (
                      <div
                        id={`ticket-panel-${t.id}`}
                        className="space-y-3 border-t border-border/60 px-3 py-3"
                      >
                        <p className="whitespace-pre-wrap text-sm text-foreground/90">
                          {t.description}
                        </p>

                        {t.resolution_notes && (
                          <div className="rounded-md border border-success/30 bg-success/5 p-3">
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-success">
                              Respuesta del soporte
                            </p>
                            <p className="whitespace-pre-wrap text-sm">{t.resolution_notes}</p>
                          </div>
                        )}

                        {t.attachments.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Adjuntos ({t.attachments.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {t.attachments.map((a) =>
                                a.file_type === 'image' ? (
                                  <a
                                    key={a.id}
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block size-16 overflow-hidden rounded-md border border-border"
                                    title="Ver imagen"
                                  >
                                    <img src={a.url} alt="Adjunto del reporte" className="size-full object-cover" />
                                  </a>
                                ) : (
                                  <a
                                    key={a.id}
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                  >
                                    <FileText className="size-3.5" /> Ver PDF
                                  </a>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                        {resolved && t.resolved_at && (
                          <p className="text-xs text-muted-foreground">
                            Resuelto el {new Date(t.resolved_at).toLocaleString('es-MX')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}