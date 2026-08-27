import type { SkillAttributePair, SkillInfo, SkillLevels } from '@/types'
import { ZERO_SKILLS } from '@/types'

export interface SkillPrerequisite {
  key: keyof SkillLevels
  level: number
}

export interface SkillFieldDef {
  key: keyof SkillLevels
  skillId: number
  label: string
  tooltip: string
  prerequisites?: SkillPrerequisite[]
}

/** Manufacturing and market skills editable in Settings. */
export const SKILL_FIELDS: SkillFieldDef[] = [
  {
    key: 'industry',
    skillId: 3380,
    label: 'Industry',
    tooltip:
      'Cuts manufacturing job time by 4% per level. Required by most manufacturing blueprints. Your level is also checked against each blueprint\'s Industry requirement for the "Only buildable" filter and skill gap flags.',
  },
  {
    key: 'advancedIndustry',
    skillId: 3388,
    label: 'Advanced Industry',
    tooltip:
      'Cuts manufacturing job time by 3% per level. Higher levels raise IPH and profit per hour in rankings. Also required by some advanced blueprints.',
    prerequisites: [{ key: 'industry', level: 3 }],
  },
  {
    key: 'massProduction',
    skillId: 3387,
    label: 'Mass Production',
    tooltip:
      'Adds one concurrent manufacturing job per level (plus one base slot). Used for production plan timelines.',
    prerequisites: [{ key: 'industry', level: 3 }],
  },
  {
    key: 'advancedMassProduction',
    skillId: 24625,
    label: 'Advanced Mass Production',
    tooltip:
      'Adds one more concurrent manufacturing job per level on top of Mass Production. Max 11 slots at V/V.',
    prerequisites: [{ key: 'massProduction', level: 5 }],
  },
  {
    key: 'laboratoryOperation',
    skillId: 3406,
    label: 'Laboratory Operation',
    tooltip:
      'Adds one concurrent science job (copy, invention, research) per level on top of one base slot. Used for research pipeline timelines.',
    prerequisites: [{ key: 'science', level: 3 }],
  },
  {
    key: 'advancedLaboratoryOperation',
    skillId: 24624,
    label: 'Advanced Laboratory Operation',
    tooltip:
      'Adds one more concurrent science job per level on top of Laboratory Operation. Max 11 science slots at V/V.',
    prerequisites: [{ key: 'laboratoryOperation', level: 5 }],
  },
  {
    key: 'reactions',
    skillId: 45746,
    label: 'Reactions',
    tooltip:
      'Cuts reaction job time by 4% per level. Required by reaction formulas in supply chains and plans.',
  },
  {
    key: 'science',
    skillId: 3403,
    label: 'Science',
    tooltip:
      'Required by a small set of blueprints (e.g. some tech items). Prerequisite for Laboratory Operation. Used for the buildable filter and skill gap flags.',
  },
  {
    key: 'accounting',
    skillId: 16622,
    label: 'Accounting',
    tooltip:
      'Lowers sales tax on market sales. NPC base is 7.5%; each level removes 11% of that base (3.375% at level V). Applied to net revenue in profit and ranking calculations.',
  },
  {
    key: 'brokerRelations',
    skillId: 3443,
    label: 'Broker Relations',
    tooltip:
      'Lowers broker fee when listing sell orders. NPC base is 3%; each level removes 0.3 percentage points (1.5% at level V). Not charged on instant buy-order sales.',
  },
  {
    key: 'advancedBrokerRelations',
    skillId: 16597,
    label: 'Advanced Broker Relations',
    tooltip:
      'Lowers the relist charge when modifying a sell order price. NPC base discount is 50%; each level adds 5 percentage points (75% at level V). Does not change broker fee on new orders.',
    prerequisites: [
      { key: 'accounting', level: 4 },
      { key: 'brokerRelations', level: 4 },
    ],
  },
  {
    key: 'mining',
    skillId: 3386,
    label: 'Mining',
    tooltip: 'Adds 5% ore and moon mining yield per level. Hull rates assume IV.',
  },
  {
    key: 'astrogeology',
    skillId: 3410,
    label: 'Astrogeology',
    tooltip: 'Adds 5% ore and moon mining yield per level. Requires Mining IV.',
    prerequisites: [{ key: 'mining', level: 4 }],
  },
  {
    key: 'iceHarvesting',
    skillId: 16281,
    label: 'Ice Harvesting',
    tooltip: 'Cuts ice harvester cycle time by 5% per level. Hull rates assume IV.',
  },
  {
    key: 'gasCloudHarvesting',
    skillId: 25544,
    label: 'Gas Cloud Harvesting',
    tooltip: 'Cuts gas harvester cycle time by 5% per level. Hull rates assume IV.',
  },
  {
    key: 'miningBarge',
    skillId: 17940,
    label: 'Mining Barge',
    tooltip:
      'Applies each barge or exhumer hull bonus to Strip Miner yield and Ice Harvester cycle time.',
    prerequisites: [
      { key: 'industry', level: 5 },
      { key: 'astrogeology', level: 3 },
    ],
  },
  {
    key: 'exhumers',
    skillId: 22551,
    label: 'Exhumers',
    tooltip:
      'Applies each exhumer hull bonus to Strip Miner yield and cycle time. Requires Mining Barge V.',
    prerequisites: [{ key: 'miningBarge', level: 5 }],
  },
  {
    key: 'industrialCommandShips',
    skillId: 29637,
    label: 'Industrial Command Ships',
    tooltip:
      'Porpoise +2% and Orca +3% Mining Foreman burst strength per level. Used when a booster hull is on grid.',
  },
  {
    key: 'capitalIndustrialShips',
    skillId: 28374,
    label: 'Capital Industrial Ships',
    tooltip: 'Rorqual +5% Mining Foreman burst strength per level.',
  },
  {
    key: 'miningFrigate',
    skillId: 32918,
    label: 'Mining Frigate',
    tooltip: 'Venture and Prospect hull mining yield and gas cycle bonuses.',
  },
  {
    key: 'expeditionFrigates',
    skillId: 33856,
    label: 'Expedition Frigates',
    tooltip: 'Prospect and Endurance hull mining yield bonuses. Requires Mining Frigate V.',
    prerequisites: [{ key: 'miningFrigate', level: 5 }],
  },
  {
    key: 'miningDirector',
    skillId: 22536,
    label: 'Mining Director',
    tooltip: 'Adds 10% Mining Foreman burst strength per level.',
  },
  {
    key: 'reprocessing',
    skillId: 3385,
    label: 'Reprocessing',
    tooltip: 'Adds 3% reprocessing yield per level at NPC stations (50% base).',
    prerequisites: [{ key: 'industry', level: 1 }],
  },
  {
    key: 'reprocessingEfficiency',
    skillId: 3389,
    label: 'Reprocessing Efficiency',
    tooltip: 'Adds 2% reprocessing yield per level on top of Reprocessing.',
    prerequisites: [{ key: 'reprocessing', level: 4 }],
  },
  {
    key: 'simpleOreProcessing',
    skillId: 60377,
    label: 'Simple Ore Processing',
    tooltip: 'Adds 2% yield per level for Veldspar, Scordite, Pyroxeres, Plagioclase, and Mordunium.',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 4 }],
  },
  {
    key: 'coherentOreProcessing',
    skillId: 60378,
    label: 'Coherent Ore Processing',
    tooltip:
      'Adds 2% yield per level for Omber, Kernite, Jaspet, Hemorphite, Hedbergite, Ytirium, Griemeer, and Nocxite.',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
  {
    key: 'variegatedOreProcessing',
    skillId: 60379,
    label: 'Variegated Ore Processing',
    tooltip: 'Adds 2% yield per level for Gneiss, Dark Ochre, Crokite, and Kylixium.',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 4 }],
  },
  {
    key: 'complexOreProcessing',
    skillId: 60380,
    label: 'Complex Ore Processing',
    tooltip:
      'Adds 2% yield per level for Arkonor, Bistot, Spodumain, Eifyrium, Ducinium, Hezorime, and Ueganite.',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
  {
    key: 'mercoxitOreProcessing',
    skillId: 12189,
    label: 'Mercoxit Ore Processing',
    tooltip: 'Adds 2% Mercoxit reprocessing yield per level.',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
  {
    key: 'abyssalOreProcessing',
    skillId: 60381,
    label: 'Abyssal Ore Processing',
    tooltip: 'Adds 2% yield per level for Bezdnacine, Rakovene, and Talassonite.',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
  {
    key: 'erraticOreProcessing',
    skillId: 90040,
    label: 'Erratic Ore Processing',
    tooltip: 'Adds 2% Prismaticite reprocessing yield per level.',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
  {
    key: 'iceProcessing',
    skillId: 18025,
    label: 'Ice Processing',
    tooltip: 'Adds 2% ice reprocessing yield per level.',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
  {
    key: 'ubiquitousMoonOreProcessing',
    skillId: 46152,
    label: 'Ubiquitous Moon Ore Processing',
    tooltip: 'Adds 2% yield per level for ubiquitous moon ore (Zeolites, Sylvite, Bitumens, Coesite).',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
  {
    key: 'commonMoonOreProcessing',
    skillId: 46153,
    label: 'Common Moon Ore Processing',
    tooltip: 'Adds 2% yield per level for common moon ore (Cobaltite, Euxenite, Titanite, Scheelite).',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
  {
    key: 'uncommonMoonOreProcessing',
    skillId: 46154,
    label: 'Uncommon Moon Ore Processing',
    tooltip:
      'Adds 2% yield per level for uncommon moon ore (Otavite, Sperrylite, Vanadinite, Chromite).',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
  {
    key: 'rareMoonOreProcessing',
    skillId: 46155,
    label: 'Rare Moon Ore Processing',
    tooltip:
      'Adds 2% yield per level for rare moon ore (Carnotite, Zircon, Pollucite, Cinnabar).',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
  {
    key: 'exceptionalMoonOreProcessing',
    skillId: 46156,
    label: 'Exceptional Moon Ore Processing',
    tooltip:
      'Adds 2% yield per level for exceptional moon ore (Xenotime, Monazite, Loparite, Ytterbite).',
    prerequisites: [{ key: 'reprocessingEfficiency', level: 5 }],
  },
]

export { typeIconUrl as skillIconUrl } from '@/lib/eveImages'

export const SKILL_KEY_TO_ID: Record<SkillFieldDef['key'], number> = Object.fromEntries(
  SKILL_FIELDS.map((f) => [f.key, f.skillId]),
) as Record<SkillFieldDef['key'], number>

/** Fallback training attributes when SDE row is missing primary/secondary. */
export const SKILL_ATTRIBUTE_FALLBACKS: Record<
  SkillFieldDef['key'],
  { primaryAttribute: import('@/types').EveAttributeId; secondaryAttribute: import('@/types').EveAttributeId }
> = {
  industry: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  advancedIndustry: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  massProduction: { primaryAttribute: 'memory', secondaryAttribute: 'charisma' },
  advancedMassProduction: { primaryAttribute: 'memory', secondaryAttribute: 'charisma' },
  laboratoryOperation: { primaryAttribute: 'memory', secondaryAttribute: 'perception' },
  advancedLaboratoryOperation: { primaryAttribute: 'memory', secondaryAttribute: 'perception' },
  reactions: { primaryAttribute: 'memory', secondaryAttribute: 'perception' },
  science: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  accounting: { primaryAttribute: 'charisma', secondaryAttribute: 'willpower' },
  brokerRelations: { primaryAttribute: 'charisma', secondaryAttribute: 'willpower' },
  advancedBrokerRelations: { primaryAttribute: 'charisma', secondaryAttribute: 'memory' },
  mining: { primaryAttribute: 'memory', secondaryAttribute: 'perception' },
  astrogeology: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  iceHarvesting: { primaryAttribute: 'memory', secondaryAttribute: 'perception' },
  gasCloudHarvesting: { primaryAttribute: 'memory', secondaryAttribute: 'perception' },
  miningBarge: { primaryAttribute: 'perception', secondaryAttribute: 'willpower' },
  exhumers: { primaryAttribute: 'perception', secondaryAttribute: 'willpower' },
  industrialCommandShips: { primaryAttribute: 'memory', secondaryAttribute: 'willpower' },
  capitalIndustrialShips: { primaryAttribute: 'memory', secondaryAttribute: 'willpower' },
  miningFrigate: { primaryAttribute: 'perception', secondaryAttribute: 'willpower' },
  expeditionFrigates: { primaryAttribute: 'perception', secondaryAttribute: 'willpower' },
  miningDirector: { primaryAttribute: 'charisma', secondaryAttribute: 'memory' },
  reprocessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  reprocessingEfficiency: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  simpleOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  coherentOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  variegatedOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  complexOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  mercoxitOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  abyssalOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  erraticOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  iceProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  ubiquitousMoonOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  commonMoonOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  uncommonMoonOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  rareMoonOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  exceptionalMoonOreProcessing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
}

export function skillIdForKey(key: string): number | undefined {
  return SKILL_KEY_TO_ID[key as SkillFieldDef['key']]
}

/** Primary / secondary attributes that set this skill's SP/min. */
export function trainingAttributesForSkill(
  skillId: number,
  skillMap?: Map<number, SkillInfo>,
): SkillAttributePair | null {
  const info = skillMap?.get(skillId)
  if (info?.primaryAttribute && info?.secondaryAttribute) {
    return {
      primaryAttribute: info.primaryAttribute,
      secondaryAttribute: info.secondaryAttribute,
    }
  }
  const field = SKILL_FIELDS.find((f) => f.skillId === skillId)
  return field ? SKILL_ATTRIBUTE_FALLBACKS[field.key] : null
}

export const SKILL_LEVEL_ROMAN = ['-', 'I', 'II', 'III', 'IV', 'V'] as const

export function formatSkillLevel(level: number): string {
  return SKILL_LEVEL_ROMAN[Math.min(5, Math.max(0, level))] ?? String(level)
}

/** Merge an ESI or character snapshot onto zero defaults for every tracked skill. */
export function normalizeImportedSkillLevels(skills: Partial<SkillLevels> | undefined): SkillLevels {
  return enforceSkillPrerequisites({ ...ZERO_SKILLS, ...(skills ?? {}) } as SkillLevels)
}

/**
 * Preserve explicitly assumed levels while filling fields absent from an older
 * character snapshot with the latest trained levels.
 */
export function mergeAssumedWithTrainedSkillLevels(
  assumed: Partial<SkillLevels> | undefined,
  trained: Partial<SkillLevels> | undefined,
): SkillLevels {
  const merged: SkillLevels = { ...ZERO_SKILLS }
  for (const field of SKILL_FIELDS) {
    const assumedLevel = assumed?.[field.key]
    const trainedLevel = trained?.[field.key]
    merged[field.key] =
      typeof assumedLevel === 'number'
        ? assumedLevel
        : typeof trainedLevel === 'number'
          ? trainedLevel
          : 0
  }
  return enforceSkillPrerequisites(merged)
}

export function skillLevel(
  skills: Partial<SkillLevels> | undefined,
  key: SkillFieldDef['key'],
): number {
  const level = skills?.[key]
  return typeof level === 'number' ? level : ZERO_SKILLS[key]
}

export function prerequisitesMet(
  skills: Partial<SkillLevels> | undefined,
  key: SkillFieldDef['key'],
): boolean {
  const field = SKILL_FIELDS.find((f) => f.key === key)
  if (!field?.prerequisites?.length) return true
  return field.prerequisites.every(
    (req) => skillLevel(skills, req.key) >= req.level && prerequisitesMet(skills, req.key),
  )
}

/** Highest level the slider allows (0 when prerequisites are not met). */
export function maxTrainableSkillLevel(
  skills: Partial<SkillLevels> | undefined,
  key: SkillFieldDef['key'],
): number {
  return prerequisitesMet(skills, key) ? 5 : 0
}

/** Level that counts for profit, IPH, and plan slots (0 when locked). */
export function effectiveSkillLevel(
  skills: Partial<SkillLevels> | undefined,
  key: SkillFieldDef['key'],
): number {
  if (!prerequisitesMet(skills, key)) return 0
  return skillLevel(skills, key)
}

export function skillPrerequisiteLabel(key: SkillFieldDef['key']): string | undefined {
  const field = SKILL_FIELDS.find((f) => f.key === key)
  if (!field?.prerequisites?.length) return undefined
  const parts = field.prerequisites.map((req) => {
    const prereq = SKILL_FIELDS.find((f) => f.key === req.key)
    return `${prereq?.label ?? req.key} ${formatSkillLevel(req.level)}`
  })
  return `Requires ${parts.join(' and ')}`
}

/** Zero dependent skills when their prerequisites are no longer met. */
export function enforceSkillPrerequisites(skills: SkillLevels): SkillLevels {
  const result = { ...skills }
  for (const { key } of SKILL_FIELDS) {
    if (!prerequisitesMet(result, key)) {
      result[key] = 0
    }
  }
  return result
}
