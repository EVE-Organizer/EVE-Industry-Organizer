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
  /** Per-level manufacturing time cut when this skill is on the BPO (0 = gate only). */
  manufacturingTimeBonus?: number
  /** UI group key for the skills editor. */
  group?: 'industry' | 'science' | 'invention' | 'advancedMfg' | 'trade' | 'mining' | 'reprocessing'
}

/** Manufacturing and market skills editable in Settings. */
export const SKILL_FIELDS: SkillFieldDef[] = [
  {
    key: 'industry',
    skillId: 3380,
    label: 'Industry',
    tooltip:
      'Cuts manufacturing job time by 4% per level. Required by most manufacturing blueprints. Your level is also checked against each blueprint\'s Industry requirement for the "Only buildable" filter and skill gap flags.',
    group: 'industry',
  },
  {
    key: 'advancedIndustry',
    skillId: 3388,
    label: 'Advanced Industry',
    tooltip:
      'Cuts manufacturing job time by 3% per level. Higher levels raise IPH and profit per hour in rankings. Also required by some advanced blueprints.',
    prerequisites: [{ key: 'industry', level: 3 }],
    group: 'industry',
  },
  {
    key: 'massProduction',
    skillId: 3387,
    label: 'Mass Production',
    tooltip:
      'Adds one concurrent manufacturing job per level (plus one base slot). Used for production plan timelines.',
    prerequisites: [{ key: 'industry', level: 3 }],
    group: 'industry',
  },
  {
    key: 'advancedMassProduction',
    skillId: 24625,
    label: 'Advanced Mass Production',
    tooltip:
      'Adds one more concurrent manufacturing job per level on top of Mass Production. Max 11 slots at V/V.',
    prerequisites: [{ key: 'massProduction', level: 5 }],
    group: 'industry',
  },
  {
    key: 'massReactions',
    skillId: 45748,
    label: 'Mass Reactions',
    tooltip:
      'Adds one concurrent reaction job per level on top of one base slot. Reactions use a separate slot pool from manufacturing.',
    prerequisites: [{ key: 'reactions', level: 3 }],
    group: 'industry',
  },
  {
    key: 'advancedMassReactions',
    skillId: 45749,
    label: 'Advanced Mass Reactions',
    tooltip:
      'Adds one more concurrent reaction job per level on top of Mass Reactions. Max 11 reaction slots at V/V.',
    prerequisites: [{ key: 'massReactions', level: 5 }],
    group: 'industry',
  },
  {
    key: 'reactions',
    skillId: 45746,
    label: 'Reactions',
    tooltip:
      'Cuts reaction job time by 4% per level. Required by reaction formulas in supply chains and plans.',
    group: 'industry',
  },
  {
    key: 'science',
    skillId: 3402,
    label: 'Science',
    tooltip:
      'Cuts copy job time by 5% per level. Required by a small set of blueprints. Prerequisite for Laboratory Operation. Used for the buildable filter and skill gap flags.',
    group: 'science',
  },
  {
    key: 'laboratoryOperation',
    skillId: 3406,
    label: 'Laboratory Operation',
    tooltip:
      'Adds one concurrent science job (copy, invention, research) per level on top of one base slot. Used for research pipeline timelines.',
    prerequisites: [{ key: 'science', level: 3 }],
    group: 'science',
  },
  {
    key: 'advancedLaboratoryOperation',
    skillId: 24624,
    label: 'Advanced Laboratory Operation',
    tooltip:
      'Adds one more concurrent science job per level on top of Laboratory Operation. Max 11 science slots at V/V.',
    prerequisites: [{ key: 'laboratoryOperation', level: 5 }],
    group: 'science',
  },
  {
    key: 'advancedSmallShipConstruction',
    skillId: 3395,
    label: 'Advanced Small Ship Construction',
    tooltip: 'Required for advanced frigates and destroyers. Cuts their manufacturing time by 1% per level.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'advancedMediumShipConstruction',
    skillId: 3397,
    label: 'Advanced Medium Ship Construction',
    tooltip: 'Required for advanced cruisers and battlecruisers. Cuts their manufacturing time by 1% per level.',
    prerequisites: [{ key: 'advancedSmallShipConstruction', level: 4 }],
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'advancedLargeShipConstruction',
    skillId: 3398,
    label: 'Advanced Large Ship Construction',
    tooltip: 'Required for advanced battleships. Cuts their manufacturing time by 1% per level.',
    prerequisites: [{ key: 'advancedMediumShipConstruction', level: 4 }],
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'advancedIndustrialShipConstruction',
    skillId: 3396,
    label: 'Advanced Industrial Ship Construction',
    tooltip: 'Required for blockade runners and deep space transports. Cuts their manufacturing time by 1% per level.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'advancedCapitalShipConstruction',
    skillId: 77725,
    label: 'Advanced Capital Ship Construction',
    tooltip: 'Required for advanced capital ships. Cuts their manufacturing time by 1% per level.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'outpostConstruction',
    skillId: 3400,
    label: 'Outpost Construction',
    tooltip: 'Required for Upwell structures. Cuts their manufacturing time by 1% per level.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'capitalShipConstruction',
    skillId: 22242,
    label: 'Capital Ship Construction',
    tooltip: 'Required to manufacture capital ships. No manufacturing time bonus.',
    group: 'advancedMfg',
  },
  {
    key: 'drugManufacturing',
    skillId: 26224,
    label: 'Drug Manufacturing',
    tooltip: 'Required to manufacture boosters via the manufacturing interface. No time bonus.',
    group: 'advancedMfg',
  },
  {
    key: 'amarrStarshipEngineering',
    skillId: 11444,
    label: 'Amarr Starship Engineering',
    tooltip: 'Datacore science for Amarr ships and related items. Cuts manufacturing time by 1% per level when required.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'caldariStarshipEngineering',
    skillId: 11454,
    label: 'Caldari Starship Engineering',
    tooltip: 'Datacore science for Caldari ships and related items. Cuts manufacturing time by 1% per level when required.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'gallenteStarshipEngineering',
    skillId: 11450,
    label: 'Gallente Starship Engineering',
    tooltip: 'Datacore science for Gallente ships and related items. Cuts manufacturing time by 1% per level when required.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'minmatarStarshipEngineering',
    skillId: 11445,
    label: 'Minmatar Starship Engineering',
    tooltip: 'Datacore science for Minmatar ships and related items. Cuts manufacturing time by 1% per level when required.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'triglavianQuantumEngineering',
    skillId: 52307,
    label: 'Triglavian Quantum Engineering',
    tooltip: 'Datacore science for Triglavian items. Cuts manufacturing time by 1% per level when required.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'upwellStarshipEngineering',
    skillId: 81050,
    label: 'Upwell Starship Engineering',
    tooltip: 'Datacore science for Upwell items. Cuts manufacturing time by 1% per level when required.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'electromagneticPhysics',
    skillId: 11448,
    label: 'Electromagnetic Physics',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'electronicEngineering',
    skillId: 11453,
    label: 'Electronic Engineering',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'gravitonPhysics',
    skillId: 11446,
    label: 'Graviton Physics',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'highEnergyPhysics',
    skillId: 11433,
    label: 'High Energy Physics',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'hydromagneticPhysics',
    skillId: 11443,
    label: 'Hydromagnetic Physics',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'laserPhysics',
    skillId: 11447,
    label: 'Laser Physics',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'mechanicalEngineering',
    skillId: 11452,
    label: 'Mechanical Engineering',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'molecularEngineering',
    skillId: 11529,
    label: 'Molecular Engineering',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'naniteEngineering',
    skillId: 11442,
    label: 'Nanite Engineering',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'nuclearPhysics',
    skillId: 11451,
    label: 'Nuclear Physics',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'plasmaPhysics',
    skillId: 11441,
    label: 'Plasma Physics',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'quantumPhysics',
    skillId: 11455,
    label: 'Quantum Physics',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'rocketScience',
    skillId: 11449,
    label: 'Rocket Science',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'astronauticEngineering',
    skillId: 11487,
    label: 'Astronautic Engineering',
    tooltip: 'Invention datacore science. Cuts manufacturing time by 1% per level when required on a BPO.',
    manufacturingTimeBonus: 0.01,
    group: 'advancedMfg',
  },
  {
    key: 'mutagenicStabilization',
    skillId: 81896,
    label: 'Mutagenic Stabilization',
    tooltip: 'Required for some booster manufacturing. Cuts manufacturing time by 2% per level when required.',
    manufacturingTimeBonus: 0.02,
    group: 'advancedMfg',
  },
  {
    key: 'amarrEncryptionMethods',
    skillId: 23087,
    label: 'Amarr Encryption Methods',
    tooltip: 'Invention encryption for Amarr T2 items. Each level adds 2.5% relative success chance.',
    group: 'invention',
  },
  {
    key: 'caldariEncryptionMethods',
    skillId: 21790,
    label: 'Caldari Encryption Methods',
    tooltip: 'Invention encryption for Caldari T2 items. Each level adds 2.5% relative success chance.',
    group: 'invention',
  },
  {
    key: 'gallenteEncryptionMethods',
    skillId: 23121,
    label: 'Gallente Encryption Methods',
    tooltip: 'Invention encryption for Gallente T2 items. Each level adds 2.5% relative success chance.',
    group: 'invention',
  },
  {
    key: 'minmatarEncryptionMethods',
    skillId: 21791,
    label: 'Minmatar Encryption Methods',
    tooltip: 'Invention encryption for Minmatar T2 items. Each level adds 2.5% relative success chance.',
    group: 'invention',
  },
  {
    key: 'sleeperEncryptionMethods',
    skillId: 3408,
    label: 'Sleeper Encryption Methods',
    tooltip: 'Encryption for T3 reverse engineering. Each level adds 2.5% relative success chance.',
    group: 'invention',
  },
  {
    key: 'triglavianEncryptionMethods',
    skillId: 52308,
    label: 'Triglavian Encryption Methods',
    tooltip: 'Invention encryption for Triglavian T2 items. Each level adds 2.5% relative success chance.',
    group: 'invention',
  },
  {
    key: 'upwellEncryptionMethods',
    skillId: 55025,
    label: 'Upwell Encryption Methods',
    tooltip: 'Invention encryption for Upwell T2 items. Each level adds 2.5% relative success chance.',
    group: 'invention',
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
  massReactions: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  advancedMassReactions: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  advancedSmallShipConstruction: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  advancedMediumShipConstruction: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  advancedLargeShipConstruction: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  advancedIndustrialShipConstruction: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  advancedCapitalShipConstruction: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  outpostConstruction: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  capitalShipConstruction: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  drugManufacturing: { primaryAttribute: 'memory', secondaryAttribute: 'intelligence' },
  amarrStarshipEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  caldariStarshipEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  gallenteStarshipEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  minmatarStarshipEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  triglavianQuantumEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  upwellStarshipEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  electromagneticPhysics: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  electronicEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  gravitonPhysics: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  highEnergyPhysics: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  hydromagneticPhysics: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  laserPhysics: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  mechanicalEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  molecularEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  naniteEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  nuclearPhysics: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  plasmaPhysics: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  quantumPhysics: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  rocketScience: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  astronauticEngineering: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  mutagenicStabilization: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  amarrEncryptionMethods: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  caldariEncryptionMethods: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  gallenteEncryptionMethods: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  minmatarEncryptionMethods: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  sleeperEncryptionMethods: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  triglavianEncryptionMethods: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
  upwellEncryptionMethods: { primaryAttribute: 'intelligence', secondaryAttribute: 'memory' },
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
