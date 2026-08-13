import type {
  BlueprintTier,
  BlueprintInfo,
  BlueprintRegistry,
  ContractsData,
  HubId,
  HubMarketData,
  MarketData,
  RecipeKind,
  RegionInfo,
  RegionsData,
  SkillInfo,
  SystemInfo,
  TypeInfo,
} from '@/types'
import { DEFAULT_RECIPE_KINDS } from '@/types'
import { publicDataUrl } from '@/lib/paths'

export interface SdeData {
  types: TypeInfo[]
  registry: BlueprintRegistry
  market: MarketData
  contracts: ContractsData
  regions: RegionsData
  skills: SkillInfo[]
  systems: SystemInfo[]
}

let cache: SdeData | null = null

export async function loadSdeData(): Promise<SdeData> {
  if (cache) return cache
  const [typesRaw, registry, market, contracts, regions, skills, systems] = await Promise.all([
    fetch(publicDataUrl('types.json')).then((r) => r.json()),
    fetch(publicDataUrl('blueprints.json')).then((r) => r.json()),
    fetch(publicDataUrl('market.json')).then((r) => r.json()),
    fetch(publicDataUrl('contracts.json'))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(publicDataUrl('regions.json')).then((r) => r.json()),
    fetch(publicDataUrl('skills.json')).then((r) => r.json()),
    fetch(publicDataUrl('systems.json')).then((r) => r.json()),
  ])
  const types: TypeInfo[] = Array.isArray(typesRaw) ? typesRaw : typesRaw.types
  cache = {
    types,
    registry,
    market,
    contracts: contracts ?? { generatedAt: '', hubs: {} },
    regions,
    skills,
    systems,
  }
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

export function recipeKindOf(blueprint: BlueprintInfo): RecipeKind {
  return blueprint.kind ?? 'manufacturing'
}

export function filterByRecipeKinds(
  blueprints: BlueprintInfo[],
  recipeKinds?: RecipeKind[],
): BlueprintInfo[] {
  const kinds = recipeKinds?.length ? recipeKinds : DEFAULT_RECIPE_KINDS
  if (kinds.length >= DEFAULT_RECIPE_KINDS.length) return blueprints
  const allowed = new Set(kinds)
  return blueprints.filter((b) => allowed.has(recipeKindOf(b)))
}

export function buildRegionMap(regions: RegionsData): Map<number, RegionInfo> {
  return new Map(regions.regions.map((r) => [r.regionId, r]))
}

/**
 * Resolve build system and manufacturing / reaction cost indices.
 * Falls back: system -> region -> hub market; reaction falls back to manufacturing.
 */
export function resolveBuildSystem(
  systems: SystemInfo[],
  regions: RegionsData,
  hubMarket: HubMarketData,
  manufacturingSystemId: number,
): { buildSystemId: number; costIndex: number; reactionCostIndex: number } {
  const system = systems.find((s) => s.systemId === manufacturingSystemId)
  const region = system
    ? regions.regions.find((r) => r.regionId === system.regionId)
    : undefined

  if (system) {
    const costIndex = system.costIndex ?? region?.costIndex ?? hubMarket.costIndex
    const reactionCostIndex =
      system.reactionCostIndex ??
      region?.reactionCostIndex ??
      hubMarket.reactionCostIndex ??
      costIndex
    return { buildSystemId: manufacturingSystemId, costIndex, reactionCostIndex }
  }

  const costIndex = hubMarket.costIndex
  return {
    buildSystemId: manufacturingSystemId,
    costIndex,
    reactionCostIndex: hubMarket.reactionCostIndex ?? costIndex,
  }
}

export function resolveCostIndexForKind(
  resolved: { costIndex: number; reactionCostIndex: number },
  kind: RecipeKind,
): number {
  return kind === 'reaction' ? resolved.reactionCostIndex : resolved.costIndex
}

export function getAllBlueprints(registry: BlueprintRegistry): BlueprintInfo[] {
  return registry.blueprints
}

export function getBlueprintForProduct(
  blueprints: BlueprintInfo[],
  productTypeId: number,
): BlueprintInfo | undefined {
  const id = Number(productTypeId)
  if (!Number.isFinite(id)) return undefined
  return blueprints.find((b) => b.productTypeId === id)
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
  tiers: BlueprintTier[],
  productGroups?: string[],
  options?: { recipeKinds?: RecipeKind[] },
): BlueprintInfo[] {
  let result = filterByRecipeKinds(blueprints, options?.recipeKinds)
  if (tiers.length > 0) {
    const allowed = new Set(tiers)
    result = result.filter((b) => allowed.has(b.tier))
  }
  if (productGroups && productGroups.length > 0) {
    const allowed = new Set(productGroups)
    result = result.filter((b) => allowed.has(b.productGroup))
  }
  return result
}

export interface ProductGroupEntry {
  name: string
  category: string
  iconTypeId: number
  /** Product type names in this group (for search). */
  itemNames: string[]
  /** Recipe types present in this group (manufacturing BPO and/or reaction formula). */
  recipeKinds: RecipeKind[]
}

export interface ProductGroupCategoryNode {
  category: string
  groups: ProductGroupEntry[]
}

/** Product groups for a tier, nested under SDE category with a representative icon per group. */
export function buildProductGroupTree(
  blueprints: BlueprintInfo[],
  tiers: BlueprintTier[],
  typeMap: Map<number, TypeInfo>,
  recipeKinds?: RecipeKind[],
): ProductGroupCategoryNode[] {
  const filtered = filterBlueprints(blueprints, tiers, undefined, { recipeKinds })
  const byGroup = new Map<string, ProductGroupEntry>()
  const itemNamesByGroup = new Map<string, Set<string>>()
  const kindsByGroup = new Map<string, Set<RecipeKind>>()

  for (const bp of filtered) {
    if (!isRankableBlueprint(bp, typeMap)) continue

    const type = typeMap.get(bp.productTypeId)
    const productName = type?.name
    const kind = recipeKindOf(bp)

    const kinds = kindsByGroup.get(bp.productGroup) ?? new Set<RecipeKind>()
    kinds.add(kind)
    kindsByGroup.set(bp.productGroup, kinds)

    if (!byGroup.has(bp.productGroup)) {
      byGroup.set(bp.productGroup, {
        name: bp.productGroup,
        category: type?.category ?? 'Other',
        iconTypeId: bp.productTypeId,
        itemNames: [],
        recipeKinds: [],
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

  for (const [groupName, entry] of byGroup) {
    const kinds = kindsByGroup.get(groupName)
    entry.recipeKinds = kinds ? [...kinds].sort() : []
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

export function findProductGroupEntry(
  tree: ProductGroupCategoryNode[],
  groupName: string,
): ProductGroupEntry | undefined {
  for (const node of tree) {
    const entry = node.groups.find((g) => g.name === groupName)
    if (entry) return entry
  }
  return undefined
}

export function buildSkillMap(skills: SkillInfo[]): Map<number, SkillInfo> {
  return new Map(skills.map((s) => [s.skillId, s]))
}

export function buildSkillNameMap(skills: SkillInfo[]): Map<string, SkillInfo> {
  return new Map(skills.map((s) => [s.name, s]))
}
