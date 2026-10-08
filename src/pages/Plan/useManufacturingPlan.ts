import { useMemo } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { buildManufacturingPlanSchedule } from '@/pages/Plan/buildManufacturingPlanSchedule'
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
  pooledStock: Map<number, number> | null | undefined = undefined,
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

    if (!template) {
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

    const skillSources = {
      sso: authCharacters.map((c) => ({
        characterId: c.characterId,
        characterName: c.characterName,
        skills: c.skills ?? c.trainedSkills,
      })),
      manual: manualCharacters ?? [],
    }

    return buildManufacturingPlanSchedule({
      template,
      blueprints,
      typeMap,
      prices,
      settings,
      systemCostIndex,
      reactionCostIndex,
      systems,
      skillSources,
      pooledStock: pooledStock ?? undefined,
      includeSimulation,
    })
  }, [
    template,
    blueprints,
    typeMap,
    prices,
    settings,
    systemCostIndex,
    reactionCostIndex,
    systems,
    pooledStock,
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
