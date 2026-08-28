import type { FittingData } from '@/pages/FitSkills/types'
import { publicDataUrl } from '@/lib/paths'

let cache: FittingData | null = null

export async function loadFittingData(): Promise<FittingData> {
  if (cache) return cache
  const res = await fetch(publicDataUrl('fitting.json'))
  if (!res.ok) throw new Error(`Failed to load fitting data (${res.status})`)
  cache = (await res.json()) as FittingData
  return cache
}
