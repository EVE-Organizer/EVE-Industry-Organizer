import { memo, type ReactNode } from 'react'
import type { RankedBlueprintRow, SkillLevels } from '@/types'
import { CopyNameButton } from '@/components/CopyNameButton'
import { EveImage } from '@/components/EveImage'
import { BuildSkillGapFlag } from '@/components/BuildSkillGapFlag'
import { HaulRiskTrigger } from '@/components/HaulRiskModal'
import { formatAvgVolume, formatDuration, formatIsk, formatPercent } from '@/lib/profit'
import { tierLabel } from '@/lib/blueprintGroups'
import { getMissingBuildSkills } from '@/lib/buildRequirements'
import type { RouteDangerResult } from '@/lib/routeDanger'
import { AddToPlanMenu } from '@/components/plan/AddToPlanMenu'
import { textLinkClass } from '@/lib/textLink'

export interface BlueprintItemProps {
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
}

function BlueprintMetaLine({ row }: { row: RankedBlueprintRow }) {
  return (
    <span className="text-[10px] flex items-center gap-1 flex-wrap">
      <span className="opacity-50 flex items-center gap-1">
        <span className="badge badge-xs badge-ghost shrink-0">{tierLabel(row.blueprint.tier)}</span>
        {row.product.group}
      </span>
      {row.jobTimeSeconds > 0 ? (
        <span
          className="shrink-0 tabular-nums text-info/70"
          title="Total job duration for your batch size"
        >
          {formatDuration(row.jobTimeSeconds)}
        </span>
      ) : null}
    </span>
  )
}

export const BlueprintRow = memo(function BlueprintRow(props: BlueprintItemProps) {
  const { row, rank, skills, watched, onWatch, onOpenGraph, onOpenSetup, onOpenIph, onOpenHaulRisk, haulIn, haulOut, haulError, dangerLoading } = props
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
          <CopyNameButton text={row.product.name} />
          <span className={textLinkClass('truncate')}>{row.product.name}</span>
          <BuildSkillGapFlag missing={missingSkills} />
        </div>
        <BlueprintMetaLine row={row} />
      </td>
      <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={textLinkClass('tabular-nums')}
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
          className={textLinkClass('tabular-nums')}
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
        <div className="flex items-center gap-0.5">
          <AddToPlanMenu productTypeId={row.blueprint.productTypeId} />
          <button
            type="button"
            className={`btn btn-ghost btn-xs ${watched ? 'text-primary' : ''}`}
            onClick={onWatch}
          >
            {watched ? '★' : '☆'}
          </button>
        </div>
      </td>
    </tr>
  )
})

function MobileStat({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide opacity-50">{label}</div>
      <div className="text-xs tabular-nums truncate">{children}</div>
    </div>
  )
}

export const BlueprintMobileRow = memo(function BlueprintMobileRow(props: BlueprintItemProps) {
  const { row, rank, skills, watched, onWatch, onOpenGraph, onOpenSetup, onOpenIph, onOpenHaulRisk, haulIn, haulOut, haulError, dangerLoading } = props
  const missingSkills = getMissingBuildSkills(row.blueprint, skills)

  return (
    <article
      className="rounded-lg border border-eve-border bg-base-200 p-3 w-full min-w-0 max-w-full cursor-pointer hover:bg-base-300/40 transition-colors"
      onClick={onOpenGraph}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenGraph()
        }
      }}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {rank != null ? (
          <span className="text-[10px] opacity-40 w-4 shrink-0 tabular-nums pt-1">{rank}</span>
        ) : null}
        <EveImage id={row.blueprint.productTypeId} size={32} framed alt={row.product.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <CopyNameButton text={row.product.name} />
            <span className={textLinkClass('font-medium text-sm truncate')}>{row.product.name}</span>
            <BuildSkillGapFlag missing={missingSkills} />
          </div>
          <p className="truncate mt-0.5">
            <BlueprintMetaLine row={row} />
          </p>
        </div>
        <button
          type="button"
          className={`btn btn-ghost btn-xs shrink-0 -mt-1 ${watched ? 'text-primary' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onWatch()
          }}
          aria-label={watched ? 'Remove from favorites' : 'Add to favorites'}
        >
          {watched ? '★' : '☆'}
        </button>
        <div className="shrink-0 -mt-1" onClick={(e) => e.stopPropagation()}>
          <AddToPlanMenu productTypeId={row.blueprint.productTypeId} />
        </div>
      </div>

      <dl
        className="mt-2.5 pt-2.5 border-t border-eve-border/60 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        <MobileStat label="Setup">
          <button
            type="button"
            className={textLinkClass()}
            onClick={onOpenSetup}
            aria-label={`Setup cost breakdown for ${row.product.name}`}
          >
            {formatIsk(row.setupCost)}
          </button>
        </MobileStat>
        <MobileStat label="Profit">
          <span className={row.netProfit >= 0 ? 'text-success' : 'text-error'}>
            {formatIsk(row.netProfit)}
          </span>
        </MobileStat>
        <MobileStat label="ISK/hr">
          <button
            type="button"
            className={textLinkClass()}
            onClick={onOpenIph}
            aria-label={`ISK per hour breakdown for ${row.product.name}`}
          >
            {formatIsk(row.iph)}
          </button>
        </MobileStat>
        <MobileStat label="Margin">{formatPercent(row.margin)}</MobileStat>
        <MobileStat label="Vol/day">{formatAvgVolume(row.avgVolume)}</MobileStat>
        <MobileStat label="Haul">
          <HaulRiskTrigger
            haulIn={haulIn}
            haulOut={haulOut}
            error={haulError}
            loading={dangerLoading}
            onOpen={onOpenHaulRisk}
          />
        </MobileStat>
      </dl>
    </article>
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

export function BlueprintUnrankedMobileRow({
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
    <article className="rounded-lg border border-eve-border bg-base-200 p-3 w-full min-w-0 max-w-full opacity-60">
      <div className="flex items-center gap-2.5 min-w-0">
        <EveImage id={productTypeId} size={32} framed alt={name} />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{name}</h3>
          <p className="text-[10px] opacity-50 mt-0.5">No price data for current hub and window</p>
        </div>
        <button
          type="button"
          className={`btn btn-ghost btn-xs shrink-0 ${watched ? 'text-primary' : ''}`}
          onClick={onWatch}
        >
          {watched ? '★' : '☆'}
        </button>
      </div>
    </article>
  )
}
