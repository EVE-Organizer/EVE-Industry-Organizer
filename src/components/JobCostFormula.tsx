import type { SetupCostBreakdown } from '@/types'
import { formatDecimal, formatIsk } from '@/lib/profit'
import { baseJobCostFromIndex, isPlayerStructure, jobCostSectionTitle } from '@/lib/structureSettings'

export function JobCostFormula({ breakdown }: { breakdown: Pick<
  SetupCostBreakdown,
  | 'materialCost'
  | 'systemCostIndex'
  | 'structureType'
  | 'structureJobCostBonusPercent'
  | 'structureTaxPercent'
  | 'jobCost'
> }) {
  const baseJobCost = baseJobCostFromIndex(breakdown.materialCost, breakdown.systemCostIndex)
  const playerStructure = isPlayerStructure(breakdown.structureType)

  return (
    <div className="space-y-1 text-sm font-mono text-xs sm:text-sm break-all">
      <p>
        {formatIsk(breakdown.materialCost)} × {formatDecimal(breakdown.systemCostIndex, 4)} system cost
        index = <strong>{formatIsk(baseJobCost)}</strong>
      </p>
      {playerStructure ? (
        <>
          {breakdown.structureJobCostBonusPercent > 0 ? (
            <p>
              × (1 − {formatDecimal(breakdown.structureJobCostBonusPercent, 2)}% structure role bonus)
            </p>
          ) : null}
          {breakdown.structureTaxPercent > 0 ? (
            <p>
              × (1 + {formatDecimal(breakdown.structureTaxPercent, 2)}% owner tax)
            </p>
          ) : null}
          <p>
            = <strong>{formatIsk(breakdown.jobCost)}</strong>
          </p>
        </>
      ) : (
        <p>
          = <strong>{formatIsk(breakdown.jobCost)}</strong>
        </p>
      )}
    </div>
  )
}

export function jobCostStepTitle(breakdown: Pick<SetupCostBreakdown, 'structureType'>): string {
  return jobCostSectionTitle(breakdown.structureType)
}
