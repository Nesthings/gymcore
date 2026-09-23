import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** ErrorBoundary global: evita pantallas en blanco ante errores de render y
 *  ofrece una salida visible con mensaje y recarga. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg
              className="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold">Ocurrió un error inesperado</h1>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Algo salió mal al mostrar esta pantalla. Puedes intentar recargar la página.
            </p>
            {this.state.error.message && (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {this.state.error.message.slice(0, 200)}
              </p>
            )}
          </div>
          <Button onClick={() => window.location.reload()}>Recargar página</Button>
        </div>
      )
    }
    return this.props.children
  }
}
