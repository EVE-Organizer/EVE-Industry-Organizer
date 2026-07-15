import { memo } from 'react'
import type { RankedBlueprintRow, SkillLevels } from '@/types'
import { EveImage } from '@/components/EveImage'
import { BuildSkillGapFlag } from '@/components/BuildSkillGapFlag'
import { HaulRiskTrigger } from '@/components/HaulRiskModal'
import { formatAvgVolume, formatIsk, formatPercent } from '@/lib/profit'
import { tierLabel } from '@/lib/blueprintGroups'
import { getMissingBuildSkills } from '@/lib/buildRequirements'
import type { RouteDangerResult } from '@/lib/routeDanger'

export const BlueprintRow = memo(function BlueprintRow({
  row,
  rank,
  skills,
  watched,
  onWatch,
  onOpenGraph,
  onOpenSetup,
  onOpenIph,
  onOpenHaulRisk,
  haulIn,
  haulOut,
  haulError,
  dangerLoading,
}: {
  row: RankedBlueprintRow
  rank?: number
  skills: SkillLevels
  watched: boolean
  onWatch: () => void
  onOpenGraph: () => void
  onOpenSetup: () => void
  onOpenIph: () => void
  onOpenHaulRisk: () => void
  haulIn: RouteDangerResult | null
  haulOut: RouteDangerResult | null
  haulError: string | null
  dangerLoading: boolean
}) {
  const missingSkills = getMissingBuildSkills(row.blueprint, skills)

  return (
    <tr className="hover:bg-base-200/80 cursor-pointer" onClick={onOpenGraph}>
      <td>
        <div className="flex items-center gap-1">
          {rank != null ? (
            <span className="text-[10px] opacity-40 w-4 tabular-nums">{rank}</span>
          ) : (
            <span className="w-4" aria-hidden />
          )}
          <EveImage id={row.blueprint.productTypeId} size={32} framed alt={row.product.name} />
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="link link-hover truncate">{row.product.name}</span>
          <BuildSkillGapFlag missing={missingSkills} />
        </div>
        <span className="text-[10px] opacity-50 block">
          <span className="badge badge-xs badge-ghost mr-1">{tierLabel(row.blueprint.tier)}</span>
          {row.product.group}
        </span>
      </td>
      <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="link link-hover tabular-nums"
          onClick={onOpenSetup}
          aria-label={`Setup cost breakdown for ${row.product.name}`}
        >
          {formatIsk(row.setupCost)}
        </button>
      </td>
      <td className={row.netProfit >= 0 ? 'text-success' : 'text-error'}>{formatIsk(row.netProfit)}</td>
      <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="link link-hover tabular-nums"
          onClick={onOpenIph}
          aria-label={`ISK per hour breakdown for ${row.product.name}`}
        >
          {formatIsk(row.iph)}
        </button>
      </td>
      <td>{formatPercent(row.margin)}</td>
      <td>{formatAvgVolume(row.avgVolume)}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <HaulRiskTrigger
          haulIn={haulIn}
          haulOut={haulOut}
          error={haulError}
          loading={dangerLoading}
          onOpen={onOpenHaulRisk}
        />
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${watched ? 'text-primary' : ''}`}
          onClick={onWatch}
        >
          {watched ? '★' : '☆'}
        </button>
      </td>
    </tr>
  )
})

export function BlueprintUnrankedRow({
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
    <tr className="opacity-60">
      <td>
        <div className="flex items-center gap-1">
          <span className="w-4" aria-hidden />
          <EveImage id={productTypeId} size={32} framed alt={name} />
        </div>
      </td>
      <td>
        <span className="truncate">{name}</span>
        <span className="text-[10px] opacity-50 block">No price data for current hub and window</span>
      </td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${watched ? 'text-primary' : ''}`}
          onClick={onWatch}
        >
          {watched ? '★' : '☆'}
        </button>
      </td>
    </tr>
  )
}
