import { meetsBuildRequirements } from '@/lib/buildRequirements'
import { effectivePlanSlots } from '@/lib/manufacturingSlots'
import type { SchedulerCharacter } from '@/pages/Plan/planScheduler'
import type {
  BlueprintInfo,
  GlobalSettings,
  ManufacturingPlanTemplate,
  PlanCharacterKey,
  PlanNode,
  PlanNodeOverride,
  PlanRootEntry,
  PlanSlotBonuses,
  SkillLevels,
} from '@/types'

export interface ResolvedPlanCharacter {
  key: PlanCharacterKey
  name: string
  skills: SkillLevels
  slots: ReturnType<typeof effectivePlanSlots>
  isSso: boolean
  skillsAssumed: boolean
}

function ssoIdFromKey(key: string): number | null {
  if (!key.startsWith('sso:')) return null
  const id = Number(key.slice(4))
  return Number.isFinite(id) ? id : null
}

/** "Character 123" is the placeholder used when a session name is missing. */
export function isFallbackCharacterName(name: string | undefined): boolean {
  return !name || /^Character \d+$/.test(name.trim())
}

export function resolvePlanCharacters(input: {
  keys: PlanCharacterKey[]
  sso: Array<{ characterId: number; characterName: string; skills?: SkillLevels }>
  manual: Array<{ id: string; name: string; skills: SkillLevels }>
  settingsSkills: SkillLevels
  bonuses?: Record<string, PlanSlotBonuses>
  /** Names remembered on the plan when the live session list does not include this character. */
  names?: Record<string, string>
}): ResolvedPlanCharacter[] {
  return input.keys.map((key) => {
    const bonus = input.bonuses?.[key]
    const ssoId = ssoIdFromKey(key)
    if (ssoId != null) {
      // Compare numerically so a string id from storage still matches the plan key
      const session = input.sso.find((c) => Number(c.characterId) === ssoId)
      const skillsAssumed = !session?.skills
      const skills = session?.skills ?? input.settingsSkills
      const remembered = input.names?.[key]
      const liveName = session?.characterName?.trim()
      return {
        key,
        name:
          (liveName && !isFallbackCharacterName(liveName) ? liveName : undefined) ??
          (remembered && !isFallbackCharacterName(remembered) ? remembered : undefined) ??
          `Character ${ssoId}`,
        skills,
        slots: effectivePlanSlots(skills, bonus),
        isSso: true,
        skillsAssumed,
      }
    }
    const manual = input.manual.find((c) => `manual:${c.id}` === key)
    const skills = manual?.skills ?? input.settingsSkills
    return {
      key,
      name: manual?.name ?? input.names?.[key] ?? 'Manual',
      skills,
      slots: effectivePlanSlots(skills, bonus),
      isSso: false,
      skillsAssumed: !manual,
    }
  })
}

/** Time multiplier for a node's job, relative to the skills the plan was priced with. */
export function characterDurationFactor(
  skills: SkillLevels,
  base: SkillLevels,
  node: Pick<PlanNode, 'recipeKind'>,
): number {
  const factor = (s: SkillLevels) =>
    node.recipeKind === 'reaction'
      ? 1 - 0.04 * s.reactions
      : (1 - 0.04 * s.industry) * (1 - 0.03 * s.advancedIndustry)
  const baseFactor = factor(base)
  return baseFactor > 0 ? factor(skills) / baseFactor : 1
}

/** Scheduler crew from resolved characters: own slots, own skill speed, own blueprint eligibility. */
export function buildSchedulerCharacters(
  characters: ResolvedPlanCharacter[],
  base: SkillLevels,
  blueprintByProduct: Map<number, BlueprintInfo>,
  ownerByProduct?: Map<number, PlanCharacterKey | 'auto'>,
): SchedulerCharacter[] {
  return characters.map((character) => ({
    key: character.key,
    slots: {
      manufacturing: character.slots.manufacturing,
      reactions: character.slots.reactions,
      research: character.slots.research,
    },
    durationFactor: (node) => {
      const owner = ownerByProduct?.get(node.productTypeId)
      if (owner && owner !== 'auto' && owner === character.key) return 1
      return characterDurationFactor(character.skills, base, node)
    },
    canRun: (node) => {
      const blueprint = blueprintByProduct.get(node.productTypeId)
      return !blueprint || meetsBuildRequirements(blueprint, character.skills)
    },
  }))
}

