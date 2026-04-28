import { clsx } from 'clsx'

interface BadgeProps {
  nivel: 'ok' | 'warn' | 'error' | 'info'
  children: React.ReactNode
  className?: string
}

const variants = {
  ok: 'badge-ok',
  warn: 'badge-warn',
  error: 'badge-error',
  info: 'bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-1 rounded-full',
}

export const Badge = ({ nivel, children, className }: BadgeProps) => (
  <span className={clsx(variants[nivel], className)}>{children}</span>
)
