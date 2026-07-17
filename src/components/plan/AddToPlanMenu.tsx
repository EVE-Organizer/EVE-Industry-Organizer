import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import { createSyncedPlanRootEntry } from '@/lib/rootRunsDuration'
import { manufacturingSlotsFromSkills } from '@/lib/manufacturingSlots'
import { getAllBlueprints, getBlueprintForProduct } from '@/services/data/sdeLoader'
import { createPlanRootId } from '@/services/sync/types'

export function AddToPlanMenu({ productTypeId }: { productTypeId: number }) {
  const navigate = useNavigate()
  const { data } = useSdeData()
  const settings = useAppStore((s) => s.userData.settings)
  const templates = useAppStore((s) => s.userData.planTemplates ?? [])
  const addPlanTemplate = useAppStore((s) => s.addPlanTemplate)
  const addRootToPlanTemplate = useAppStore((s) => s.addRootToPlanTemplate)
  const setSelectedId = useAppStore((s) => s.setSelectedPlanTemplateId)
  const slots = manufacturingSlotsFromSkills(settings.skills)

  function buildRootEntry() {
    const blueprint = data
      ? getBlueprintForProduct(getAllBlueprints(data.registry), productTypeId)
      : undefined
    if (!blueprint) {
      return {
        id: createPlanRootId(),
        productTypeId,
        runs: 100,
        productionDurationHours: 24,
      }
    }
    return {
      id: createPlanRootId(),
      ...createSyncedPlanRootEntry(productTypeId, blueprint, settings, slots),
    }
  }

  const addToTemplate = (templateId: string) => {
    addRootToPlanTemplate(templateId, buildRootEntry())
    setSelectedId(templateId)
    navigate('/plan')
  }

  return (
    <div className="dropdown dropdown-end">
      <button type="button" tabIndex={0} className="btn btn-ghost btn-xs" aria-label="Add to plan">
        + Plan
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content menu z-20 bg-base-200 border border-eve-border rounded-lg w-48 p-1 shadow-lg"
      >
        {templates.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => addToTemplate(t.id)}>
              {t.name}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => {
              const t = addPlanTemplate()
              addRootToPlanTemplate(t.id, buildRootEntry())
              navigate('/plan')
            }}
          >
            + New plan…
          </button>
        </li>
      </ul>
    </div>
  )
}
