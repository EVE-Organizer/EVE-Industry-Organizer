import type { ReactNode } from 'react'

interface ItemMetricProps {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'primary' | 'success' | 'info' | 'neutral'
  variant?: 'card' | 'inline'
  className?: string
}

const toneClass: Record<NonNullable<ItemMetricProps['tone']>, string> = {
  primary: 'text-primary',
  success: 'text-success',
  info: 'text-info',
  neutral: 'text-base-content/90',
}

export function ItemMetric({
  label,
  value,
  hint,
  tone = 'neutral',
  variant = 'card',
  className,
}: ItemMetricProps) {
  if (variant === 'inline') {
    return (
      <div className={`plan-profit-metric plan-profit-metric--inline${className ? ` ${className}` : ''}`}>
        <span className="plan-profit-metric__label">{label}</span>
        <span className={`plan-profit-metric__value ${toneClass[tone]}`}>{value}</span>
        {hint ? <span className="plan-profit-metric__hint">{hint}</span> : null}
      </div>
    )
  }

  return (
    <div className={`plan-profit-metric${className ? ` ${className}` : ''}`}>
      <dt className="plan-profit-metric__label">{label}</dt>
      <dd className={`plan-profit-metric__value ${toneClass[tone]}`}>{value}</dd>
      {hint ? <p className="plan-profit-metric__hint">{hint}</p> : null}
    </div>
  )
}
