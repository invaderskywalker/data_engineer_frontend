import './StatusDot.css'

interface StatusDotProps {
  status: 'active' | 'error' | 'connecting' | 'disconnected'
  size?: 'sm' | 'md'
  className?: string
}

export default function StatusDot({ status, size = 'md', className = '' }: StatusDotProps) {
  return (
    <span
      className={`status-dot status-dot--${status} status-dot--${size} ${className}`}
      aria-label={status}
    />
  )
}
