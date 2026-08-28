/**
 * Research / manufacturing pipeline stages derived from an expanded plan.
 * Science pool: copy → invention. Manufacturing pool: manufacture + reaction.
 */
import { applyCopyTime, applyInventionTime, inventionBlueprintCostForSettings } from '@/lib/cost'
import { resolveScienceModifiers } from '@/lib/facilityModifiers'
import { isReactionRecipe } from '@/lib/recipes'
import { defaultScienceFacility } from '@/types'
import type {
  BlueprintInfo,
  GlobalSettings,
  PlanJobActivity,
  PlanJobPool,
  PlanNode,
} from '@/types'
import { getBlueprintForProduct } from '@/services/data/sdeLoader'

export interface PlanPipelineStage {
  id: string
  productTypeId: number
  name: string
  activity: PlanJobActivity
  pool: PlanJobPool
  /** Job runs / invention attempts. */
  runs: number
  /** One copy job or one invention attempt (hours). Packed across science slots. */
  durationHours: number
  /** Stages that must finish before this one can start. */
  dependsOn: string[]
  blueprintTypeId?: number
  datacoreTypeIds?: number[]
}

export interface PlanPipeline {
  stages: PlanPipelineStage[]
  scienceSlots: number
  manufacturingSlots: number
}

export interface BuildPlanPipelineInput {
  nodes: PlanNode[]
  blueprints: BlueprintInfo[]
  settings: GlobalSettings
  scienceSlots: number
  manufacturingSlots: number
}

function inventionAttempts(
  blueprint: BlueprintInfo,
  manufactureRuns: number,
  settings: GlobalSettings,
  prices: Map<number, number>,
): number {
  const inv = blueprint.invention
  if (!inv) return 0
  const invCost = inventionBlueprintCostForSettings({
    blueprint,
    settings,
    prices,
  })
  if (!invCost) return 0
  return Math.max(1, Math.ceil(manufactureRuns / Math.max(1, invCost.expectedRunsPerAttempt)))
}

/** Build ordered pipeline stages for build-mode nodes (skip buy roots / buy leaves). */
export function buildPlanPipeline(input: BuildPlanPipelineInput): PlanPipeline {
  const { nodes, blueprints, settings, scienceSlots, manufacturingSlots } = input
  const prices = new Map<number, number>()
  for (const node of nodes) {
    if (node.unitPrice != null) prices.set(node.productTypeId, node.unitPrice)
  }

  const stages: PlanPipelineStage[] = []
  const buildNodes = nodes.filter((n) => n.mode === 'build' && n.runs > 0)

  for (const node of buildNodes) {
    const blueprint = getBlueprintForProduct(blueprints, node.productTypeId)
    if (!blueprint) continue

    const mfgId = `mfg-${node.productTypeId}`
    const dependsOn: string[] = []

    const invent =
      blueprint.tier === 't2' &&
      blueprint.invention &&
      node.mode === 'build'

    if (invent && blueprint.invention) {
      const attempts = inventionAttempts(blueprint, node.runs, settings, prices)
      const copySeconds = blueprint.invention.copyTime ?? 0
      const inventSeconds = blueprint.invention.inventionTime ?? 0
      const copyMods = resolveScienceModifiers(
        settings.copyFacility ?? defaultScienceFacility(settings.manufacturingSystemId),
      )
      const inventMods = resolveScienceModifiers(
        settings.inventionFacility ?? defaultScienceFacility(settings.manufacturingSystemId),
      )
      const advancedIndustry = settings.skills.advancedIndustry ?? 0
      const science = settings.skills.science ?? 0
      const copyId = `copy-${node.productTypeId}`
      const inventId = `invent-${node.productTypeId}`

      if (copySeconds > 0 && attempts > 0) {
        stages.push({
          id: copyId,
          productTypeId: node.productTypeId,
          name: `${node.name} (copy)`,
          activity: 'copy',
          pool: 'science',
          runs: attempts,
          durationHours:
            applyCopyTime(copySeconds, 1, science, advancedIndustry, copyMods.teBonusPercent) /
            3600,
          dependsOn: [],
          blueprintTypeId: blueprint.invention.t1BlueprintTypeId,
        })
        dependsOn.push(copyId)
      }

      if (inventSeconds > 0 && attempts > 0) {
        stages.push({
          id: inventId,
          productTypeId: node.productTypeId,
          name: `${node.name} (invention)`,
          activity: 'invention',
          pool: 'science',
          runs: attempts,
          durationHours:
            applyInventionTime(inventSeconds, 1, advancedIndustry, inventMods.teBonusPercent) /
            3600,
          dependsOn: copySeconds > 0 ? [copyId] : [],
          blueprintTypeId: blueprint.invention.t1BlueprintTypeId,
          datacoreTypeIds: blueprint.invention.datacores.map((d) => d.typeId),
        })
        dependsOn.push(inventId)
      }
    }

    // Child build products must finish before this manufacture (material deps).
    for (const childId of node.childProductTypeIds) {
      const child = nodes.find((n) => n.productTypeId === childId)
      if (child?.mode === 'build' && child.runs > 0) {
        dependsOn.push(`mfg-${childId}`)
      }
    }

    const activity: PlanJobActivity = isReactionRecipe(blueprint) ? 'reaction' : 'manufacture'
    stages.push({
      id: mfgId,
      productTypeId: node.productTypeId,
      name: node.name,
      activity,
      pool: 'manufacturing',
      runs: node.runs,
      durationHours: node.jobTimeSeconds / 3600,
      dependsOn,
      blueprintTypeId: blueprint.blueprintTypeId,
    })
  }

  return { stages, scienceSlots, manufacturingSlots }
}
