const ME_BONUS = 0.01
const TE_BONUS = 0.04

export function applyME(materials, me, runs) {
  const factor = 1 - me * ME_BONUS
  return materials.map((m) => ({
    typeId: m.typeId,
    quantity: Math.max(1, Math.ceil(m.quantity * runs * factor)),
  }))
}

export function applyTE(baseTimeSeconds, te, runs, advancedIndustry = 0) {
  const teFactor = 1 - te * TE_BONUS
  const advFactor = 1 - advancedIndustry * 0.03
  return baseTimeSeconds * runs * teFactor * advFactor
}

export function materialCost(materials, prices) {
  return materials.reduce((sum, m) => sum + (prices.get(m.typeId) ?? 0) * m.quantity, 0)
}

export function estimateJobCost(materialCostIsk, systemCostIndex, structureTax = 0) {
  return materialCostIsk * systemCostIndex * (1 + structureTax)
}

export function totalManufacturingCost(blueprint, prices, settings, me, systemCostIndex, advancedIndustry = 0) {
  const runs = settings.batchSize
  const mats = applyME(blueprint.materials, me, runs)
  const matCost = materialCost(mats, prices)
  const jobCost = estimateJobCost(matCost, systemCostIndex)
  const jobTime = applyTE(blueprint.manufacturingTime, settings.teDefault, runs, advancedIndustry)
  return { materialCost: matCost, jobCost, capital: matCost + jobCost, jobTime }
}

export function revenueFromSale(productPrice, productQty, settings) {
  const gross = productPrice * productQty
  const brokerFee = gross * (settings.brokerFeePercent / 100)
  const afterBroker = gross - brokerFee
  const salesTax = afterBroker * (settings.salesTaxPercent / 100)
  return { gross, net: afterBroker - salesTax, brokerFee, salesTax }
}

export function profitPerBatch(blueprint, prices, settings, me, systemCostIndex) {
  const productPrice = prices.get(blueprint.productTypeId) ?? 0
  const { capital } = totalManufacturingCost(blueprint, prices, settings, me, systemCostIndex)
  const outputQty = blueprint.productQuantity * settings.batchSize
  const { net } = revenueFromSale(productPrice, outputQty, settings)
  return net - capital
}

/** Spot margin for ranking only: raw blueprint materials, no ME or TE. */
export function spotProfitPerBatch(blueprint, prices, settings, systemCostIndex) {
  const runs = settings.batchSize
  const mats = blueprint.materials.map((m) => ({
    typeId: m.typeId,
    quantity: Math.max(1, Math.ceil(m.quantity * runs)),
  }))
  const matCost = materialCost(mats, prices)
  const capital = matCost + estimateJobCost(matCost, systemCostIndex)
  const productPrice = prices.get(blueprint.productTypeId) ?? 0
  const outputQty = blueprint.productQuantity * runs
  const { net } = revenueFromSale(productPrice, outputQty, settings)
  return net - capital
}
