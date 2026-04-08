import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { DashboardBancos } from './pages/DashboardBancos'
import { CarteraInforme } from './pages/CarteraInforme'
import { AgenteChat } from './pages/AgenteChat'
import { useAuthStore } from './store/authStore'
import { getDashboardResumen } from './api/dashboard'

/** Attempts a silent token refresh on app mount using the httpOnly refresh cookie.
 *  On success: sets accessToken and pre-warms the dashboard cache so the first
 *  navigation to /dashboard is instant. */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setAccessToken, setInitialized } = useAuthStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    axios
      .post('/api/auth/refresh/', {}, { withCredentials: true })
      .then(({ data }) => {
        if (data?.access) {
          setAccessToken(data.access)
          // Pre-warm dashboard cache while user is still on the loading screen
          queryClient.prefetchQuery({
            queryKey: ['dashboard-resumen', undefined],
            queryFn: () => getDashboardResumen(),
          })
        }
      })
      .catch(() => {
        // No valid refresh cookie — user must log in
      })
      .finally(() => {
        setInitialized(true)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInitializer>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/bancos" element={<DashboardBancos />} />
            <Route path="/cartera" element={<CarteraInforme />} />
            <Route path="/agente" element={<AgenteChat />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthInitializer>
    </BrowserRouter>
  )
}
