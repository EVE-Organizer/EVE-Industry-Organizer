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

export function buildRegionMap(regions: RegionsData): Map<number, RegionInfo> {
  return new Map(regions.regions.map((r) => [r.regionId, r]))
}

export function getAllBlueprints(registry: BlueprintRegistry): BlueprintInfo[] {
  return registry.blueprints
}

export function getBlueprintByProductId(
  registry: BlueprintRegistry,
  productTypeId: number,
): BlueprintInfo | undefined {
  return registry.blueprints.find((b) => b.productTypeId === productTypeId)
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

export function buildBlueprintMap(blueprints: BlueprintInfo[]): Map<number, BlueprintInfo> {
  const byProduct = new Map<number, BlueprintInfo>()
  const byBpo = new Map<number, BlueprintInfo>()
  for (const bp of blueprints) {
    byProduct.set(bp.productTypeId, bp)
    byBpo.set(bp.blueprintTypeId, bp)
  }
  return new Map([...byProduct, ...byBpo])
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

export function getProductGroups(blueprints: BlueprintInfo[]): string[] {
  return [...new Set(blueprints.map((b) => b.productGroup))].sort()
}

export function getProductGroupsForTier(
  blueprints: BlueprintInfo[],
  tier: BlueprintFilterTier,
): string[] {
  return buildProductGroupTree(blueprints, tier, new Map()).flatMap((node) =>
    node.groups.map((g) => g.name),
  )
}

export interface ProductGroupEntry {
  name: string
  category: string
  iconTypeId: number
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

  for (const bp of filtered) {
    if (byGroup.has(bp.productGroup)) continue
    const type = typeMap.get(bp.productTypeId)
    byGroup.set(bp.productGroup, {
      name: bp.productGroup,
      category: type?.category ?? 'Other',
      iconTypeId: bp.productTypeId,
    })
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

export function getSkillByName(skills: SkillInfo[], name: string): SkillInfo | undefined {
  return skills.find((s) => s.name.toLowerCase() === name.toLowerCase())
}
