import type { ReactNode } from 'react'

interface PanelProps {
  title: ReactNode
  children: ReactNode
  actions?: ReactNode
  className?: string
  titleClassName?: string
  bodyClassName?: string
  compact?: boolean
}

export function Panel({
  title,
  children,
  actions,
  className,
  titleClassName = 'text-base',
  bodyClassName,
  compact,
}: PanelProps) {
  return (
    <section
      className={`card bg-base-200 border border-eve-border${compact ? ' card-compact' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className={`card-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={`card-title min-w-0 ${titleClassName}`}>{title}</h2>
          {actions}
        </div>
        {children}
      </div>
    </section>
  )
}
