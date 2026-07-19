import type { BpcContractSummary, ContractsData, HubId } from '@/types'

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
