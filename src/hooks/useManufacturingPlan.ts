import { useMemo } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { expandManufacturingPlan } from '@/lib/manufacturingPlan'
import { schedulePlanJobs, detectOverUnder, windowHoursFromJobs } from '@/lib/planScheduler'
import { simulatePlanFlow } from '@/lib/planSimulator'
import { manufacturingSlotsFromSkills } from '@/lib/manufacturingSlots'
import type { GlobalSettings, ManufacturingPlanTemplate } from '@/types'

export function useManufacturingPlan(
  template: ManufacturingPlanTemplate | null,
  blueprints: import('@/types').BlueprintInfo[],
  typeMap: Map<number, import('@/types').TypeInfo>,
  prices: Map<number, number>,
  settings: GlobalSettings,
  systemCostIndex: number,
  reactionCostIndex: number,
) {
  return useMemo(() => {
    if (!template || template.roots.length === 0) {
      return {
        nodes: [],
        jobs: [],
        simulations: new Map(),
        slots: manufacturingSlotsFromSkills(settings.skills),
        windowHours: 1,
        warnings: [] as { productTypeId: number; message: string }[],
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
    const jobs = schedulePlanJobs({
      nodes: expanded.nodes,
      slots: expanded.slots,
      windowHours: Number.POSITIVE_INFINITY,
    })
    const windowHours = windowHoursFromJobs(jobs)
    const simulations = simulatePlanFlow({
      nodes: expanded.nodes,
      jobs,
      windowHours,
    })

    return {
      nodes: expanded.nodes,
      jobs,
      simulations,
      slots: expanded.slots,
      windowHours,
      warnings: detectOverUnder(expanded.nodes),
    }
  }, [template, blueprints, typeMap, prices, settings, systemCostIndex, reactionCostIndex])
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
