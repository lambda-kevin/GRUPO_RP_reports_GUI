import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Wallet, Building2, MessageSquare,
  LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useAuth } from '../../hooks/useAuth'
import { logout as logoutApi } from '../../api/auth'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Panel Ejecutivo', icon: LayoutDashboard },
  { to: '/cartera',   label: 'Cartera',         icon: Wallet          },
  { to: '/bancos',    label: 'Bancos',           icon: Building2       },
  { to: '/agente',    label: 'Centro de Mando',  icon: MessageSquare   },
]

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const logoSources = ['/dist/assets/grupo-rp-noback.png', '/assets/grupo-rp-noback.png']
  const [logoIndex, setLogoIndex] = useState(0)
  const { user } = useAuth()
  const { logout: storeLogout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await logoutApi() } catch { /* ignore */ }
    storeLogout()
    navigate('/login', { replace: true })
  }

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?'

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen z-30 flex flex-col
        bg-primary-950 text-white
        transition-all duration-200 ease-in-out
        ${collapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* ── Logo + toggle ── */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-primary-800">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary-700/40 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src={logoSources[logoIndex]}
                alt="Logo Grupo RP"
                className="h-6 w-6 object-contain"
                onError={() => {
                  if (logoIndex < logoSources.length - 1) setLogoIndex(logoIndex + 1)
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-none truncate">Grupo RP</p>
              <p className="text-xs text-primary-300 leading-tight truncate">Maestro de reportes</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto h-8 w-8 rounded-lg bg-primary-700/40 flex items-center justify-center overflow-hidden">
            <img
              src={logoSources[logoIndex]}
              alt="Logo Grupo RP"
              className="h-6 w-6 object-contain"
              onError={() => {
                if (logoIndex < logoSources.length - 1) setLogoIndex(logoIndex + 1)
              }}
            />
          </div>
        )}
        <button
          onClick={onToggle}
          className={`
            shrink-0 p-1.5 rounded-lg text-primary-400 hover:text-white hover:bg-primary-800
            transition-colors
            ${collapsed ? 'mx-auto mt-2' : ''}
          `}
          title={collapsed ? 'Expandir' : 'Contraer'}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <ChevronLeft className="h-4 w-4" />
          }
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-bold text-primary-300 uppercase tracking-widest">
            Panel Ejecutivo
          </p>
        )}

        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium min-h-touch
              transition-colors group
              ${isActive
                ? 'bg-primary-600 text-white'
                : 'text-primary-300 hover:bg-primary-800 hover:text-white'
              }
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? label : undefined}
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-primary-400 group-hover:text-white'}`} />
                {!collapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── User + logout ── */}
      <div className="border-t border-primary-800 px-2 py-3">
        <div className={`flex items-center gap-3 px-2 py-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.username ?? '—'}</p>
              {user?.rol && (
                <p className="text-xs text-primary-300 truncate">{user.rol}</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className={`
            mt-1 w-full flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium min-h-touch
            text-primary-300 hover:text-white hover:bg-primary-800
            transition-colors
            ${collapsed ? 'justify-center' : ''}
          `}
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Cerrar sesion</span>}
        </button>
      </div>
    </aside>
  )
}
