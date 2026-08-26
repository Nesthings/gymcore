import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { DashboardConfigProvider } from '@/lib/dashboard-config'
import { NavConfigProvider } from '@/lib/nav-config'
import { PermissionsProvider } from '@/lib/permissions'
import { SetupProvider } from '@/lib/setup'
import { CreateGym } from '@/pages/auth/CreateGym'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { Login } from '@/pages/auth/Login'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { Audit } from '@/pages/Audit'
import { Checkin } from '@/pages/Checkin'
import { Configuracion } from '@/pages/Configuracion'
import { Crm } from '@/pages/Crm'
import { Dashboard } from '@/pages/Dashboard'
import { DesignSystem } from '@/pages/DesignSystem'
import { MemberDetail } from '@/pages/MemberDetail'
import { MemberPortal } from '@/pages/MemberPortal'
import { Members } from '@/pages/Members'
import { Memberships } from '@/pages/Memberships'
import { Payments } from '@/pages/Payments'
import { Platform } from '@/pages/Platform'
import { Profile } from '@/pages/Profile'
import { Riesgo } from '@/pages/Riesgo'
import { SetupWizard } from '@/pages/SetupWizard'

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <PermissionsProvider>
          <SetupProvider>
            <NavConfigProvider>
              <DashboardConfigProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/create-gym" element={<CreateGym />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/design-system" element={<DesignSystem />} />
                    <Route path="/m" element={<MemberPortal />} />

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
                </BrowserRouter>
              </DashboardConfigProvider>
            </NavConfigProvider>
          </SetupProvider>
        </PermissionsProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App