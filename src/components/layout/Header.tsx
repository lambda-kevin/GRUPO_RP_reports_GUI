import { Bell, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { ReactNode } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

export const Header = ({ title, subtitle, children }: HeaderProps) => {
  const queryClient = useQueryClient()

  return (
    <header className="h-auto bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {children}
          <button
            onClick={() => queryClient.invalidateQueries()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors min-h-touch text-sm font-medium"
            title="Actualizar datos"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span>Actualizar</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors relative min-h-touch text-sm font-medium">
            <Bell className="h-4 w-4 shrink-0" />
            <span>Alertas</span>
          </button>
        </div>
      </div>
    </header>
  )
}
