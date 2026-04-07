import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export const Card = ({ children, className, padding = true }: CardProps) => (
  <div className={clsx('card', padding && 'p-5', className)}>{children}</div>
)
