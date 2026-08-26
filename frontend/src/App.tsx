import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { DashboardConfigProvider } from '@/lib/dashboard-config'
import { NavConfigProvider } from '@/lib/nav-config'
import { PermissionsProvider } from '@/lib/permissions'
import { SetupProvider } from '@/lib/setup'
import { GymMetaProvider } from '@/lib/gym-meta'

const CreateGym = lazy(() => import('@/pages/auth/CreateGym').then((m) => ({ default: m.CreateGym })))
const ForgotPassword = lazy(() =>
  import('@/pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })),
)
const GuestPass = lazy(() => import('@/pages/GuestPass').then((m) => ({ default: m.GuestPass })))
const Login = lazy(() => import('@/pages/auth/Login').then((m) => ({ default: m.Login })))
const ResetPassword = lazy(() =>
  import('@/pages/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })),
)
const Audit = lazy(() => import('@/pages/Audit').then((m) => ({ default: m.Audit })))
const Checkin = lazy(() => import('@/pages/Checkin').then((m) => ({ default: m.Checkin })))
const Configuracion = lazy(() =>
  import('@/pages/Configuracion').then((m) => ({ default: m.Configuracion })),
)
const Crm = lazy(() => import('@/pages/Crm').then((m) => ({ default: m.Crm })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const DesignSystem = lazy(() =>
  import('@/pages/DesignSystem').then((m) => ({ default: m.DesignSystem })),
)
const MemberDetail = lazy(() =>
  import('@/pages/MemberDetail').then((m) => ({ default: m.MemberDetail })),
)
const MemberPortal = lazy(() =>
  import('@/pages/MemberPortal').then((m) => ({ default: m.MemberPortal })),
)
const Members = lazy(() => import('@/pages/Members').then((m) => ({ default: m.Members })))
const Memberships = lazy(() =>
  import('@/pages/Memberships').then((m) => ({ default: m.Memberships })),
)
const Payments = lazy(() => import('@/pages/Payments').then((m) => ({ default: m.Payments })))
const Platform = lazy(() => import('@/pages/Platform').then((m) => ({ default: m.Platform })))
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })))
const Products = lazy(() => import('@/pages/Products').then((m) => ({ default: m.Products })))
const Riesgo = lazy(() => import('@/pages/Riesgo').then((m) => ({ default: m.Riesgo })))
const SetupWizard = lazy(() =>
  import('@/pages/SetupWizard').then((m) => ({ default: m.SetupWizard })),
)
const Sugerencias = lazy(() =>
  import('@/pages/Sugerencias').then((m) => ({ default: m.Sugerencias })),
)

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <div className="flex items-center gap-2 text-sm">
        <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Cargando…
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <PermissionsProvider>
          <SetupProvider>
            <GymMetaProvider>
              <NavConfigProvider>
                <DashboardConfigProvider>
                  <BrowserRouter>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/create-gym" element={<CreateGym />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/design-system" element={<DesignSystem />} />
                    <Route path="/m" element={<MemberPortal />} />
                    <Route path="/g" element={<GuestPass />} />

                    <Route
                      path="/platform"
                      element={
                        <ProtectedRoute roles={['super-admin']}>
                          <Platform />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/"
                      element={
                        <ProtectedRoute component="dashboard">
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/socios"
                      element={
                        <ProtectedRoute component="socios">
                          <Members />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/socios/:id"
                      element={
                        <ProtectedRoute component="socios">
                          <MemberDetail />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/membresias"
                      element={
                        <ProtectedRoute component="membresias">
                          <Memberships />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pagos"
                      element={
                        <ProtectedRoute component="finanzas">
                          <Payments />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/checkin"
                      element={
                        <ProtectedRoute component="checkin">
                          <Checkin />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/crm"
                      element={
                        <ProtectedRoute component="crm">
                          <Crm />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/productos"
                      element={
                        <ProtectedRoute component="productos">
                          <Products />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/riesgo"
                      element={
                        <ProtectedRoute component="inteligencia">
                          <Riesgo />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/configuracion"
                      element={
                        <ProtectedRoute roles={['admin']} component="configuracion">
                          <Configuracion />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/sugerencias"
                      element={
                        <ProtectedRoute roles={['admin']}>
                          <Sugerencias />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/auditoria"
                      element={
                        <ProtectedRoute component="auditoria">
                          <Audit />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/setup"
                      element={
                        <ProtectedRoute roles={['admin']}>
                          <SetupWizard />
                        </ProtectedRoute>
                      }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                  </Suspense>
                </BrowserRouter>
              </DashboardConfigProvider>
            </NavConfigProvider>
            </GymMetaProvider>
          </SetupProvider>
        </PermissionsProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App