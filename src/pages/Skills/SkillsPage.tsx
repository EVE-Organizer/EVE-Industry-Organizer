import { useEffect, useMemo, useState } from 'react'
import { CharacterAvatar } from '@/components/EveImage'
import { SkillsAttributesPanel } from '@/pages/Skills/SkillsAttributesPanel'
import { SkillsEditorPanel } from '@/pages/Skills/SkillsEditorPanel'
import { SkillsImpactGrid } from '@/pages/Skills/SkillsImpactGrid'
import { SkillsTrainingSandbox } from '@/pages/Skills/SkillsTrainingSandbox'
import {
  useCharacterAttributes,
  useCharacterImplants,
  useCharacterSkillQueue,
} from '@/hooks/useCharacterSkillsData'
import { useSdeData } from '@/hooks/useSdeData'
import { formatSyncedAt } from '@/lib/authDisplay'
import { buildSkillMap, buildTypeMap } from '@/services/data/sdeLoader'
import { computeSkillImpact } from '@/pages/Skills/skillImpact'
import {
  basesFromEsiTotals,
  defaultAttributes,
  defaultImplants,
  effectiveAttributes,
  zeroTemporaryBoost,
  type AttributeMap,
  type ImplantBonuses,
} from '@/pages/Skills/skillAttributes'
import { fittedImplantsFromTypeIds } from '@/pages/Skills/skillImplants'
import {
  SKILL_ATTRIBUTE_FALLBACKS,
  SKILL_FIELDS,
  skillLevel,
  trainingAttributesForSkill,
} from '@/lib/skillFields'
import {
  scaleSkillQueueTimes,
  scaledQueueFinishMs,
  spPerMinuteForSkill,
} from '@/pages/Skills/skillTraining'
import { esiAttributesToMap } from '@/services/character/characterAttributesService'
import { normalizeImplantTypeIds } from '@/services/character/characterImplantsService'
import { isActiveQueueEntry } from '@/services/character/characterSkillQueueService'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import type { EveAttributeId, GlobalSettings, SkillInfo, SkillLevels } from '@/types'

function countSkillDiffs(assumed: SkillLevels, trained?: SkillLevels | null): number {
  if (!trained) return 0
  return SKILL_FIELDS.reduce((count, { key }) => {
    return skillLevel(assumed, key) !== skillLevel(trained, key) ? count + 1 : count
  }, 0)
}

function skillAttrsFromSde(
  skillMap: Map<number, SkillInfo>,
  skillId: number,
  key: (typeof SKILL_FIELDS)[number]['key'],
) {
  const info = skillMap.get(skillId)
  const fallback = SKILL_ATTRIBUTE_FALLBACKS[key]
  return {
    primaryAttribute: (info?.primaryAttribute ?? fallback.primaryAttribute) as EveAttributeId,
    secondaryAttribute: (info?.secondaryAttribute ?? fallback.secondaryAttribute) as EveAttributeId,
  }
}

