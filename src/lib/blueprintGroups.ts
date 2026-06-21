import type { BlueprintTier } from '@/types'

export const TIER_LABELS: Record<BlueprintTier, string> = {
  t1: 'T1',
  t2: 'T2',
  faction: 'Faction',
}

export function tierLabel(tier: BlueprintTier): string {
  return TIER_LABELS[tier]
}
