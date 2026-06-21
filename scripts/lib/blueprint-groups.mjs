/** SDE-driven tier classification for manufacturing blueprints. */

export const TIERS = ['t1', 't2', 'faction']

/** Storyline, faction, officer, deadspace → faction tier. */
export const FACTION_TIER_META_GROUP_IDS = new Set([3, 4, 5, 6])

export function classifyTier(metaGroupId) {
  if (metaGroupId === 2) return 't2'
  if (FACTION_TIER_META_GROUP_IDS.has(metaGroupId)) return 'faction'
  return 't1'
}

/** CCP placeholder recipes (e.g. Praxis, Gnosis): 1 Tritanium, not player manufacturing. */
export function isPlaceholderManufacturingRecipe(materials) {
  return (
    materials?.length === 1 &&
    materials[0].typeId === 34 &&
    materials[0].quantity === 1
  )
}

export function buildAttributesByType(typeAttributes) {
  const attrsByType = new Map()
  for (const row of typeAttributes) {
    if (!attrsByType.has(row.typeID)) attrsByType.set(row.typeID, new Map())
    attrsByType.get(row.typeID).set(row.attributeID, row)
  }
  return attrsByType
}