export function SkillsPage() {
  const userData = useAppStore((s) => s.userData)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const settings = userData.settings

  const configured = useAuthStore((s) => s.configured)
  const character = useAuthStore((s) => s.character)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isBusy = useAuthStore((s) => s.isBusy)
  const login = useAuthStore((s) => s.login)
  const refreshCharacter = useAuthStore((s) => s.refreshCharacter)
  const logoutCharacter = useAuthStore((s) => s.logoutCharacter)
  const persistActiveSkillsFromSettings = useAuthStore((s) => s.persistActiveSkillsFromSettings)
  const resetAssumedToTrained = useAuthStore((s) => s.resetAssumedToTrained)

  const characterId = character?.characterId ?? null
  const { data: sde } = useSdeData()
  const { data: queue } = useCharacterSkillQueue(characterId)
  const { data: esiAttrs } = useCharacterAttributes(characterId)
  const {
    data: esiImplants,
    isFetched: implantsFetched,
    isError: implantsError,
  } = useCharacterImplants(characterId)

  const skillNameById = useMemo(() => buildSkillMap(sde?.skills ?? []), [sde?.skills])
  const typeMap = useMemo(() => (sde ? buildTypeMap(sde.types) : new Map()), [sde])

  const [seedBases, setSeedBases] = useState<AttributeMap>(() => defaultAttributes())
  const [seedImplants, setSeedImplants] = useState<ImplantBonuses>(() => defaultImplants())
  const [seedTemporaryBoost, setSeedTemporaryBoost] = useState<AttributeMap>(() => zeroTemporaryBoost())
  const [bases, setBases] = useState<AttributeMap>(() => defaultAttributes())
  const [implants, setImplants] = useState<ImplantBonuses>(() => defaultImplants())
  const [temporaryBoost, setTemporaryBoost] = useState<AttributeMap>(() => zeroTemporaryBoost())

  useEffect(() => {
    if (!esiAttrs) return
    if (characterId != null && !implantsFetched && !implantsError) return

    const typeIds = normalizeImplantTypeIds(esiImplants ?? [])
    const descriptions = new Map<number, string | undefined>()
    for (const typeId of typeIds) {
      descriptions.set(typeId, typeMap.get(typeId)?.description)
    }
    const bonuses = fittedImplantsFromTypeIds(typeIds, descriptions).bonuses
    const remap = basesFromEsiTotals(esiAttributesToMap(esiAttrs), bonuses)
    setSeedImplants(bonuses)
    setImplants(bonuses)
    setSeedTemporaryBoost(remap.temporaryBoost)
    setTemporaryBoost(remap.temporaryBoost)
    setSeedBases(remap.bases)
    setBases(remap.bases)
  }, [esiAttrs, esiImplants, implantsFetched, implantsError, characterId, typeMap])

  const effective = useMemo(
    () => effectiveAttributes(bases, implants, temporaryBoost),
    [bases, implants, temporaryBoost],
  )
  const seedEffective = useMemo(
    () => effectiveAttributes(seedBases, seedImplants, seedTemporaryBoost),
    [seedBases, seedImplants, seedTemporaryBoost],
  )

  const impact = useMemo(
    () => computeSkillImpact(settings.skills, settings.inventionSkillLevel),
    [settings.skills, settings.inventionSkillLevel],
  )

  const trainedImpact = useMemo(
    () =>
      character?.trainedSkills
        ? computeSkillImpact(character.trainedSkills, settings.inventionSkillLevel)
        : null,
    [character?.trainedSkills, settings.inventionSkillLevel],
  )

  const activeQueueEntry = useMemo(
    () => [...(queue ?? [])].find(isActiveQueueEntry),
    [queue],
  )

  const trainingAttrs = useMemo(() => {
    if (activeQueueEntry) {
      const attrs = trainingAttributesForSkill(activeQueueEntry.skill_id, skillNameById)
      if (attrs) return attrs
    }
    return skillAttrsFromSde(skillNameById, SKILL_FIELDS[0].skillId, 'industry')
  }, [activeQueueEntry, skillNameById])

  const spPerMinute = useMemo(
    () => spPerMinuteForSkill(effective, trainingAttrs),
    [effective, trainingAttrs],
  )

  const queueFinishSeconds = useMemo(() => {
    if (!activeQueueEntry?.finish_date || !activeQueueEntry.start_date) return null
    const seedEffective = effectiveAttributes(seedBases, seedImplants, seedTemporaryBoost)
    const oldSpm = spPerMinuteForSkill(seedEffective, trainingAttrs)
    const finishMs = scaledQueueFinishMs(
      activeQueueEntry.finish_date,
      activeQueueEntry.start_date,
      oldSpm,
      spPerMinute,
    )
    if (finishMs == null) return null
    return Math.max(0, Math.round((finishMs - Date.now()) / 1000))
  }, [activeQueueEntry, seedBases, seedImplants, trainingAttrs, spPerMinute])

  const queueTotalSeconds = useMemo(
    () =>
      scaleSkillQueueTimes(
        queue ?? [],
        (skillId) => trainingAttributesForSkill(skillId, skillNameById),
        seedEffective,
        effective,
      ).totalSeconds ?? queueFinishSeconds,
    [queue, skillNameById, seedEffective, effective, queueFinishSeconds],
  )

  const diffCount = countSkillDiffs(settings.skills, character?.trainedSkills)
  const syncedAtLabel = formatSyncedAt(character?.lastSyncedAt)

  function handleSettingsChange(patch: Partial<GlobalSettings>) {
    updateSettings(patch)
    if (patch.skills) persistActiveSkillsFromSettings()
  }

  return (
    <div className="skills-page flex flex-col gap-4 min-h-0 flex-1">
      <header className="skills-page__card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {isAuthenticated && character ? (
              <CharacterAvatar
                characterId={character.characterId}
                name={character.characterName}
                size={48}
              />
            ) : (
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-base-300 text-base-content/40">
                <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                  />
                </svg>
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">
                {isAuthenticated && character ? character.characterName : 'Manual skills'}
              </h1>
              <p className="text-xs opacity-60">
                Industry skills for plans, jobs, and profit
                {syncedAtLabel ? ` · Synced ${syncedAtLabel}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={isBusy}
                  onClick={() => void refreshCharacter()}
                >
                  {isBusy ? <span className="loading loading-spinner loading-xs" /> : 'Refresh'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => logoutCharacter()}
                >
                  Sign out
                </button>
              </>
            ) : configured ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void login()}>
                Sign in with EVE
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <SkillsImpactGrid
        impact={impact}
        trainedImpact={trainedImpact}
        spPerMinute={spPerMinute}
        queueFinishSeconds={queueTotalSeconds}
      />

      <SkillsAttributesPanel
        bases={bases}
        implants={implants}
        temporaryBoost={temporaryBoost}
        seedImplants={seedImplants}
        hasEsiData={Boolean(esiAttrs || esiImplants)}
        onBaseChange={setBases}
        onImplantChange={(attr, value) => setImplants((prev) => ({ ...prev, [attr]: value }))}
        onResetRemap={() => setBases({ ...seedBases })}
        onResetImplants={() => setImplants({ ...seedImplants })}
      />

      <div className="skills-page__split">
        <SkillsEditorPanel
          settings={settings}
          trainedSkills={character?.trainedSkills}
          diffCount={diffCount}
          canResetToTrained={Boolean(character?.trainedSkills)}
          onChange={handleSettingsChange}
          onResetToTrained={resetAssumedToTrained}
        />
        <div className="skills-page__queue-slot">
          <SkillsTrainingSandbox
            queue={queue}
            skillNameById={skillNameById}
            spPerMinute={spPerMinute}
            queueFinishSeconds={queueFinishSeconds}
            seedEffective={seedEffective}
            effective={effective}
            bases={bases}
            implants={implants}
            isAuthenticated={isAuthenticated}
            onLogin={() => void login()}
          />
        </div>
      </div>
    </div>
  )
}
