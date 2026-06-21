import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: ReactNode
  description?: string
  icon?: ReactNode
  accent?: 'primary' | 'secondary' | 'success' | 'info' | 'warning'
  className?: string
  valueClassName?: string
}

const accentBorder: Record<NonNullable<StatCardProps['accent']>, string> = {
  primary: 'border-t-primary',
  secondary: 'border-t-secondary',
  success: 'border-t-success',
  info: 'border-t-info',
  warning: 'border-t-warning',
}

export function StatCard({
  label,
  value,
  description,
  icon,
  accent,
  className,
  valueClassName = 'text-2xl',
}: StatCardProps) {
  const accentClass = accent ? ` border-t-4 ${accentBorder[accent]}` : ''
  return (
    <div
      className={`stat bg-base-200 rounded-lg border border-eve-border overflow-hidden${accentClass}${className ? ` ${className}` : ''}`}
    >
      <div className="stat-figure text-primary opacity-90">{icon}</div>
      <div className="stat-title">{label}</div>
      <div className={`stat-value ${valueClassName}`}>{value}</div>
      {description && <div className="stat-desc">{description}</div>}
    </div>
  )
}
