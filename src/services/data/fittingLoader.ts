import { publicDataUrl } from '@/lib/paths'
import type { FittingItemRecord } from '@/lib/fitSkills'

export interface FittingData {
  generatedAt: string
  items: Record<string, FittingItemRecord>
}

let cache: FittingData | null = null

export async function loadFittingData(): Promise<FittingData> {
  if (cache) return cache
  const res = await fetch(publicDataUrl('fitting.json'))
  if (!res.ok) throw new Error(`Failed to load fitting.json (${res.status})`)
  cache = (await res.json()) as FittingData
  return cache
}

export function fittingByTypeId(data: FittingData): Map<number, FittingItemRecord> {
  const map = new Map<number, FittingItemRecord>()
  for (const [id, record] of Object.entries(data.items)) {
    map.set(Number(id), record)
  }
  return map
}
