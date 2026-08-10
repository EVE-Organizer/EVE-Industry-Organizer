import type { BlueprintCostBreakdown } from '@/types'
import { HUBS } from '@/types'

export function blueprintJitaFallbackNote(breakdown: BlueprintCostBreakdown): string | null {
  if (breakdown.sourceHub !== 'jita') return null
  if (!breakdown.selectedHub || breakdown.selectedHub === 'jita') return null
  const selectedName =
    HUBS.find((h) => h.id === breakdown.selectedHub)?.name ?? breakdown.selectedHub
  return `Blueprint price from Jita (not listed at ${selectedName}). Materials and sales still use your selected hubs.`
}
