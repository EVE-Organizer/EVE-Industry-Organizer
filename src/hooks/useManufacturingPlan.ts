import { useMemo } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { expandManufacturingPlan } from '@/lib/manufacturingPlan'
import { buildPlanPipeline } from '@/lib/planPipeline'
import { schedulePlanJobs, detectOverUnder, windowHoursFromJobs } from '@/lib/planScheduler'
import { simulatePlanFlow } from '@/lib/planSimulator'
import { manufacturingSlotsFromSkills, researchSlotsFromSkills } from '@/lib/manufacturingSlots'
import type { GlobalSettings, ManufacturingPlanTemplate } from '@/types'

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
  options: UseManufacturingPlanOptions = {},
) {
  const includeSimulation = options.includeSimulation !== false

  return useMemo(() => {
    const mfgSlots = manufacturingSlotsFromSkills(settings.skills)
    const scienceSlots = researchSlotsFromSkills(settings.skills)

    if (!template || template.roots.length === 0) {
      return {
        nodes: [],
        jobs: [],
        pipeline: null,
        simulations: new Map(),
        slots: mfgSlots,
        scienceSlots,
        windowHours: 1,
        warnings: [] as { productTypeId: number; message: string }[],
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
    })
    const pipeline = buildPlanPipeline({
      nodes: expanded.nodes,
      blueprints,
      settings,
      scienceSlots: expanded.scienceSlots,
      manufacturingSlots: expanded.slots,
    })
    const jobs = schedulePlanJobs({
      nodes: expanded.nodes,
      slots: expanded.slots,
      scienceSlots: expanded.scienceSlots,
      windowHours: Number.POSITIVE_INFINITY,
      pipeline,
      blueprints,
    })
    const windowHours = windowHoursFromJobs(jobs)
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
      pipeline,
      simulations,
      slots: expanded.slots,
      scienceSlots: expanded.scienceSlots,
      windowHours,
      warnings: [...expanded.warnings, ...detectOverUnder(expanded.nodes)],
      missingPriceTypeIds: expanded.missingPriceTypeIds,
      hasReliablePrices: expanded.missingPriceTypeIds.length === 0,
    }
  }, [template, blueprints, typeMap, prices, settings, systemCostIndex, reactionCostIndex, includeSimulation])
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
