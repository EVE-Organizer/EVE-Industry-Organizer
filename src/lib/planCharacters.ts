import { meetsBuildRequirements } from '@/lib/buildRequirements'
import { effectivePlanSlots } from '@/lib/manufacturingSlots'
import type { SchedulerCharacter } from '@/pages/Plan/planScheduler'
import type {
  BlueprintInfo,
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

export function resolvePlanCharacters(input: {
  keys: PlanCharacterKey[]
  sso: Array<{ characterId: number; characterName: string; skills?: SkillLevels }>
  manual: Array<{ id: string; name: string; skills: SkillLevels }>
  settingsSkills: SkillLevels
  bonuses?: Record<string, PlanSlotBonuses>
}): ResolvedPlanCharacter[] {
  return input.keys.map((key) => {
    const bonus = input.bonuses?.[key]
    if (key.startsWith('sso:')) {
      const id = Number(key.slice(4))
      const session = input.sso.find((c) => c.characterId === id)
      const skillsAssumed = !session?.skills
      const skills = session?.skills ?? input.settingsSkills
      return {
        key,
        name: session?.characterName ?? `Character ${id}`,
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
      name: manual?.name ?? 'Manual',
      skills,
      slots: effectivePlanSlots(skills, bonus),
      isSso: false,
      skillsAssumed: !manual,
    }
  })
}

export function nodeOwner(
  productTypeId: number,
  pins: Record<number, { characterKey?: PlanCharacterKey } | undefined>,
  roots: Array<{ productTypeId: number; characterKey?: PlanCharacterKey; childIds?: number[] }>,
): PlanCharacterKey | 'auto' {
  const pin = pins[productTypeId]?.characterKey
  if (pin) return pin
  const owners = new Set(
    roots
      .filter((root) => root.productTypeId === productTypeId || root.childIds?.includes(productTypeId))
      .map((root) => root.characterKey)
      .filter((key): key is PlanCharacterKey => !!key),
  )
  if (owners.size === 1) return [...owners][0]!
  return 'auto'
}

export function canRunJob(
  skills: Record<string, number | undefined>,
  requiredSkills: Record<string, number> | undefined,
  activity: 'manufacture' | 'invention',
): boolean {
  if (activity === 'invention') return (skills.encryption ?? 0) > 0
  if (!requiredSkills) return true
  return Object.entries(requiredSkills).every(([name, level]) => (skills[name] ?? 0) >= level)
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
): SchedulerCharacter[] {
  return characters.map((character) => ({
    key: character.key,
    slots: {
      manufacturing: character.slots.manufacturing,
      reactions: character.slots.reactions,
      research: character.slots.research,
    },
    durationFactor: (node) => characterDurationFactor(character.skills, base, node),
    canRun: (node) => {
      const blueprint = blueprintByProduct.get(node.productTypeId)
      return !blueprint || meetsBuildRequirements(blueprint, character.skills)
    },
  }))
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