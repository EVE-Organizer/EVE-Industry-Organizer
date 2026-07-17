import type { ManufacturingPlanTemplate } from '@/types'

interface PlanTemplateBarProps {
  templates: ManufacturingPlanTemplate[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function PlanTemplateBar({ templates, selectedId, onSelect }: PlanTemplateBarProps) {
  if (templates.length === 0) {
    return <p className="text-sm text-base-content/55">No plans yet. Create one to get started.</p>
  }

  return (
    <div className="plan-template-rail" role="tablist" aria-label="Plan templates">
      {templates.map((t) => {
        const selected = t.id === selectedId
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`plan-template-btn${selected ? ' plan-template-btn--active' : ''}`}
            onClick={() => onSelect(t.id)}
          >
            <span className="truncate max-w-[12rem] sm:max-w-none">{t.name}</span>
            <span className="plan-template-btn__count">{t.roots?.length ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}
