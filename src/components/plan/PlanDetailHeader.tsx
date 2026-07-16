import type { ReactNode } from 'react'

interface PlanStat {
  label: string
  value: string
}

interface PlanDetailHeaderProps {
  name: string
  stats: PlanStat[]
  actions: ReactNode
}

export function PlanDetailHeader({ name, stats, actions }: PlanDetailHeaderProps) {
  return (
    <header className="plan-detail-header">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold truncate tracking-tight">{name}</h2>
        <dl className="mt-2.5 flex flex-wrap gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="plan-stat-chip">
              <dt className="plan-stat-chip__label">{stat.label}</dt>
              <dd className="plan-stat-chip__value">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="plan-toolbar shrink-0">{actions}</div>
    </header>
  )
}
