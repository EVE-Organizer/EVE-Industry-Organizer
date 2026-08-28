import { publicDataUrl } from '@/lib/paths'
import {
  industryStructuresInRange,
  type IndustryStructureRow,
} from '@/lib/industryStructures'
import type { ProductionLocation } from '@/types'

interface IndustryStructuresFile {
  structures: IndustryStructureRow[]
}

let cached: IndustryStructureRow[] | null = null

export async function loadIndustryStructures(): Promise<IndustryStructureRow[]> {
  if (cached) return cached
  const res = await fetch(publicDataUrl('industry-structures.json'))
  if (!res.ok) throw new Error(`Failed to load industry-structures.json: ${res.status}`)
  const data = (await res.json()) as IndustryStructuresFile
  cached = Array.isArray(data.structures) ? data.structures : []
  return cached
}

export async function resolvePublicStructuresNear(
  kind: 'manufacturing' | 'refinery',
  nearbySystems: Set<number> | null = null,
): Promise<{ locations: ProductionLocation[]; unresolved: number }> {
  const structures = await loadIndustryStructures()
  return {
    locations: industryStructuresInRange(structures, nearbySystems, kind),
    unresolved: 0,
  }
}
