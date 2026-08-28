import type { ReactNode } from 'react'
import { Tooltip } from '@/components/Tooltip'

interface PlanStat {
  label: string
  value: string
}

interface PlanDetailHeaderProps {
  name: string
  onRename?: () => void
  stats: PlanStat[]
  actions: ReactNode
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
    </svg>
  )
}

export function PlanDetailHeader({ name, onRename, stats, actions }: PlanDetailHeaderProps) {
  return (
    <header className="plan-detail-header">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 min-w-0">
          <h2 className="text-xl font-semibold truncate tracking-tight">{name}</h2>
          {onRename ? (
            <Tooltip text="Rename plan" placement="right">
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square shrink-0 opacity-60 hover:opacity-100"
                aria-label="Rename plan"
                onClick={onRename}
              >
                <PencilIcon />
              </button>
            </Tooltip>
          ) : null}
        </div>
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
