import type { ReactNode } from 'react'
import './Badge.css'

interface BadgeProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default'
  size?: 'sm' | 'md'
  children: ReactNode
  className?: string
}

export default function Badge({
  variant = 'default',
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span className={`badge badge--${variant} badge--${size} ${className}`}>
      {children}
    </span>
  )
}
