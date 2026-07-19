import { Link } from 'react-router-dom'
import type { BlueprintInfo, SkillInfo, TypeInfo } from '@/types'
import { isReactionRecipe } from '@/lib/recipes'
import { formatDuration, formatGraphQuantity } from '@/lib/profit'
import { formatSkillLevel, skillIconUrl } from '@/lib/skillFields'
import { productionGraphRoute } from '@/lib/paths'
import { textLinkClass } from '@/lib/textLink'
import { ItemSection } from '@/components/item/ItemSection'
import { ItemRecipeGraph } from '@/components/item/ItemRecipeGraph'
import { AddToPlanMenu } from '@/components/plan/AddToPlanMenu'

interface ItemRecipePanelProps {
  blueprint: BlueprintInfo
  typeMap: Map<number, TypeInfo>
  skillNameMap: Map<string, SkillInfo>
  productName: string
  className?: string
}

export function ItemRecipePanel({
  blueprint,
  typeMap,
  skillNameMap,
  productName,
  className,
}: ItemRecipePanelProps) {
  const isReaction = isReactionRecipe(blueprint)

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
            Production graph →
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
        {isReaction ? 'Reaction flow' : 'Manufacturing flow'} (per run)
      </h3>
      <ItemRecipeGraph
        blueprint={blueprint}
        typeMap={typeMap}
        productName={productName}
      />
    </ItemSection>
  )
}
