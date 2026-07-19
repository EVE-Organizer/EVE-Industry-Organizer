import type { BlueprintInfo, ManufacturingSettings, SupplyChainNode, TypeInfo } from '@/types'
import {
  applyME,
  materialCost,
  resolveBlueprintMeTe,
  totalManufacturingCost,
} from '@/lib/cost'
import { resolveRecipeModifiers } from '@/lib/facilityModifiers'
import { canRunReactionJobs, isReactionRecipe } from '@/lib/recipes'
import { runsForDemand } from '@/lib/rootRunsDuration'
import { getBlueprintForProduct } from '@/services/data/sdeLoader'

const MINERAL_IDS = new Set([34, 35, 36, 37, 38, 39, 40])

export interface BuildTargetMaterial {
  typeId: number
  name: string
  quantity: number
}

export interface BuildTargetDetail {
  productTypeId: number
  productName: string
  blueprint: BlueprintInfo
  /** Source material quantity per run (raw recipe). */
  sourceInputQty: number
  /** Product units per run (raw recipe). */
  outputQty: number
  /** Base manufacturing time per run in seconds. */
  jobTimeSeconds: number
  otherMaterials: BuildTargetMaterial[]
}

export function isRawMaterial(typeId: number): boolean {
  return MINERAL_IDS.has(typeId)
}

/** Downstream products that consume `materialTypeId`, with per-run recipe info. */
export function findBuildTargetDetails(
  blueprints: BlueprintInfo[],
  materialTypeId: number,
  typeMap: Map<number, TypeInfo>,
): BuildTargetDetail[] {
  const results: BuildTargetDetail[] = []

  for (const bp of blueprints) {
    const sourceMat = bp.materials.find((m) => m.typeId === materialTypeId)
    if (!sourceMat) continue

    const otherMaterials = bp.materials
      .filter((m) => m.typeId !== materialTypeId)
      .map((m) => ({
        typeId: m.typeId,
        name: typeMap.get(m.typeId)?.name ?? `Type ${m.typeId}`,
        quantity: m.quantity,
      }))

    results.push({
      productTypeId: bp.productTypeId,
      productName: typeMap.get(bp.productTypeId)?.name ?? `Type ${bp.productTypeId}`,
      blueprint: bp,
      sourceInputQty: sourceMat.quantity,
      outputQty: bp.productQuantity,
      jobTimeSeconds: bp.manufacturingTime,
      otherMaterials,
    })
  }

  return results.sort((a, b) => a.productName.localeCompare(b.productName))
}

function buyLeaf(
  mat: { typeId: number; quantity: number },
  typeMap: Map<number, TypeInfo>,
  prices: Map<number, number>,
  depth: number,
): SupplyChainNode {
  const unitPrice = prices.get(mat.typeId) ?? 0
  const buyCost = unitPrice * mat.quantity
  return {
    typeId: mat.typeId,
    name: typeMap.get(mat.typeId)?.name ?? `Type ${mat.typeId}`,
    quantity: mat.quantity,
    unitPrice,
    totalCost: buyCost,
    mode: 'buy',
    buyCost,
    isLeaf: true,
    depth: depth + 1,
  }
}

export function buildSupplyChain(
  blueprint: BlueprintInfo,
  blueprints: BlueprintInfo[],
  typeMap: Map<number, TypeInfo>,
  prices: Map<number, number>,
  settings: ManufacturingSettings,
  me: number,
  systemCostIndex: number,
  depth = 0,
  maxDepth = 10,
  modeOverrides: Map<number, 'buy' | 'build'> = new Map(),
  reactionCostIndex = systemCostIndex,
): SupplyChainNode {
  const runs = settings.batchSize
  const structure = resolveRecipeModifiers(settings, blueprint)
  const effectiveMe = isReactionRecipe(blueprint) ? 0 : me
  const mats = applyME(blueprint.materials, effectiveMe, runs, structure.meBonusPercent)
  const product = typeMap.get(blueprint.productTypeId)
  const productPrice = prices.get(blueprint.productTypeId) ?? 0
  const buyTotal = materialCost(mats, prices)
  const { capital: buildTotal } = totalManufacturingCost(
    blueprint,
    prices,
    settings,
    effectiveMe,
    systemCostIndex,
    reactionCostIndex,
  )

  const children: SupplyChainNode[] = mats.map((mat) => {
    if (mat.typeId === blueprint.productTypeId) {
      return buyLeaf(mat, typeMap, prices, depth)
    }

    const type = typeMap.get(mat.typeId)
    const unitPrice = prices.get(mat.typeId) ?? 0
    const buyCost = unitPrice * mat.quantity
    const subBp = getBlueprintForProduct(blueprints, mat.typeId)

    if (!subBp || isRawMaterial(mat.typeId) || depth >= maxDepth) {
      return buyLeaf(mat, typeMap, prices, depth)
    }

    if (isReactionRecipe(subBp) && !canRunReactionJobs(settings)) {
      return buyLeaf(mat, typeMap, prices, depth)
    }

    const subRuns = runsForDemand(subBp.productQuantity, mat.quantity)
    const subMe = resolveBlueprintMeTe(subBp.tier, settings, undefined, subBp).me
    const subChain = buildSupplyChain(
      subBp,
      blueprints,
      typeMap,
      prices,
      { ...settings, batchSize: subRuns },
      subMe,
      systemCostIndex,
      depth + 1,
      maxDepth,
      modeOverrides,
      reactionCostIndex,
    )
    const override = modeOverrides.get(mat.typeId)
    const smartMode: 'buy' | 'build' =
      override ?? (subChain.totalCost <= buyCost ? 'build' : 'buy')
    const totalCost = smartMode === 'build' ? subChain.totalCost : buyCost
    const nodeMode = smartMode === 'build' && isReactionRecipe(subBp) ? 'react' : smartMode

    return {
      typeId: mat.typeId,
      name: type?.name ?? subBp.productTypeId.toString(),
      quantity: mat.quantity,
      unitPrice,
      totalCost,
      mode: nodeMode,
      buildCost: subChain.totalCost,
      buyCost,
      savings: buyCost - subChain.totalCost,
      children: subChain.children,
      isLeaf: false,
      depth: depth + 1,
    }
  })

  const rolledUp = children.reduce((s, c) => s + c.totalCost, 0)
  const jobPart = buildTotal - buyTotal

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

  const rootMode = isReactionRecipe(blueprint) ? 'react' : 'build'

  return {
    typeId: blueprint.productTypeId,
    name: product?.name ?? 'Product',
    quantity: blueprint.productQuantity * runs,
    unitPrice: productPrice,
    totalCost: rolledUp + jobPart,
    mode: rootMode,
    buildCost: buildTotal,
    buyCost: blueprint.productQuantity * runs * productPrice,
    children: allChildren,
    isLeaf: false,
    depth,
  }
}
