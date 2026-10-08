import type { PlanJobsFooterTotals } from '@/pages/Plan/planJobsTableColumns'
import { rowDurationHours, type BuildBlueprintRow } from '@/pages/Plan/planJobsTableTypes'
import type { RootProfitRow } from '@/pages/Plan/planProfit'

function maxFiniteHours(values: (number | undefined)[]): number | null {
  const nums = values.filter((h): h is number => h != null && Number.isFinite(h))
  return nums.length > 0 ? Math.max(...nums) : null
}

/** Latest Ready by deadline. Empty when no root has a deadline. */
export function totalReadyByFooterHours(enabledRoots: BuildBlueprintRow[]): number | null {
  return maxFiniteHours(enabledRoots.map((row) => row.readyByHours))
}

/** Longest Duration-column value — stored target when set, else job timer. */
export function totalDurationFooterHours(enabledRoots: BuildBlueprintRow[]): number | null {
  if (enabledRoots.length === 0) return null
  return Math.max(...enabledRoots.map(rowDurationHours))
}

export function computePlanJobsFooterTotals(input: {
  enabledRows: BuildBlueprintRow[]
  enabledRoots: BuildBlueprintRow[]
  profitByRootId?: Map<string, RootProfitRow>
}): PlanJobsFooterTotals {
  const { enabledRows, enabledRoots, profitByRootId } = input

  let totalOutputQty = 0
  for (const row of enabledRows) totalOutputQty += row.outputQty

  const totalDurationHours = totalDurationFooterHours(enabledRoots)
  const totalReadyByHours = totalReadyByFooterHours(enabledRoots)

  let totalSetupCost: number | null = null
  let totalNetProfit: number | null = null
  let pricedRoots = 0
  let setupSum = 0
  let profitSum = 0
  for (const root of enabledRoots) {
    if (!root.rootId) continue
    const row = profitByRootId?.get(root.rootId)
    if (!row?.hasPrices) continue
    pricedRoots += 1
    setupSum += row.setupCost
    profitSum += row.netProfit
  }
  let totalMargin: number | null = null
  if (pricedRoots > 0) {
    totalSetupCost = setupSum
    totalNetProfit = profitSum
    totalMargin = setupSum > 0 ? (profitSum / setupSum) * 100 : 0
  }

  return {
    totalDurationHours,
    totalReadyByHours,
    totalOutputQty,
    totalSetupCost,
    totalNetProfit,
    totalMargin,
  }
}
