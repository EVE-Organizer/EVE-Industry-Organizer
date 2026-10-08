import { useMemo } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import {
  buildOwnerByProduct,
  buildSchedulerCharacters,
  resolvePlanCharacters,
} from '@/lib/planCharacters'
import { expandManufacturingPlan } from '@/lib/manufacturingPlan'
import { activePlanRoots } from '@/lib/planRootEnabled'
import { buildPlanPipeline } from '@/pages/Plan/planPipeline'
import { schedulePlanJobs, windowHoursFromJobs } from '@/pages/Plan/planScheduler'
import { simulatePlanFlow } from '@/pages/Plan/planSimulator'
import {
  effectivePlanSlots,
  planSlotBonusesFromManufacturingTemplate,
} from '@/lib/manufacturingSlots'
import type { GlobalSettings, ManufacturingPlanTemplate, SystemInfo } from '@/types'

function copyBposByProductFromTemplate(template: ManufacturingPlanTemplate): Map<number, number> {
  const map = new Map<number, number>()
  for (const [key, override] of Object.entries(template.nodeOverrides ?? {})) {
    if (override.copyBpos == null) continue
    map.set(Number(key), Math.max(1, Math.floor(override.copyBpos)))
  }
  return map
}

export interface UseManufacturingPlanOptions {
  /** When false, skips flow simulation (graph tab only). */
  includeSimulation?: boolean
}

export function useManufacturingPlan(
  template: ManufacturingPlanTemplate | null,
  blueprints: import('@/types').BlueprintInfo[],
  typeMap: Map<number, import('@/types').TypeInfo>,
  prices: Map<number, number>,
  settings: GlobalSettings,
  systemCostIndex: number,
  reactionCostIndex: number,
  systems?: SystemInfo[],
  options: UseManufacturingPlanOptions = {},
) {
  const includeSimulation = options.includeSimulation !== false
  const authCharacters = useAuthStore((s) => s.characters)
  const manualCharacters = useAppStore((s) => s.userData.manualCharacters)

  return useMemo(() => {
    const slotBonuses = planSlotBonusesFromManufacturingTemplate(template ?? undefined)
    const {
      manufacturing: mfgSlots,
      research: scienceSlots,
      reactions: reactionSlots,
    } = effectivePlanSlots(settings.skills, slotBonuses)

    if (!template || activePlanRoots(template.roots).length === 0) {
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

    const expanded = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings,
      systemCostIndex,
      reactionCostIndex,
      systems,
    })
    const pipeline = buildPlanPipeline({
      nodes: expanded.nodes,
      blueprints,
      settings,
      scienceSlots: expanded.scienceSlots,
      manufacturingSlots: expanded.slots,
      reactionSlots: expanded.reactionSlots,
    })

    const planCharacterKeys = template.characters ?? []
    const multiCharacterSchedule =
      planCharacterKeys.length > 0
        ? (() => {
            const resolved = resolvePlanCharacters({
              keys: planCharacterKeys,
              sso: authCharacters.map((c) => ({
                characterId: c.characterId,
                characterName: c.characterName,
                skills: c.skills ?? c.trainedSkills,
              })),
              manual: manualCharacters ?? [],
              settingsSkills: settings.skills,
              bonuses: template.characterSlotBonus,
            })
            const blueprintByProduct = new Map(blueprints.map((bp) => [bp.productTypeId, bp]))
            return {
              characters: buildSchedulerCharacters(resolved, settings.skills, blueprintByProduct),
              ownerByProduct: buildOwnerByProduct(
                expanded.nodes,
                template.roots,
                template.nodeOverrides,
                planCharacterKeys,
              ),
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
  }, [
    template,
    blueprints,
    typeMap,
    prices,
    settings,
    systemCostIndex,
    reactionCostIndex,
    systems,
    includeSimulation,
    authCharacters,
    manualCharacters,
  ])
}

export function usePlanSkills() {
  const settings = useAppStore((s) => s.userData.settings)
  const character = useAuthStore((s) => s.character)

  return useMemo(
    () => ({
      skills: settings.skills,
      source: character ? ('sso' as const) : ('settings' as const),
      name: character?.characterName ?? null,
    }),
    [settings.skills, character],
  )
}
