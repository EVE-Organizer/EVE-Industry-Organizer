import type {
  BlueprintFilterTier,
  BlueprintInfo,
  BlueprintRegistry,
  HubId,
  HubMarketData,
  MarketData,
  RegionInfo,
  RegionsData,
  SkillInfo,
  StationInfo,
  SystemInfo,
  TypeInfo,
} from '@/types'
import { publicDataUrl } from '@/lib/paths'

export interface SdeData {
  types: TypeInfo[]
  registry: BlueprintRegistry
  market: MarketData
  regions: RegionsData
  skills: SkillInfo[]
  stations: StationInfo[]
  systems: SystemInfo[]
}

let cache: SdeData | null = null

export async function loadSdeData(): Promise<SdeData> {
  if (cache) return cache
  const [typesRaw, registry, market, regions, skills, stations, systems] = await Promise.all([
    fetch(publicDataUrl('types.json')).then((r) => r.json()),
    fetch(publicDataUrl('blueprints.json')).then((r) => r.json()),
    fetch(publicDataUrl('market.json')).then((r) => r.json()),
    fetch(publicDataUrl('regions.json')).then((r) => r.json()),
    fetch(publicDataUrl('skills.json')).then((r) => r.json()),
    fetch(publicDataUrl('stations.json')).then((r) => r.json()),
    fetch(publicDataUrl('systems.json')).then((r) => r.json()),
  ])
  const types: TypeInfo[] = Array.isArray(typesRaw) ? typesRaw : typesRaw.types
  cache = { types, registry, market, regions, skills, stations, systems }
  return cache
}

export function buildTypeMap(types: TypeInfo[]): Map<number, TypeInfo> {
  return new Map(types.map((t) => [t.typeId, t]))
}

/** Rankings skip types absent from types.json (unpublished products, unknown BPOs). */
export function isRankableBlueprint(
  blueprint: BlueprintInfo,
  typeMap: Map<number, TypeInfo>,
): boolean {
  if (!typeMap.has(blueprint.productTypeId)) return false
  if (blueprint.tier === 't1' && !typeMap.has(blueprint.blueprintTypeId)) return false
  return true
}

export function buildRegionMap(regions: RegionsData): Map<number, RegionInfo> {
  return new Map(regions.regions.map((r) => [r.regionId, r]))
}

/**
 * Resolve the build system ID and cost index for a given manufacturing system.
 * Falls back: system.costIndex -> region costIndex -> hubMarket costIndex.
 */
export function resolveBuildSystem(
  systems: SystemInfo[],
  regions: RegionsData,
  hubMarket: HubMarketData,
  manufacturingSystemId: number,
): { buildSystemId: number; costIndex: number } {
  const system = systems.find((s) => s.systemId === manufacturingSystemId)
  if (system) {
    const costIndex =
      system.costIndex ??
      regions.regions.find((r) => r.regionId === system.regionId)?.costIndex ??
      hubMarket.costIndex
    return { buildSystemId: manufacturingSystemId, costIndex }
  }
  return { buildSystemId: manufacturingSystemId, costIndex: hubMarket.costIndex }
}

export function getAllBlueprints(registry: BlueprintRegistry): BlueprintInfo[] {
  return registry.blueprints
}

export function getBlueprintForProduct(
  blueprints: BlueprintInfo[],
  productTypeId: number,
): BlueprintInfo | undefined {
  return blueprints.find((b) => b.productTypeId === productTypeId)
}

export function getBlueprintForBpo(
  blueprints: BlueprintInfo[],
  blueprintTypeId: number,
): BlueprintInfo | undefined {
  return blueprints.find((b) => b.blueprintTypeId === blueprintTypeId)
}

export function getHubMarket(market: MarketData, hub: HubId): HubMarketData | null {
  return market.hubs[hub] ?? null
}

export function buildPriceMap(hubMarket: HubMarketData): Map<number, number> {
  const map = new Map<number, number>()
  for (const [id, price] of Object.entries(hubMarket.prices)) {
    map.set(Number(id), Number(price))
  }
  return map
}

export function buildBuyPriceMap(hubMarket: HubMarketData): Map<number, number> {
  const map = new Map<number, number>()
  if (!hubMarket.buyPrices) return map
  for (const [id, price] of Object.entries(hubMarket.buyPrices)) {
    map.set(Number(id), Number(price))
  }
  return map
}

export function filterBlueprints(
  blueprints: BlueprintInfo[],
  tier: BlueprintFilterTier,
  productGroup?: string,
): BlueprintInfo[] {
  let result = blueprints
  if (tier !== 'all') {
    result = result.filter((b) => b.tier === tier)
  }
  if (productGroup && productGroup !== 'all') {
    result = result.filter((b) => b.productGroup === productGroup)
  }
  return result
}

export interface ProductGroupEntry {
  name: string
  category: string
  iconTypeId: number
  /** Product type names in this group (for search). */
  itemNames: string[]
}

export interface ProductGroupCategoryNode {
  category: string
  groups: ProductGroupEntry[]
}

/** Product groups for a tier, nested under SDE category with a representative icon per group. */
export function buildProductGroupTree(
  blueprints: BlueprintInfo[],
  tier: BlueprintFilterTier,
  typeMap: Map<number, TypeInfo>,
): ProductGroupCategoryNode[] {
  const filtered = filterBlueprints(blueprints, tier)
  const byGroup = new Map<string, ProductGroupEntry>()
  const itemNamesByGroup = new Map<string, Set<string>>()

  for (const bp of filtered) {
    if (!isRankableBlueprint(bp, typeMap)) continue

    const type = typeMap.get(bp.productTypeId)
    const productName = type?.name

    if (!byGroup.has(bp.productGroup)) {
      byGroup.set(bp.productGroup, {
        name: bp.productGroup,
        category: type?.category ?? 'Other',
        iconTypeId: bp.productTypeId,
        itemNames: [],
      })
    }

    if (productName) {
      const names = itemNamesByGroup.get(bp.productGroup) ?? new Set<string>()
      names.add(productName)
      itemNamesByGroup.set(bp.productGroup, names)
    }
  }

  for (const [groupName, names] of itemNamesByGroup) {
    const entry = byGroup.get(groupName)
    if (entry) {
      entry.itemNames = [...names].sort((a, b) => a.localeCompare(b))
    }
  }

  const byCategory = new Map<string, ProductGroupEntry[]>()
  for (const entry of byGroup.values()) {
    const list = byCategory.get(entry.category) ?? []
    list.push(entry)
    byCategory.set(entry.category, list)
  }

  return [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, groups]) => ({
      category,
      groups: groups.sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

export function buildSkillMap(skills: SkillInfo[]): Map<number, SkillInfo> {
  return new Map(skills.map((s) => [s.skillId, s]))
}
