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
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {children}
          <button
            onClick={() => queryClient.invalidateQueries()}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
