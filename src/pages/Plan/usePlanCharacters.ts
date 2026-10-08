import { useEffect, useMemo } from 'react'
import { useCharactersIndustryJobs, useCharactersLocationInventory } from '@/hooks/useCharacterIndustryData'
import { resolvePlanCharacters } from '@/lib/planCharacters'
import { progressStepsFromJobs, syncPlanProgress } from '@/lib/planProgress'
import { stockStepProgress } from '@/lib/planStock'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import type { PlanOwnerOption } from '@/components/plan/PlanOwnerPicker'
import type {
  BlueprintInfo,
  GlobalSettings,
  ManufacturingPlanTemplate,
  PlanCharacterKey,
  PlanNode,
  ScheduledPlanJob,
} from '@/types'

function ssoIdOf(key: PlanCharacterKey): number | null {
  return key.startsWith('sso:') ? Number(key.slice(4)) : null
}

/** Characters on the plan, resolved with their skills, plus everyone who could be added. */
export function usePlanCharacters(
  template: ManufacturingPlanTemplate | null,
  settings: GlobalSettings,
) {
  const authCharacters = useAuthStore((s) => s.characters)
  const manualCharacters = useAppStore((s) => s.userData.manualCharacters)
  const keys = template?.characters
  const bonuses = template?.characterSlotBonus

  return useMemo(() => {
    const manual = manualCharacters ?? []
    const resolved = resolvePlanCharacters({
      keys: keys ?? [],
      sso: authCharacters.map((c) => ({
        characterId: c.characterId,
        characterName: c.characterName,
        skills: c.skills ?? c.trainedSkills,
      })),
      manual,
      settingsSkills: settings.skills,
      bonuses,
    })
    const toOption = (key: PlanCharacterKey, name: string): PlanOwnerOption => ({
      key,
      name,
      characterId: ssoIdOf(key) ?? undefined,
    })
    const everyone: PlanOwnerOption[] = [
      ...authCharacters.map((c) => toOption(`sso:${c.characterId}`, c.characterName)),
      ...manual.map((c) => toOption(`manual:${c.id}`, c.name)),
    ]
    const onPlan = new Set(resolved.map((c) => c.key))
    return {
      resolved,
      ownerOptions: resolved.map((c) => toOption(c.key, c.name)),
      /** Characters not yet on the plan. */
      available: everyone.filter((option) => !onPlan.has(option.key)),
      everyone,
    }
  }, [keys, bonuses, authCharacters, manualCharacters, settings.skills])
}

/**
 * Keeps `stepProgress` current once a plan has started: ESI jobs first, then stock moves,
 * with manual marks winning. Writes only when the result changes so it settles.
 */
export function usePlanProgressSync(input: {
  template: ManufacturingPlanTemplate | null
  jobs: ScheduledPlanJob[]
  nodes: PlanNode[]
  blueprints: BlueprintInfo[]
  locationId: number | null | undefined
  enabled: boolean
  onChange: (stepProgress: NonNullable<ManufacturingPlanTemplate['stepProgress']>) => void
}) {
  const { template, jobs, nodes, blueprints, locationId, enabled, onChange } = input
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)

  const characterIds = useMemo(() => {
    const ids = (template?.characters ?? [])
      .map(ssoIdOf)
      .filter((id): id is number => id != null)
    if (ids.length === 0 && activeCharacterId != null) ids.push(activeCharacterId)
    return ids
  }, [template?.characters, activeCharacterId])

  const jobQueries = useCharactersIndustryJobs(enabled ? characterIds : [])
  const stock = useCharactersLocationInventory(enabled ? characterIds : [], locationId)
  const jobsKey = jobQueries.map((query) => query.dataUpdatedAt).join(',')

  useEffect(() => {
    if (!enabled || !template?.startedAt) return
    const liveJobs = jobQueries.flatMap((query) => query.data ?? [])
    const blueprintByProduct = new Map(blueprints.map((bp) => [bp.productTypeId, bp]))
    const persisted = template.stepProgress ?? {}

    const next = syncPlanProgress({
      steps: progressStepsFromJobs(jobs, blueprintByProduct),
      liveJobs,
      startedAt: template.startedAt,
      persisted,
      stockFor: (known) =>
        stockStepProgress({
          jobs,
          nodes,
          startStock: template.startStock ?? {},
          allocated: template.stockAllocated ?? {},
          pooled: stock.pooled,
          progress: known,
        }),
    })
    if (JSON.stringify(next) !== JSON.stringify(persisted)) onChange(next)
    // jobsKey tracks ESI data changes; the query array itself is new every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, template, jobs, nodes, blueprints, stock.pooled, jobsKey, onChange])

  return { pooledStock: stock.pooled, stockByCharacter: stock.byCharacter }
}
