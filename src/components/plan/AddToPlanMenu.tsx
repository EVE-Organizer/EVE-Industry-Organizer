import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { DEFAULT_BATCH_SIZE } from '@/types'

export function AddToPlanMenu({ productTypeId }: { productTypeId: number }) {
  const navigate = useNavigate()
  const templates = useAppStore((s) => s.userData.planTemplates ?? [])
  const addPlanTemplate = useAppStore((s) => s.addPlanTemplate)
  const addRootToPlanTemplate = useAppStore((s) => s.addRootToPlanTemplate)
  const setSelectedId = useAppStore((s) => s.setSelectedPlanTemplateId)

  const addToTemplate = (templateId: string) => {
    addRootToPlanTemplate(templateId, {
      productTypeId,
      runs: DEFAULT_BATCH_SIZE,
      productionDurationHours: 24,
    })
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
              addRootToPlanTemplate(t.id, {
                productTypeId,
                runs: DEFAULT_BATCH_SIZE,
                productionDurationHours: 24,
              })
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
