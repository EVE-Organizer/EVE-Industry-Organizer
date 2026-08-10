import type { BpcContractListing, BpcContractSummary, ContractsData, HubId } from '@/types'

export interface BpcCostPerRun {
  costPerRun: number
  buyout: number
  runs: number
  me: number
  te: number
  contractId: number
}

export function getBpcContracts(
  contracts: ContractsData | null | undefined,
  blueprintTypeId: number,
  hub: HubId,
): BpcContractSummary | null {
  if (!contracts) return null
  const hubData = contracts.hubs[hub]
  if (!hubData) return null
  return hubData.byBlueprintTypeId[String(blueprintTypeId)] ?? null
}

function listingBuyout(listing: BpcContractListing): number {
  return listing.buyout > 0 ? listing.buyout : listing.price
}

/** Lowest ISK per remaining run among usable contract listings. */
export function bestBpcCostPerRun(summary: BpcContractSummary | null | undefined): BpcCostPerRun | null {
  if (!summary?.listings?.length) return null

  let best: BpcCostPerRun | null = null
  for (const listing of summary.listings) {
    if (listing.runs <= 0) continue
    const buyout = listingBuyout(listing)
    if (buyout <= 0) continue
    const costPerRun = buyout / listing.runs
    if (!best || costPerRun < best.costPerRun) {
      best = {
        costPerRun,
        buyout,
        runs: listing.runs,
        me: listing.me,
        te: listing.te,
        contractId: listing.contractId,
      }
    }
  }
  return best
}

export function resolveBpcCostPerRun(
  contracts: ContractsData | null | undefined,
  blueprintTypeId: number,
  hub: HubId,
): BpcCostPerRun | null {
  return bestBpcCostPerRun(getBpcContracts(contracts, blueprintTypeId, hub))
}