export function sumPlanCrewSlots(characters: ResolvedPlanCharacter[]): {
  manufacturing: number
  reactions: number
  research: number
} {
  return characters.reduce(
    (totals, character) => ({
      manufacturing: totals.manufacturing + character.slots.manufacturing,
      reactions: totals.reactions + character.slots.reactions,
      research: totals.research + character.slots.research,
    }),
    { manufacturing: 0, reactions: 0, research: 0 },
  )
}

type PlanSkillSources = {
  sso: Array<{
    characterId: number
    characterName: string
    skills?: SkillLevels
    trainedSkills?: SkillLevels
  }>
  manual: Array<{ id: string; name: string; skills: SkillLevels }>
}

/** Job timers for a pinned or inherited owner — expand uses this instead of global Settings skills. */
export function settingsWithOwnerTimeSkills(
  settings: GlobalSettings,
  ownerKey: PlanCharacterKey,
  sources: PlanSkillSources,
): GlobalSettings {
  const ownerSkills = skillsForPlanCharacterKey(
    ownerKey,
    sources.sso,
    sources.manual,
    settings.skills,
  )
  return {
    ...settings,
    skills: {
      ...settings.skills,
      industry: ownerSkills.industry,
      advancedIndustry: ownerSkills.advancedIndustry,
      reactions: ownerSkills.reactions,
      laboratoryOperation: ownerSkills.laboratoryOperation,
      advancedLaboratoryOperation: ownerSkills.advancedLaboratoryOperation,
      science: ownerSkills.science,
    },
  }
}

/**
 * Owner per product for the scheduler. A node pin wins; otherwise the node follows the single
 * owner shared by every root it feeds, and is left to Auto when the roots disagree.
 */
export function buildOwnerByProduct(
  nodes: Array<Pick<PlanNode, 'productTypeId' | 'parentProductTypeIds'>>,
  roots: Array<Pick<PlanRootEntry, 'productTypeId' | 'characterKey'>>,
  nodeOverrides: Record<number, PlanNodeOverride | undefined>,
  validKeys: PlanCharacterKey[],
): Map<number, PlanCharacterKey | 'auto'> {
  const valid = new Set(validKeys)
  const parentsOf = new Map(nodes.map((n) => [n.productTypeId, n.parentProductTypeIds ?? []]))
  const rootOwners = new Map<number, Set<PlanCharacterKey | undefined>>()
  for (const root of roots) {
    const owners = rootOwners.get(root.productTypeId) ?? new Set()
    owners.add(root.characterKey && valid.has(root.characterKey) ? root.characterKey : undefined)
    rootOwners.set(root.productTypeId, owners)
  }

  // Collect the owner of every root reachable by walking parents up (cycle-safe)
  function ownersFor(productTypeId: number): Set<PlanCharacterKey | undefined> {
    const found = new Set<PlanCharacterKey | undefined>()
    const seen = new Set<number>()
    const stack = [productTypeId]
    while (stack.length > 0) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      for (const owner of rootOwners.get(id) ?? []) found.add(owner)
      stack.push(...(parentsOf.get(id) ?? []))
    }
    return found
  }

  const result = new Map<number, PlanCharacterKey | 'auto'>()
  for (const node of nodes) {
    const pin = nodeOverrides[node.productTypeId]?.characterKey
    if (pin && valid.has(pin)) {
      result.set(node.productTypeId, pin)
      continue
    }
    const owners = ownersFor(node.productTypeId)
    const only = owners.size === 1 ? [...owners][0] : undefined
    result.set(node.productTypeId, only ?? 'auto')
  }
  return result
}

/**
 * Run shares for one product built as several roots with different owners.
 * A single owner is omitted — the product pin already covers that case.
 */
