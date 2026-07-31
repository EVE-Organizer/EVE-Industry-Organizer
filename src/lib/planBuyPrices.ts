import type { PlanNodeOverride } from '@/types'

/** Apply per-item custom buy prices when the hub has no sell price for that type. */
export function mergePlanBuyPrices(
  hubPrices: Map<number, number>,
  nodeOverrides: Record<number, PlanNodeOverride>,
): Map<number, number> {
  const merged = new Map(hubPrices)
  for (const [typeIdKey, override] of Object.entries(nodeOverrides)) {
    const typeId = Number(typeIdKey)
    const hubPrice = hubPrices.get(typeId) ?? 0
    if (hubPrice > 0) continue
    const custom = override.buyPrice
    if (custom != null && custom > 0) merged.set(typeId, custom)
  }
  return merged
}
