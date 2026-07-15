import type { RankedBlueprintRow, SkillLevels } from '@/types'
import { EveImage } from '@/components/EveImage'
import { BuildSkillGapFlag } from '@/components/BuildSkillGapFlag'
import { formatIsk, formatPercent } from '@/lib/profit'
import { getMissingBuildSkills } from '@/lib/buildRequirements'

export function BlueprintMobileCard({
  row,
  skills,
  watched,
  onWatch,
  onOpenGraph,
  onOpenIph,
}: {
  row: RankedBlueprintRow
  skills: SkillLevels
  watched: boolean
  onWatch: () => void
  onOpenGraph: () => void
  onOpenIph: () => void
}) {
  const missingSkills = getMissingBuildSkills(row.blueprint, skills)

  return (
    <div className="card bg-base-200 border border-eve-border w-full">
      <div className="card-body py-3 flex-row gap-3 items-center">
        <EveImage id={row.blueprint.productTypeId} size={32} framed alt={row.product.name} />
        <button type="button" className="flex-1 min-w-0 text-left" onClick={onOpenGraph}>
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-semibold text-sm truncate">{row.product.name}</h3>
            <BuildSkillGapFlag missing={missingSkills} />
          </div>
          <button
            type="button"
            className="text-xs link link-hover tabular-nums"
            onClick={(e) => {
              e.stopPropagation()
              onOpenIph()
            }}
            aria-label={`ISK per hour breakdown for ${row.product.name}`}
          >
            {formatIsk(row.iph)}/hr
          </button>
          <p className="text-xs opacity-70">
            {formatPercent(row.margin)} · {formatIsk(row.netProfit)}
          </p>
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-sm ${watched ? 'text-primary' : ''}`}
          onClick={onWatch}
        >
          {watched ? '★' : '☆'}
        </button>
      </div>
    </div>
  )
}

export function BlueprintUnrankedMobileCard({
  productTypeId,
  name,
  watched,
  onWatch,
}: {
  productTypeId: number
  name: string
  watched: boolean
  onWatch: () => void
}) {
  return (
    <div className="card bg-base-200 border border-eve-border w-full opacity-60">
      <div className="card-body py-3 flex-row gap-3 items-center">
        <EveImage id={productTypeId} size={32} framed alt={name} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{name}</h3>
          <p className="text-xs opacity-50">No price data for current hub and window</p>
        </div>
        <button
          type="button"
          className={`btn btn-ghost btn-sm ${watched ? 'text-primary' : ''}`}
          onClick={onWatch}
        >
          {watched ? '★' : '☆'}
        </button>
      </div>
    </div>
  )
}
