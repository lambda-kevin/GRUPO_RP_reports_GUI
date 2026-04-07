import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Wallet,
  ClipboardList,
  MessageSquare,
  LogOut,
  Activity,
  ChevronRight,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'

const navItems: Array<{ to: string; icon: typeof Wallet; label: string; highlight?: boolean }> = [
  { to: '/cartera', icon: Wallet, label: 'Cartera', highlight: true },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Panel Ejecutivo' },
  { to: '/bancos', icon: Building2, label: 'Bancos' },
  { to: '/pedidos', icon: ClipboardList, label: 'Pedidos' },
  { to: '/agente', icon: MessageSquare, label: 'Asistente IA' },
]

export const Sidebar = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await apiLogout()
    } finally {
      logout()
      navigate('/login')
    }
  }

  return (
    <aside className="w-64 bg-primary-950 text-white flex flex-col h-screen fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="p-5 border-b border-primary-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">Grupo RP</div>
            <div className="text-primary-400 text-xs">Sistema Operativo</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-primary-400 text-[11px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1">
          Panel Ejecutivo
        </div>
        {navItems.map(({ to, icon: Icon, label, highlight }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 rounded-lg font-medium transition-colors group',
                highlight ? 'py-3.5 text-base' : 'py-2.5 text-sm',
                isActive
                  ? highlight 
                    ? 'bg-yellow-500 text-gray-900 shadow-lg'
                    : 'bg-primary-700 text-white'
                  : highlight
                    ? 'bg-primary-700 text-yellow-300 hover:bg-yellow-500 hover:text-gray-900'
                    : 'text-primary-300 hover:bg-primary-800 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={clsx(
                  'flex-shrink-0',
                  highlight ? 'h-5 w-5' : 'h-4 w-4',
                  isActive 
                    ? highlight ? 'text-gray-900' : 'text-primary-300'
                    : highlight ? 'text-yellow-300 group-hover:text-gray-900' : 'text-primary-400 group-hover:text-primary-300'
                )} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className={clsx('text-primary-400', highlight ? 'h-4 w-4 text-gray-700' : 'h-3 w-3')} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-primary-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 bg-primary-700 rounded-full flex items-center justify-center text-xs font-bold text-primary-200 flex-shrink-0">
            {user?.first_name?.[0]?.toUpperCase() ?? user?.username?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.first_name || user?.username}</div>
            <div className="text-primary-400 text-xs truncate">{user?.rol ?? 'Usuario'}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-primary-300 hover:bg-primary-800 hover:text-white transition-colors mt-1"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </button>
      </div>
    </aside>
  )
}
