import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    success: 'bg-green-500/15 text-green-600 border-green-500/30',
    warning: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
    danger: 'bg-red-500/15 text-red-600 border-red-500/30',
    outline: 'border text-muted-foreground',
  }
  return (
    <div className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors', variants[variant], className)} {...props}>
      {children}
    </div>
  )
}
