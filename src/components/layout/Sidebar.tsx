import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Wallet,
  MessageSquare,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'

const navItems: Array<{ to: string; icon: typeof Wallet; label: string; highlight?: boolean }> = [
  { to: '/cartera', icon: Wallet, label: 'Cartera', highlight: true },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Panel Ejecutivo' },
  { to: '/bancos', icon: Building2, label: 'Bancos' },
  { to: '/agente', icon: MessageSquare, label: 'Centro de Mando' },
]

export const Sidebar = ({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) => {
  const logoSources = ['/dist/assets/grupo-rp-noback.png', '/assets/grupo-rp-noback.png']
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
    <aside className={clsx(
      'bg-primary-950 text-white flex flex-col h-screen fixed left-0 top-0 z-30 transition-all duration-200',
      collapsed ? 'w-20' : 'w-64'
    )}>
      {/* Logo */}
      <div className={clsx('border-b border-primary-800', collapsed ? 'p-3' : 'p-5')}>
        <div className={clsx('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <img
            src={logoSources[0]}
            alt="Grupo RP"
            className="w-9 h-9 rounded-lg object-contain bg-primary-500/20 p-1"
            onError={(e) => { e.currentTarget.src = logoSources[1] }}
          />
          {!collapsed && <div>
            <div className="font-bold text-sm leading-tight">Grupo RP</div>
            <div className="text-primary-400 text-xs">Sistema Operativo</div>
          </div>}
        </div>
        <button
          onClick={onToggle}
          className={clsx(
            'mt-3 w-full rounded-lg bg-primary-900 hover:bg-primary-800 text-primary-300 py-1.5 flex items-center justify-center',
            collapsed ? 'px-0' : 'gap-2'
          )}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span className="text-xs font-semibold">Contraer</span>}
        </button>
      </div>

      {/* Nav */}
      <nav className={clsx('flex-1 space-y-1 overflow-y-auto', collapsed ? 'p-2' : 'p-3')}>
        {!collapsed && <div className="text-primary-400 text-[11px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1">
          Panel Ejecutivo
        </div>}
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
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && isActive && <ChevronRight className={clsx('text-primary-400', highlight ? 'h-4 w-4 text-gray-700' : 'h-3 w-3')} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className={clsx('border-t border-primary-800', collapsed ? 'p-2' : 'p-3')}>
        <div className={clsx('flex items-center px-3 py-2 rounded-lg', collapsed ? 'justify-center' : 'gap-3')}>
          <div className="w-8 h-8 bg-primary-700 rounded-full flex items-center justify-center text-xs font-bold text-primary-200 flex-shrink-0">
            {user?.first_name?.[0]?.toUpperCase() ?? user?.username?.[0]?.toUpperCase() ?? 'U'}
          </div>
          {!collapsed && <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.first_name || user?.username}</div>
            <div className="text-primary-400 text-xs truncate">{user?.rol ?? 'Usuario'}</div>
          </div>}
        </div>
        <button
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center rounded-lg text-sm text-primary-300 hover:bg-primary-800 hover:text-white transition-colors mt-1',
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && 'Cerrar sesion'}
        </button>
      </div>
    </aside>
  )
}
