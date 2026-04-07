import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'
import type { Alert } from '../../types'
import { clsx } from 'clsx'

const iconMap = {
  ok: CheckCircle,
  warn: AlertTriangle,
  error: XCircle,
  info: Info,
}

const styleMap = {
  ok: { bg: 'bg-green-50 border-green-200', icon: 'text-green-500', title: 'text-green-800', desc: 'text-green-600' },
  warn: { bg: 'bg-yellow-50 border-yellow-200', icon: 'text-yellow-500', title: 'text-yellow-800', desc: 'text-yellow-600' },
  error: { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', title: 'text-red-800', desc: 'text-red-600' },
  info: { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-500', title: 'text-blue-800', desc: 'text-blue-600' },
}

export const AlertCard = ({ alert }: { alert: Alert }) => {
  const Icon = iconMap[alert.nivel]
  const s = styleMap[alert.nivel]
  return (
    <div className={clsx('flex items-start gap-3 p-3 rounded-lg border', s.bg)}>
      <Icon className={clsx('h-4 w-4 mt-0.5 flex-shrink-0', s.icon)} />
      <div>
        <p className={clsx('text-xs font-semibold', s.title)}>{alert.titulo}</p>
        <p className={clsx('text-xs mt-0.5', s.desc)}>{alert.descripcion}</p>
      </div>
    </div>
  )
}
