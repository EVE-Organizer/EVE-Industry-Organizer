import type { ReactNode } from 'react'

interface ItemSectionProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function ItemSection({ title, subtitle, actions, children, className }: ItemSectionProps) {
  return (
    <section className={`plan-view-tabs item-section${className ? ` ${className}` : ''}`}>
      <div className="item-section__header">
        <div className="min-w-0">
          <h2 className="item-section__title">{title}</h2>
          {subtitle ? <p className="item-section__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="item-section__actions">{actions}</div> : null}
      </div>
      <div className="plan-view-tabs__panel item-section__panel">{children}</div>
    </section>
  )
}
