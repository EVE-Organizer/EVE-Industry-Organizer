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
) {
  return useMemo(() => {
    if (!template || template.roots.length === 0) {
      return {
        nodes: [],
        jobs: [],
        simulations: new Map(),
        defaultSupplierId: null,
        defaultConsumerId: null,
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

    let supplierId: number | null = null
    let consumerId: number | null = null
    for (const node of expanded.nodes) {
      if (node.parentProductTypeIds.length > 0 && node.mode === 'build') {
        supplierId = node.productTypeId
        consumerId = node.parentProductTypeIds[0] ?? null
        break
      }
    }

    return {
      nodes: expanded.nodes,
      jobs,
      simulations,
      defaultSupplierId: supplierId,
      defaultConsumerId: consumerId,
      slots: expanded.slots,
      windowHours,
      warnings: detectOverUnder(expanded.nodes),
    }
  }, [template, blueprints, typeMap, prices, settings, systemCostIndex])
}

export function usePlanSkills() {
  const settings = useAppStore((s) => s.userData.settings)
  const character = useAuthStore((s) => s.character)

  return useMemo(() => {
    if (character?.skills) {
      return {
        skills: { ...settings.skills, ...character.skills },
        source: 'sso' as const,
        name: character.characterName,
      }
    }
    return { skills: settings.skills, source: 'settings' as const, name: null }
  }, [settings.skills, character])
}
