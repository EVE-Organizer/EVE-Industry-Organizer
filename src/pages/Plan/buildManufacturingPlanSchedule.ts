import {
  buildOwnerByProduct,
  buildSchedulerCharacters,
  planOwnerValidKeys,
  resolvePlanCharacters,
  settingsWithOwnerTimeSkills,
  sumPlanCrewSlots,
} from '@/lib/planCharacters'
import { expandManufacturingPlan } from '@/lib/manufacturingPlan'
import { activePlanRoots } from '@/lib/planRootEnabled'
import {
  effectivePlanSlots,
  planSlotBonusesFromManufacturingTemplate,
} from '@/lib/manufacturingSlots'
import { buildPlanPipeline } from '@/pages/Plan/planPipeline'
import { schedulePlanJobs, windowHoursFromJobs } from '@/pages/Plan/planScheduler'
import { simulatePlanFlow } from '@/pages/Plan/planSimulator'
import type {
  BlueprintInfo,
  GlobalSettings,
  ManufacturingPlanTemplate,
  SkillLevels,
  SystemInfo,
  TypeInfo,
} from '@/types'

function copyBposByProductFromTemplate(template: ManufacturingPlanTemplate): Map<number, number> {
  const map = new Map<number, number>()
  for (const [key, override] of Object.entries(template.nodeOverrides ?? {})) {
    if (override.copyBpos == null) continue
    map.set(Number(key), Math.max(1, Math.floor(override.copyBpos)))
  }
  return map
}

export type PlanSkillSources = {
  sso: Array<{
    characterId: number
    characterName: string
    skills?: SkillLevels
    trainedSkills?: SkillLevels
  }>
  manual: Array<{ id: string; name: string; skills: SkillLevels }>
}

export type BuildManufacturingPlanScheduleInput = {
  template: ManufacturingPlanTemplate
  blueprints: BlueprintInfo[]
  typeMap: Map<number, TypeInfo>
  prices: Map<number, number>
  settings: GlobalSettings
  systemCostIndex: number
  reactionCostIndex: number
  systems?: SystemInfo[]
  skillSources: PlanSkillSources
  includeSimulation?: boolean
}

/** Expand template demand and schedule jobs (same inputs as the plan hook). */
export function buildManufacturingPlanSchedule(input: BuildManufacturingPlanScheduleInput) {
  const {
    template,
    blueprints,
    typeMap,
    prices,
    settings,
    systemCostIndex,
    reactionCostIndex,
    systems,
    skillSources,
    includeSimulation = false,
  } = input

  const slotBonuses = planSlotBonusesFromManufacturingTemplate(template)
  const {
    manufacturing: mfgSlots,
    research: scienceSlots,
    reactions: reactionSlots,
  } = effectivePlanSlots(settings.skills, slotBonuses)

  if (activePlanRoots(template.roots).length === 0) {
    return {
      nodes: [],
      jobs: [],
      productionJobs: [],
      pipeline: null,
      simulations: new Map(),
      slots: mfgSlots,
      scienceSlots,
      reactionSlots,
      windowHours: 1,
      productionWindowHours: 1,
      missingPriceTypeIds: [] as number[],
      hasReliablePrices: true,
    }
  }

  const expandBase = {
    template,
    blueprints,
    typeMap,
    prices,
    settings,
    systemCostIndex,
    reactionCostIndex,
    systems,
  }

  const draftNodes = expandManufacturingPlan(expandBase).nodes
  const ownerValidKeys = planOwnerValidKeys(template, [
    ...skillSources.sso.map((c) => `sso:${c.characterId}` as const),
    ...skillSources.manual.map((c) => `manual:${c.id}` as const),
  ])
  const ownerByProduct = buildOwnerByProduct(
    draftNodes,
    template.roots,
    template.nodeOverrides,
    ownerValidKeys,
  )
  const settingsForProductTime = (productTypeId: number) => {
    const owner = ownerByProduct.get(productTypeId)
    if (!owner || owner === 'auto') return settings
    return settingsWithOwnerTimeSkills(settings, owner, skillSources)
  }

  const crewKeys = template.characters ?? []
  const resolvedCrew =
    crewKeys.length > 0
      ? resolvePlanCharacters({
          keys: crewKeys,
          sso: skillSources.sso,
          manual: skillSources.manual,
          settingsSkills: settings.skills,
          bonuses: template.characterSlotBonus,
        })
      : []
  const slotTotals =
    resolvedCrew.length > 0
      ? sumPlanCrewSlots(resolvedCrew)
      : effectivePlanSlots(settings.skills, slotBonuses)

  const expanded = expandManufacturingPlan({
    ...expandBase,
    settingsForProductTime,
    slotTotals,
  })
  const pipeline = buildPlanPipeline({
    nodes: expanded.nodes,
    blueprints,
    settings,
    scienceSlots: expanded.scienceSlots,
    manufacturingSlots: expanded.slots,
    reactionSlots: expanded.reactionSlots,
    settingsForProductTime,
  })

  const multiCharacterSchedule =
    resolvedCrew.length > 0
      ? (() => {
          const blueprintByProduct = new Map(blueprints.map((bp) => [bp.productTypeId, bp]))
          return {
            characters: buildSchedulerCharacters(
              resolvedCrew,
              settings.skills,
              blueprintByProduct,
              ownerByProduct,
            ),
            ownerByProduct,
          }
        })()
      : undefined

  const scheduleExtras = multiCharacterSchedule ?? {}
  const copyBposByProduct = copyBposByProductFromTemplate(template)
  const jobs = schedulePlanJobs({
    nodes: expanded.nodes,
    slots: expanded.slots,
    scienceSlots: expanded.scienceSlots,
    reactionSlots: expanded.reactionSlots,
    windowHours: Number.POSITIVE_INFINITY,
    pipeline,
    blueprints,
    copyBposByProduct,
    ...scheduleExtras,
  })
  const productionJobs = schedulePlanJobs({
    nodes: expanded.nodes,
    slots: expanded.slots,
    reactionSlots: expanded.reactionSlots,
    windowHours: Number.POSITIVE_INFINITY,
    blueprints,
    copyBposByProduct,
    ...scheduleExtras,
  })
  const windowHours = Math.max(1, windowHoursFromJobs(jobs))
  const productionWindowHours = Math.max(1, windowHoursFromJobs(productionJobs))
  const simulations = includeSimulation
    ? simulatePlanFlow({
        nodes: expanded.nodes,
        jobs,
        windowHours,
      })
    : new Map()

  return {
    nodes: expanded.nodes,
    jobs,
    productionJobs,
    pipeline,
    simulations,
    slots: expanded.slots,
    scienceSlots: expanded.scienceSlots,
    reactionSlots: expanded.reactionSlots,
    windowHours,
    productionWindowHours,
    missingPriceTypeIds: expanded.missingPriceTypeIds,
    hasReliablePrices: expanded.missingPriceTypeIds.length === 0,
  }
}
