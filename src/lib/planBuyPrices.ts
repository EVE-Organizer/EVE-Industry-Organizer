import type { HubId, PlanNodeOverride } from '@/types'

export const PLAN_DEFAULT_BUY_HUB: HubId = 'jita'

export type PlanBuyPriceSource = { hub: HubId } | { price: number }

export function planBuyPriceSourceForHub(
  hubId: HubId,
  defaultHub: HubId = PLAN_DEFAULT_BUY_HUB,
): PlanBuyPriceSource | null {
  return hubId === defaultHub ? null : { hub: hubId }
}

export function applyPlanBuyPriceSource(
  current: PlanNodeOverride,
  source: PlanBuyPriceSource | null,
  defaultHub: HubId = PLAN_DEFAULT_BUY_HUB,
): PlanNodeOverride {
  if (source == null) {
    const { buyHub: _buyHub, buyPrice: _buyPrice, ...rest } = current
    return rest
  }

  if ('hub' in source) {
    const { buyPrice: _buyPrice, ...rest } = current
    if (source.hub === defaultHub) {
      const { buyHub: _buyHub, ...withoutHub } = rest
      return withoutHub
    }
    return { ...rest, buyHub: source.hub }
  }

  const { buyHub: _buyHub, ...rest } = current
  return { ...rest, buyPrice: source.price }
}

export function resolvePlanBuyUnitPrice(
  typeId: number,
  hubPriceMaps: Map<HubId, Map<number, number>>,
  override?: PlanNodeOverride,
  defaultHub: HubId = PLAN_DEFAULT_BUY_HUB,
): number {
  if (override?.buyPrice != null && override.buyPrice > 0) {
    return override.buyPrice
  }

  const hubId = override?.buyHub ?? defaultHub
  const hubPrice = hubPriceMaps.get(hubId)?.get(typeId) ?? 0
  if (hubPrice > 0) return hubPrice

  if (hubId !== defaultHub) {
    const fallback = hubPriceMaps.get(defaultHub)?.get(typeId) ?? 0
    if (fallback > 0) return fallback
  }

  return 0
}

/** Apply per-item buy hub or custom prices on top of the default hub price map. */
export function mergePlanBuyPrices(
  hubPriceMaps: Map<HubId, Map<number, number>>,
  nodeOverrides: Record<number, PlanNodeOverride>,
  defaultHub: HubId = PLAN_DEFAULT_BUY_HUB,
): Map<number, number> {
  const merged = new Map(hubPriceMaps.get(defaultHub) ?? [])

  for (const [typeIdKey, override] of Object.entries(nodeOverrides)) {
    const typeId = Number(typeIdKey)
    const hasBuyOverride =
      (override.buyPrice != null && override.buyPrice > 0) || override.buyHub != null
    if (!hasBuyOverride) continue

    const resolved = resolvePlanBuyUnitPrice(typeId, hubPriceMaps, override, defaultHub)
    if (resolved > 0) {
      merged.set(typeId, resolved)
    } else {
      merged.delete(typeId)
    }
  }

  return merged
}