export function rootOwnerRunShares(
  roots: Array<Pick<PlanRootEntry, 'productTypeId' | 'characterKey' | 'runs' | 'enabled'>>,
  validKeys: PlanCharacterKey[],
): Map<number, Array<{ characterKey: PlanCharacterKey | 'auto'; runs: number }>> {
  const valid = new Set(validKeys)
  const byProduct = new Map<number, Map<string, number>>()
  for (const root of roots) {
    if (root.enabled === false) continue
    const key = root.characterKey && valid.has(root.characterKey) ? root.characterKey : 'auto'
    const owners = byProduct.get(root.productTypeId) ?? new Map<string, number>()
    owners.set(key, (owners.get(key) ?? 0) + root.runs)
    byProduct.set(root.productTypeId, owners)
  }

  const result = new Map<number, Array<{ characterKey: PlanCharacterKey | 'auto'; runs: number }>>()
  for (const [productTypeId, owners] of byProduct) {
    if (owners.size < 2) continue
    result.set(
      productTypeId,
      [...owners].map(([characterKey, runs]) => ({
        characterKey: characterKey as PlanCharacterKey | 'auto',
        runs,
      })),
    )
  }
  return result
}

/** Keys that may appear as owners (crew, pins, and every selectable character). */
export function planOwnerValidKeys(
  template: Pick<ManufacturingPlanTemplate, 'roots' | 'nodeOverrides' | 'characters'>,
  selectableKeys: PlanCharacterKey[],
): PlanCharacterKey[] {
  const keys = new Set<PlanCharacterKey>(selectableKeys)
  for (const key of template.characters ?? []) keys.add(key)
  for (const root of template.roots) {
    if (root.characterKey) keys.add(root.characterKey)
  }
  for (const override of Object.values(template.nodeOverrides)) {
    if (override?.characterKey) keys.add(override.characterKey)
  }
  return [...keys]
}

/** Owner shown in the jobs table: root pin, child pin, or inherited from root chain. */
export function displayOwnerForProduct(
  productTypeId: number,
  isRoot: boolean,
  root: Pick<PlanRootEntry, 'characterKey'> | undefined,
  override: PlanNodeOverride | undefined,
  ownerByProduct: Map<number, PlanCharacterKey | 'auto'>,
): { characterKey?: PlanCharacterKey; inherited: boolean } {
  if (isRoot) return { characterKey: root?.characterKey, inherited: false }
  if (override?.characterKey) return { characterKey: override.characterKey, inherited: false }
  const resolved = ownerByProduct.get(productTypeId)
  if (resolved && resolved !== 'auto') return { characterKey: resolved, inherited: true }
  return { characterKey: undefined, inherited: false }
}

export function skillsForPlanCharacterKey(
  key: PlanCharacterKey,
  sso: Array<{
    characterId: number
    characterName: string
    skills?: SkillLevels
    trainedSkills?: SkillLevels
  }>,
  manual: Array<{ id: string; name: string; skills: SkillLevels }>,
  settingsSkills: SkillLevels,
): SkillLevels {
  const [character] = resolvePlanCharacters({
    keys: [key],
    sso: sso.map((c) => ({
      characterId: c.characterId,
      characterName: c.characterName,
      skills: c.skills ?? c.trainedSkills,
    })),
    manual,
    settingsSkills,
  })
  return character?.skills ?? settingsSkills
}

/** Plan profit fees only — manufacturing skills stay on global Settings / job owners. */
export function settingsWithPlanSellerFees(
  settings: GlobalSettings,
  sellerKey: PlanCharacterKey | undefined,
  sso: Array<{
    characterId: number
    characterName: string
    skills?: SkillLevels
    trainedSkills?: SkillLevels
  }>,
  manual: Array<{ id: string; name: string; skills: SkillLevels }>,
): GlobalSettings {
  if (!sellerKey) return settings
  const sellerSkills = skillsForPlanCharacterKey(sellerKey, sso, manual, settings.skills)
  return {
    ...settings,
    skills: {
      ...settings.skills,
      accounting: sellerSkills.accounting,
      brokerRelations: sellerSkills.brokerRelations,
    },
  }
}
