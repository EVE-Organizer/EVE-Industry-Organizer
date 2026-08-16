import { hubDisplayName } from '@/lib/hubDisplay'
import type { BlueprintCostBreakdown } from '@/types'

export function blueprintJitaFallbackNote(breakdown: BlueprintCostBreakdown): string | null {
  if (breakdown.sourceHub !== 'jita') return null
  if (!breakdown.selectedHub || breakdown.selectedHub === 'jita') return null
  const selectedName = hubDisplayName(breakdown.selectedHub)
  return `Blueprint price from ${hubDisplayName('jita')} (not listed at ${selectedName}). Materials and sales still use your selected hubs.`
}
