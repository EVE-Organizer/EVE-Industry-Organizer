/** Build manufacturing and reaction recipe records from SDE industry tables. */

import {
  blueprintIconUrl,
  typeIconUrl,
  typeRenderUrl,
} from './eve-image-urls.mjs'
import { classifyTier, isPlaceholderManufacturingRecipe } from './blueprint-groups.mjs'
import { buildInventionMap } from './invention.mjs'

export const MANUFACTURING_ACTIVITY = 1
export const COPYING_ACTIVITY = 5
export const INVENTION_ACTIVITY = 8
export const REACTION_ACTIVITY = 11

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Map SDE formula group name to reaction family. */
export function reactionFamilyFromGroup(groupName) {
  if (!groupName) return undefined
  if (groupName.includes('Composite')) return 'composite'
  if (groupName.includes('Biochemical')) return 'biochemical'
  if (groupName.includes('Polymer')) return 'polymer'
  if (groupName.includes('Molecular')) return 'molecular'
  return undefined
}

function indexActivityRows(rows, activityId) {
  const id = String(activityId)
  const timeByBlueprint = new Map()
  const materialsByBlueprint = new Map()
  const skillsByBlueprint = new Map()

  for (const row of rows.activity) {
    if (row.activityID !== id) continue
    timeByBlueprint.set(row.typeID, num(row.time))
  }

  for (const row of rows.materials) {
    if (row.activityID !== id) continue
    if (!materialsByBlueprint.has(row.typeID)) materialsByBlueprint.set(row.typeID, [])
    materialsByBlueprint.get(row.typeID).push({
      typeId: num(row.materialTypeID),
      quantity: num(row.quantity),
    })
  }

  for (const row of rows.skills) {
    if (row.activityID !== id) continue
    const skillName = rows.skillNames.get(num(row.skillID))
    if (!skillName) continue
    if (!skillsByBlueprint.has(row.typeID)) skillsByBlueprint.set(row.typeID, {})
    skillsByBlueprint.get(row.typeID)[skillName] = num(row.level)
  }

  return { timeByBlueprint, materialsByBlueprint, skillsByBlueprint }
}

function buildRecipesForActivity(tables, activityId, kind) {
  const { products, types, groups, metaTypes, skillNames } = tables
  const inventionByT2 = kind === 'manufacturing'
    ? buildInventionMap({
        products: tables.products,
        materials: tables.materials,
        probabilities: tables.probabilities,
        skills: tables.skills,
        skillNames,
      })
    : new Map()

  const typeById = new Map(types.map((type) => [type.typeID, type]))
  const groupById = new Map(groups.map((group) => [group.groupID, group]))
  const metaByProduct = new Map(metaTypes.map((meta) => [meta.typeID, num(meta.metaGroupID)]))

  const indexed = indexActivityRows(
    { activity: tables.activity, materials: tables.materials, skills: tables.skills, skillNames },
    activityId,
  )

  // Copy (5) and invention (8) times are keyed by blueprint type ID.
  const copyTimes =
    kind === 'manufacturing'
      ? indexActivityRows(
          { activity: tables.activity, materials: [], skills: [], skillNames },
          COPYING_ACTIVITY,
        ).timeByBlueprint
      : new Map()
  const inventionTimes =
    kind === 'manufacturing'
      ? indexActivityRows(
          { activity: tables.activity, materials: [], skills: [], skillNames },
          INVENTION_ACTIVITY,
        ).timeByBlueprint
      : new Map()

  const recipes = []
  for (const row of products) {
    if (row.activityID !== String(activityId)) continue

    const blueprintTypeId = num(row.typeID)
    const productTypeId = num(row.productTypeID)
    const product = typeById.get(String(productTypeId))
    if (!product || product.published !== '1') continue

    const productGroup = groupById.get(product.groupID)
    if (!productGroup) continue

    const recipeMaterials = indexed.materialsByBlueprint.get(row.typeID) ?? []
    if (kind === 'manufacturing' && isPlaceholderManufacturingRecipe(recipeMaterials)) continue

    const formulaType = typeById.get(String(blueprintTypeId))
    const formulaGroupName = formulaType
      ? groupById.get(formulaType.groupID)?.groupName
      : undefined

    const metaGroupId = metaByProduct.get(String(productTypeId)) ?? 1
    const tier = kind === 'reaction' ? 't1' : classifyTier(metaGroupId)
    const inventionBase = tier === 't2' ? inventionByT2.get(blueprintTypeId) : undefined
    const t1BpId = inventionBase?.t1BlueprintTypeId
    const invention = inventionBase
      ? {
          ...inventionBase,
          // Copy + invent run on the T1 BPO/BPC, not the T2 product BPO.
          copyTime: t1BpId != null ? (copyTimes.get(String(t1BpId)) ?? 0) : 0,
          inventionTime: t1BpId != null ? (inventionTimes.get(String(t1BpId)) ?? 0) : 0,
        }
      : undefined

    const copyTime = copyTimes.get(row.typeID)
    const inventionTime = inventionTimes.get(row.typeID)

    recipes.push({
      blueprintTypeId,
      productTypeId,
      productQuantity: num(row.quantity),
      manufacturingTime: indexed.timeByBlueprint.get(row.typeID) ?? 0,
      materials: recipeMaterials,
      requiredSkills: indexed.skillsByBlueprint.get(row.typeID) ?? {},
      tier,
      kind,
      productGroup: productGroup.groupName,
      bpIconUrl: blueprintIconUrl(blueprintTypeId),
      productIconUrl: typeIconUrl(productTypeId),
      productRenderUrl: typeRenderUrl(productTypeId),
      ...(copyTime != null && copyTime > 0 ? { copyTime } : {}),
      ...(inventionTime != null && inventionTime > 0 ? { inventionTime } : {}),
      ...(kind === 'reaction'
        ? { reactionFamily: reactionFamilyFromGroup(formulaGroupName) }
        : {}),
      ...(invention ? { invention } : {}),
    })
  }

  return recipes
}

export function buildBlueprintRecords(tables) {
  const manufacturing = buildRecipesForActivity(tables, MANUFACTURING_ACTIVITY, 'manufacturing')
  const reactions = buildRecipesForActivity(tables, REACTION_ACTIVITY, 'reaction')
  const blueprints = [...manufacturing, ...reactions].sort(
    (a, b) => a.productTypeId - b.productTypeId,
  )

  const typeById = new Map(tables.types.map((type) => [type.typeID, type]))
  const groupById = new Map(tables.groups.map((group) => [group.groupID, group]))
  const categoryById = new Map(
    tables.categories.map((category) => [category.categoryID, category.categoryName]),
  )

  return { blueprints, typeById, groupById, categoryById }
}
