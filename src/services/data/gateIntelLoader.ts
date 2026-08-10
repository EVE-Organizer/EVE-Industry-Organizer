import { publicDataUrl } from '@/lib/paths'

export interface GateInfo {
  systemId: number
  name: string
}

export interface GateIntelData {
  generatedAt: string
  smartBombTypeIds: number[]
  smartbombTypeIds?: number[]
  interdictorTypeIds: number[]
  hicTypeIds: number[]
  gatesByLocationId: Record<string, GateInfo>
}

export interface GateIntelLookup {
  gatesByLocationId: Map<number, GateInfo>
  smartBombTypeIds: Set<number>
  interdictorTypeIds: Set<number>
  hicTypeIds: Set<number>
}

let cache: GateIntelLookup | null = null

export function buildGateIntelLookup(data: GateIntelData): GateIntelLookup {
  const gatesByLocationId = new Map<number, GateInfo>()
  for (const [key, gate] of Object.entries(data.gatesByLocationId)) {
    const locationId = Number(key)
    if (Number.isFinite(locationId)) {
      gatesByLocationId.set(locationId, gate)
    }
  }
  const smartBombIds = data.smartBombTypeIds ?? data.smartbombTypeIds ?? []
  return {
    gatesByLocationId,
    smartBombTypeIds: new Set(smartBombIds),
    interdictorTypeIds: new Set(data.interdictorTypeIds),
    hicTypeIds: new Set(data.hicTypeIds),
  }
}

export async function loadGateIntel(): Promise<GateIntelLookup> {
  if (cache) return cache
  const res = await fetch(publicDataUrl('gateIntel.json'))
  if (!res.ok) throw new Error('Failed to load gate intel data')
  const data = (await res.json()) as GateIntelData
  cache = buildGateIntelLookup(data)
  return cache
}

export function clearGateIntelCache(): void {
  cache = null
}
