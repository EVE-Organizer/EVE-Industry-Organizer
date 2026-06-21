import type { BlueprintInfo, GlobalSettings, SupplyChainNode, TypeInfo } from '@/types'
import { applyME, materialCost, totalManufacturingCost } from '@/lib/cost'
import { getBlueprintForProduct } from '@/services/data/sdeLoader'

const MINERAL_IDS = new Set([34, 35, 36, 37, 38, 39, 40])

export function isRawMaterial(typeId: number): boolean {
  return MINERAL_IDS.has(typeId)
}

export function buildSupplyChain(
  blueprint: BlueprintInfo,
  blueprints: BlueprintInfo[],
  typeMap: Map<number, TypeInfo>,
  prices: Map<number, number>,
  settings: GlobalSettings,
  me: number,
  systemCostIndex: number,
  depth = 0,
  maxDepth = 10,
  modeOverrides: Map<number, 'buy' | 'build'> = new Map(),
): SupplyChainNode {
  const runs = settings.batchSize
  const mats = applyME(blueprint.materials, me, runs)
  const product = typeMap.get(blueprint.productTypeId)
  const productPrice = prices.get(blueprint.productTypeId) ?? 0
  const buyTotal = materialCost(mats, prices)
  const { capital: buildTotal } = totalManufacturingCost(blueprint, prices, settings, me, systemCostIndex)

  const children: SupplyChainNode[] = mats.map((mat) => {
    const type = typeMap.get(mat.typeId)
    const unitPrice = prices.get(mat.typeId) ?? 0
    const buyCost = unitPrice * mat.quantity
    const subBp = getBlueprintForProduct(blueprints, mat.typeId)

    if (!subBp || isRawMaterial(mat.typeId) || depth >= maxDepth) {
      return {
        typeId: mat.typeId,
        name: type?.name ?? `Type ${mat.typeId}`,
        quantity: mat.quantity,
        unitPrice,
        totalCost: buyCost,
        mode: 'buy' as const,
        buyCost,
        isLeaf: true,
        depth: depth + 1,
      }
    }

    const subChain = buildSupplyChain(
      subBp,
      blueprints,
      typeMap,
      prices,
      settings,
      me,
      systemCostIndex,
      depth + 1,
      maxDepth,
      modeOverrides,
    )
    const override = modeOverrides.get(mat.typeId)
    const smartMode: 'buy' | 'build' =
      override ?? (subChain.totalCost <= buyCost ? 'build' : 'buy')
    const totalCost = smartMode === 'build' ? subChain.totalCost : buyCost

    return {
      typeId: mat.typeId,
      name: type?.name ?? subBp.productTypeId.toString(),
      quantity: mat.quantity,
      unitPrice,
      totalCost,
      mode: smartMode,
      buildCost: subChain.totalCost,
      buyCost,
      savings: buyCost - subChain.totalCost,
      children: subChain.children,
      isLeaf: false,
      depth: depth + 1,
    }
  })

  const rolledUp = children.reduce((s, c) => s + c.totalCost, 0) + (depth === 0 ? 0 : 0)
  const jobPart = depth === 0 ? buildTotal - buyTotal : 0

  const blueprintChild: SupplyChainNode | null =
    depth === 0
      ? {
          typeId: blueprint.blueprintTypeId,
          graphId: `bpo-${blueprint.blueprintTypeId}`,
          name: typeMap.get(blueprint.blueprintTypeId)?.name ?? 'Blueprint',
          quantity: 1,
          unitPrice: prices.get(blueprint.blueprintTypeId) ?? 0,
          totalCost: prices.get(blueprint.blueprintTypeId) ?? 0,
          mode: 'blueprint',
          isLeaf: true,
          depth: depth + 1,
          productTypeId: blueprint.productTypeId,
        }
      : null

  const allChildren =
    depth === 0 && blueprintChild ? [blueprintChild, ...children] : children

  return {
    typeId: blueprint.productTypeId,
    name: product?.name ?? 'Product',
    quantity: blueprint.productQuantity * runs,
    unitPrice: productPrice,
    totalCost: rolledUp + buyTotal + jobPart,
    mode: 'build',
    buildCost: buildTotal,
    buyCost: blueprint.productQuantity * runs * productPrice,
    children: allChildren,
    isLeaf: false,
    depth,
  }
}

export function flattenShoppingList(node: SupplyChainNode, list: Map<number, { name: string; qty: number; cost: number }> = new Map()): Map<number, { name: string; qty: number; cost: number }> {
  if (node.mode === 'blueprint') {
    if (node.totalCost > 0) {
      list.set(node.typeId, { name: node.name, qty: node.quantity, cost: node.totalCost })
    }
    return list
  }
  if (node.mode === 'buy' || node.isLeaf) {
    const existing = list.get(node.typeId)
    if (existing) {
      existing.qty += node.quantity
      existing.cost += node.totalCost
    } else {
      list.set(node.typeId, { name: node.name, qty: node.quantity, cost: node.totalCost })
    }
    return list
  }
  node.children?.forEach((c) => flattenShoppingList(c, list))
  return list
}

export function summarizeRawMaterials(node: SupplyChainNode): SupplyChainNode[] {
  const leaves: SupplyChainNode[] = []
  function walk(n: SupplyChainNode) {
    if (n.mode === 'blueprint') return
    if (n.isLeaf || n.mode === 'buy') leaves.push(n)
    else n.children?.forEach(walk)
  }
  walk(node)
  return leaves
}

export function shoppingListText(list: Map<number, { name: string; qty: number; cost: number }>): string {
  return [...list.values()]
    .map((i) => `${i.name}: ${i.qty.toLocaleString()} (${i.cost.toLocaleString()} ISK)`)
    .join('\n')
}
