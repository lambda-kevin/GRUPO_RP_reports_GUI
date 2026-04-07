import { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  color?: 'green' | 'blue' | 'yellow' | 'red' | 'purple'
  trend?: { value: number; label: string }
}

const colorMap = {
  green: { bg: 'bg-green-50', icon: 'bg-green-500', text: 'text-green-700', light: 'text-green-600' },
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-500', text: 'text-blue-700', light: 'text-blue-600' },
  yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-500', text: 'text-yellow-700', light: 'text-yellow-600' },
  red: { bg: 'bg-red-50', icon: 'bg-red-500', text: 'text-red-700', light: 'text-red-600' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-700', light: 'text-purple-600' },
}

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'green', trend }: StatCardProps) => {
  const c = colorMap[color]
  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          {trend && (
            <div className={clsx('flex items-center gap-1 mt-2 text-xs font-medium', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
              <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={clsx('p-3 rounded-xl', c.bg)}>
          <Icon className={clsx('h-6 w-6', c.light)} />
        </div>
      </div>
    </div>
  )
}
