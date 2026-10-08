import { useEffect, useMemo } from 'react'
import { fetchUniverseCharacterNames } from '@/services/character/characterNamesService'
import { isFallbackCharacterName } from '@/lib/planCharacters'
import {
  useCharactersIndustryJobs,
  useCharactersLocationInventory,
} from '@/hooks/useCharacterIndustryData'
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
  const names = template?.characterNames

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
      names,
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
  }, [keys, bonuses, names, authCharacters, manualCharacters, settings.skills])
}

/**
 * Fills plan character names from the signed-in list, then public ESI, and stores them
 * so a missing session does not keep showing "Character {id}".
 */
export function useRememberPlanCharacterNames(input: {
  enabled: boolean
  keys: PlanCharacterKey[]
  knownNames: Record<string, string>
  storedNames: Record<string, string> | undefined
  onSave: (names: Record<string, string>) => void
}) {
  const { enabled, keys, knownNames, storedNames, onSave } = input
  const keyList = keys.join(',')
  const knownList = Object.entries(knownNames)
    .map(([key, name]) => `${key}=${name}`)
    .sort()
    .join('|')
  const storedList = Object.entries(storedNames ?? {})
    .map(([key, name]) => `${key}=${name}`)
    .sort()
    .join('|')

  useEffect(() => {
    if (!enabled) return
    const updates: Record<string, string> = {}
    const missingIds: number[] = []
    const missingKeys = new Map<number, PlanCharacterKey>()

    for (const key of keys) {
      const known = knownNames[key]
      if (known && !isFallbackCharacterName(known)) {
        if (storedNames?.[key] !== known) updates[key] = known
        continue
      }
      if (storedNames?.[key] && !isFallbackCharacterName(storedNames[key])) continue
      if (!key.startsWith('sso:')) continue
      const id = Number(key.slice(4))
      if (!Number.isFinite(id)) continue
      missingIds.push(id)
      missingKeys.set(id, key)
    }

    let cancelled = false
    void (async () => {
      if (missingIds.length > 0) {
        try {
          const fetched = await fetchUniverseCharacterNames(missingIds)
          for (const [id, name] of fetched) {
            const key = missingKeys.get(id)
            if (key) updates[key] = name
          }
        } catch {
          // A failed name lookup leaves the placeholder until the next plan open
        }
      }
      if (cancelled || Object.keys(updates).length === 0) return
      onSave(updates)
    })()

    return () => {
      cancelled = true
    }
    // keyList/knownList/storedList are the stable signatures of the object inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, keyList, knownList, storedList, onSave])
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
    const ids = (template?.characters ?? []).map(ssoIdOf).filter((id): id is number => id != null)
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
