import type { ReactNode } from 'react'

interface MetricTileProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  accent?: 'primary' | 'secondary' | 'success' | 'info' | 'warning'
  className?: string
}

const accentBorder: Record<NonNullable<MetricTileProps['accent']>, string> = {
  primary: 'border-l-primary',
  secondary: 'border-l-secondary',
  success: 'border-l-success',
  info: 'border-l-info',
  warning: 'border-l-warning',
}

export function MetricTile({ label, value, icon, accent = 'primary', className = '' }: MetricTileProps) {
  return (
    <div
      className={`rounded-lg border border-eve-border bg-base-300/40 border-l-4 ${accentBorder[accent]} p-3 flex items-start gap-2 min-w-0 ${className}`}
    >
      {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide opacity-60">{label}</div>
        <div className="font-semibold text-sm truncate">{value}</div>
      </div>
    </div>
  )
}
