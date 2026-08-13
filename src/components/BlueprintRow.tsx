import { memo, type ReactNode } from 'react'
import type { RankedBlueprintRow, SkillLevels } from '@/types'
import { CopyNameButton } from '@/components/CopyNameButton'
import { EveImage } from '@/components/EveImage'
import { BuildSkillGapFlag } from '@/components/BuildSkillGapFlag'
import { HaulRiskTrigger } from '@/components/HaulRiskModal'
import { PlanBlueprintItemName } from '@/components/plan/PlanBlueprintItemName'
import { formatAvgVolume, formatDuration, formatIsk, formatPercent } from '@/lib/profit'
import { tierLabel } from '@/lib/blueprintGroups'
import { getMissingBuildSkills } from '@/lib/buildRequirements'
import type { RouteDangerResult } from '@/lib/routeDanger'
import { AddToPlanMenu } from '@/components/plan/AddToPlanMenu'
import { stopRowToggle } from '@/components/plan/PlanTreeLines'
import { appRoute } from '@/lib/paths'
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
  gateIntelLoading?: boolean
  haulInLabel?: string
  haulOutLabel?: string
}

function BlueprintMetaLine({ row }: { row: RankedBlueprintRow }) {
  return (
    <span className="text-[10px] flex items-center gap-1 flex-wrap">
      <span className="opacity-50 flex items-center gap-1">
        <span className="badge badge-xs badge-ghost shrink-0">{tierLabel(row.blueprint.tier)}</span>
        {row.blueprint.kind === 'reaction' ? (
          <span className="badge badge-xs badge-outline badge-info shrink-0">Formula</span>
        ) : null}
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

function BlueprintItemName({
  row,
  onOpenGraph,
}: {
  row: RankedBlueprintRow
  onOpenGraph: () => void
}) {
  return (
    <PlanBlueprintItemName
      node={{
        productTypeId: row.blueprint.productTypeId,
        name: row.product.name,
        canToggle: true,
        isRoot: true,
      }}
      onOpenGraph={() => onOpenGraph()}
    />
  )
}

export const BlueprintRow = memo(function BlueprintRow(props: BlueprintItemProps) {
  const { row, rank, skills, watched, onWatch, onOpenGraph, onOpenSetup, onOpenIph, onOpenHaulRisk, haulIn, haulOut, haulError, dangerLoading, gateIntelLoading, haulInLabel, haulOutLabel } = props
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
          <BlueprintItemName row={row} onOpenGraph={onOpenGraph} />
          <BuildSkillGapFlag missing={missingSkills} />
        </div>
        <BlueprintMetaLine row={row} />
      </td>
      <td className="whitespace-nowrap" onClick={stopRowToggle}>
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
      <td className="whitespace-nowrap" onClick={stopRowToggle}>
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
      <td onClick={stopRowToggle}>
        <HaulRiskTrigger
          haulIn={haulIn}
          haulOut={haulOut}
          error={haulError}
          loading={dangerLoading}
          gateIntelLoading={gateIntelLoading}
          haulInLabel={haulInLabel}
          haulOutLabel={haulOutLabel}
          onOpen={onOpenHaulRisk}
        />
      </td>
      <td onClick={stopRowToggle}>
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
  const { row, rank, skills, watched, onWatch, onOpenGraph, onOpenSetup, onOpenIph, onOpenHaulRisk, haulIn, haulOut, haulError, dangerLoading, gateIntelLoading, haulInLabel, haulOutLabel } = props
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
            <BlueprintItemName row={row} onOpenGraph={onOpenGraph} />
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
            stopRowToggle(e)
            onWatch()
          }}
          aria-label={watched ? 'Remove from favorites' : 'Add to favorites'}
        >
          {watched ? '★' : '☆'}
        </button>
        <div className="shrink-0 -mt-1" onClick={stopRowToggle}>
          <AddToPlanMenu productTypeId={row.blueprint.productTypeId} />
        </div>
      </div>

      <dl
        className="mt-2.5 pt-2.5 border-t border-eve-border/60 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 min-w-0"
        onClick={stopRowToggle}
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
            gateIntelLoading={gateIntelLoading}
            haulInLabel={haulInLabel}
            haulOutLabel={haulOutLabel}
            onOpen={onOpenHaulRisk}
          />
        </MobileStat>
      </dl>
    </article>
  )
})

function UnrankedItemName({ productTypeId, name }: { productTypeId: number; name: string }) {
  const marketHref = appRoute(`item/${productTypeId}`)
  return (
    <div className="flex items-center gap-0.5 min-w-0">
      <CopyNameButton text={name} />
      <a
        href={marketHref}
        target="_blank"
        rel="noopener noreferrer"
        className={textLinkClass('truncate')}
        title={`${name} (market)`}
      >
        {name}
      </a>
    </div>
  )
}

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
        <UnrankedItemName productTypeId={productTypeId} name={name} />
        <span className="text-[10px] opacity-50 block">No price data for current hub and window</span>
      </td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>
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
          <UnrankedItemName productTypeId={productTypeId} name={name} />
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
