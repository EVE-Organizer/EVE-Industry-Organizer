import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import type { BlueprintInfo, GlobalSettings, ManufacturingSettings, SkillInfo } from '@/types'
import { DEFAULT_BATCH_SIZE } from '@/types'
import { buildManufacturingSettings } from '@/lib/structureSettings'
import { isReactionRecipe } from '@/lib/recipes'
import { formatDuration, formatGraphQuantity } from '@/lib/profit'
import { formatSkillLevel, skillIconUrl } from '@/lib/skillFields'
import { productionGraphRoute } from '@/lib/paths'
import { textLinkClass } from '@/lib/textLink'
import { ItemSection } from '@/pages/Item/ItemSection'
import { BlueprintGraphModal } from '@/components/BlueprintGraphModal'
import { AddToPlanMenu } from '@/components/plan/AddToPlanMenu'

interface ItemRecipePanelProps {
  blueprint: BlueprintInfo
  skillNameMap: Map<string, SkillInfo>
  productName: string
  settings: GlobalSettings
  className?: string
}

export function ItemRecipePanel({
  blueprint,
  skillNameMap,
  productName,
  settings,
  className,
  systems,
}: ItemRecipePanelProps & {
  systems?: { systemId: number; security: number }[]
}) {
  const isReaction = isReactionRecipe(blueprint)
  const graphSettings = useMemo(
    (): ManufacturingSettings =>
      buildManufacturingSettings(settings, systems, { batchSize: DEFAULT_BATCH_SIZE }),
    [settings, systems],
  )

  return (
    <ItemSection title="Industry" subtitle={productName} className={className}>
      <div className="item-recipe-meta mb-3">
        <span>
          Produces <span className="text-primary font-medium">{formatGraphQuantity(blueprint.productQuantity)}</span> ×{' '}
          {productName}
        </span>
        <span className="text-base-content/60">
          Base job time:{' '}
          <span className="text-info/80 tabular-nums">{formatDuration(blueprint.manufacturingTime)}</span>
        </span>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <AddToPlanMenu productTypeId={blueprint.productTypeId} />
          <Link
            className={textLinkClass('text-primary text-xs')}
            to={productionGraphRoute(blueprint.productTypeId)}
          >
            Open full graph →
          </Link>
        </div>
      </div>

      {Object.keys(blueprint.requiredSkills).length > 0 ? (
        <div className="mb-3">
          <h3 className="text-[10px] font-medium uppercase tracking-wide text-base-content/45 mb-1.5">Required skills</h3>
          <ul className="flex flex-wrap gap-1.5">
            {Object.entries(blueprint.requiredSkills).map(([skill, level]) => {
              const skillInfo = skillNameMap.get(skill)
              return (
                <li
                  key={skill}
                  className="item-skill-badge"
                  title={`${skill} ${formatSkillLevel(level)}`}
                >
                  {skillInfo ? (
                    <img
                      src={skillIconUrl(skillInfo.skillId, 32)}
                      alt=""
                      width={16}
                      height={16}
                      className="item-skill-badge__icon"
                      loading="lazy"
                    />
                  ) : null}
                  <span className="item-skill-badge__name">{skill}</span>
                  <span className="item-skill-badge__level">{formatSkillLevel(level)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <h3 className="text-[10px] font-medium uppercase tracking-wide text-base-content/45 mb-1.5">
        {isReaction ? 'Reaction supply chain' : 'Manufacturing supply chain'}
      </h3>
      <BlueprintGraphModal
        variant="inline"
        blueprint={blueprint}
        buyHub={settings.primaryHub}
        sellHub={settings.sellHubId ?? settings.primaryHub}
        priceWindow={settings.priceWindow}
        settings={graphSettings}
        onClose={() => {}}
      />
    </ItemSection>
  )
}
