import { useMemo } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
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
    const jobs = schedulePlanJobs({
      nodes: expanded.nodes,
      slots: expanded.slots,
      scienceSlots: expanded.scienceSlots,
      reactionSlots: expanded.reactionSlots,
      windowHours: Number.POSITIVE_INFINITY,
      pipeline,
      blueprints,
    })
    const productionJobs = schedulePlanJobs({
      nodes: expanded.nodes,
      slots: expanded.slots,
      reactionSlots: expanded.reactionSlots,
      windowHours: Number.POSITIVE_INFINITY,
      blueprints,
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
