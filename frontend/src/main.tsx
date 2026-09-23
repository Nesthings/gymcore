import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Toaster } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Toaster>
        <App />
      </Toaster>
    </ErrorBoundary>
  </StrictMode>,
)
