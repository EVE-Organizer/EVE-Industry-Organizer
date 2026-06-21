/** Invention (T2) data from the SDE industry activity tables. */

const INVENTION_ACTIVITY = 8

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Build a map from a T2 blueprint typeId to the invention inputs that produce it.
 * - products (activity 8): T1 blueprint -> T2 blueprint, quantity = runs on the invented BPC
 * - materials (activity 8): datacores consumed per invention attempt (keyed by T1 blueprint)
 * - probabilities (activity 8): base success chance keyed by the produced T2 blueprint
 */
export function buildInventionMap({ products, materials, probabilities }) {
  const datacoresByT1 = new Map()
  for (const row of materials) {
    if (row.activityID !== String(INVENTION_ACTIVITY)) continue
    if (!datacoresByT1.has(row.typeID)) datacoresByT1.set(row.typeID, [])
    datacoresByT1.get(row.typeID).push({
      typeId: num(row.materialTypeID),
      quantity: num(row.quantity),
    })
  }

  const chanceByT2 = new Map()
  for (const row of probabilities) {
    if (row.activityID !== String(INVENTION_ACTIVITY)) continue
    chanceByT2.set(num(row.productTypeID), num(row.probability))
  }

  const byT2 = new Map()
  for (const row of products) {
    if (row.activityID !== String(INVENTION_ACTIVITY)) continue
    const t2BlueprintTypeId = num(row.productTypeID)
    byT2.set(t2BlueprintTypeId, {
      t1BlueprintTypeId: num(row.typeID),
      datacores: datacoresByT1.get(row.typeID) ?? [],
      runsPerBPC: num(row.quantity),
      baseChance: chanceByT2.get(t2BlueprintTypeId) ?? 0,
    })
  }

  return byT2
}
