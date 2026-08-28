import type { ManufacturingPlanTemplate } from '@/types'
import { TabRail } from '@/components/TabRail'

interface PlanTemplateBarProps {
  templates: ManufacturingPlanTemplate[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder?: (fromId: string, toId: string) => void
}

export function PlanTemplateBar({ templates, selectedId, onSelect, onReorder }: PlanTemplateBarProps) {
  return (
    <TabRail
      ariaLabel="Plan templates"
      selectedId={selectedId ?? ''}
      onSelect={onSelect}
      onReorder={onReorder}
      emptyMessage={<p className="text-sm text-base-content/55">No plans yet. Create one to get started.</p>}
      items={templates.map((t) => ({
        id: t.id,
        label: t.name,
        count: t.roots?.length ?? 0,
      }))}
    />
  )
}
