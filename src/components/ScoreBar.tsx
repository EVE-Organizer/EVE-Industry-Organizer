interface ScoreBarProps {
  value: number
  max: number
  label?: string
  accent?: string
  className?: string
}

import { formatDecimal } from '@/lib/profit'

export function ScoreBar({
  value,
  max,
  label,
  accent = 'bg-primary',
  className = '',
}: ScoreBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <div className="flex justify-between text-xs mb-1">
          <span className="opacity-60">{label}</span>
          <span className="font-semibold tabular-nums">{formatDecimal(value, 1)}</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-base-300 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${accent}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  )
}
