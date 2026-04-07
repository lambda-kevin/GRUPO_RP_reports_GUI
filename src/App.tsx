import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Bancos } from './pages/Bancos'
import { CarteraInforme } from './pages/CarteraInforme'
import { Pedidos } from './pages/Pedidos'
import { AgenteChat } from './pages/AgenteChat'

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="/bancos" element={<Bancos />} />
          <Route path="/cartera" element={<CarteraInforme />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/agente" element={<AgenteChat />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
