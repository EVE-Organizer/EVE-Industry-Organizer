import type { EveAttribute } from '@/lib/characterPlan/sp'

export interface SkillAttrs {
  primary: EveAttribute
  secondary: EveAttribute
}

/**
 * Training attributes for skills used in the industry alts plan.
 * Defaults to Intelligence / Memory when a skill is missing (most industry skills).
 */
export const SKILL_ATTRIBUTES: Record<number, SkillAttrs> = {
  // Industry / science
  3380: { primary: 'intelligence', secondary: 'memory' }, // Industry
  3388: { primary: 'intelligence', secondary: 'memory' }, // Advanced Industry
  3387: { primary: 'intelligence', secondary: 'memory' }, // Mass Production
  24625: { primary: 'intelligence', secondary: 'memory' }, // Advanced Mass Production
  3402: { primary: 'intelligence', secondary: 'memory' }, // Science
  3403: { primary: 'intelligence', secondary: 'memory' }, // Research
  3409: { primary: 'intelligence', secondary: 'memory' }, // Metallurgy
  3406: { primary: 'intelligence', secondary: 'memory' }, // Laboratory Operation
  24624: { primary: 'intelligence', secondary: 'memory' }, // Advanced Laboratory Operation
  3411: { primary: 'intelligence', secondary: 'memory' }, // Cybernetics
  58956: { primary: 'intelligence', secondary: 'memory' }, // Industrial Reconfiguration
  // Mining
  3386: { primary: 'intelligence', secondary: 'memory' }, // Mining
  22578: { primary: 'intelligence', secondary: 'memory' }, // Mining Upgrades
  3410: { primary: 'intelligence', secondary: 'memory' }, // Astrogeology
  17940: { primary: 'intelligence', secondary: 'memory' }, // Mining Barge
  22551: { primary: 'intelligence', secondary: 'memory' }, // Exhumers
  32918: { primary: 'perception', secondary: 'willpower' }, // Mining Frigate
  3436: { primary: 'memory', secondary: 'perception' }, // Drones
  3438: { primary: 'memory', secondary: 'perception' }, // Mining Drone Operation
  3429: { primary: 'intelligence', secondary: 'memory' }, // Target Management
  60377: { primary: 'intelligence', secondary: 'memory' }, // Simple Ore Processing
  3385: { primary: 'intelligence', secondary: 'memory' }, // Reprocessing
  // Fitting / tank / cloak
  3426: { primary: 'intelligence', secondary: 'memory' }, // CPU Management
  3413: { primary: 'intelligence', secondary: 'memory' }, // Power Grid Management
  3392: { primary: 'intelligence', secondary: 'memory' }, // Mechanics
  3394: { primary: 'intelligence', secondary: 'memory' }, // Hull Upgrades
  3416: { primary: 'intelligence', secondary: 'memory' }, // Shield Operation
  3419: { primary: 'intelligence', secondary: 'memory' }, // Shield Management
  3425: { primary: 'intelligence', secondary: 'memory' }, // Shield Upgrades
  3420: { primary: 'intelligence', secondary: 'memory' }, // Tactical Shield Manipulation
  11579: { primary: 'intelligence', secondary: 'memory' }, // Cloaking
  26252: { primary: 'intelligence', secondary: 'memory' }, // Jury Rigging
  26254: { primary: 'intelligence', secondary: 'memory' }, // Astronautics Rigging
  26261: { primary: 'intelligence', secondary: 'memory' }, // Shield Rigging
  // Navigation / ships
  3327: { primary: 'perception', secondary: 'willpower' }, // Spaceship Command
  3342: { primary: 'perception', secondary: 'willpower' }, // Caldari Hauler
  19719: { primary: 'perception', secondary: 'willpower' }, // Transport Ships
  3184: { primary: 'perception', secondary: 'willpower' }, // ORE Hauler
  29637: { primary: 'perception', secondary: 'willpower' }, // Industrial Command Ships
  3449: { primary: 'intelligence', secondary: 'perception' }, // Navigation
  3450: { primary: 'intelligence', secondary: 'perception' }, // Afterburner
  3454: { primary: 'intelligence', secondary: 'perception' }, // High Speed Maneuvering
  3455: { primary: 'intelligence', secondary: 'perception' }, // Warp Drive Operation
  // Fleet / boosting
  3348: { primary: 'charisma', secondary: 'willpower' }, // Leadership
  22536: { primary: 'charisma', secondary: 'willpower' }, // Mining Foreman
  22552: { primary: 'charisma', secondary: 'willpower' }, // Mining Director
  3354: { primary: 'charisma', secondary: 'willpower' }, // Command Burst Specialist
  3350: { primary: 'charisma', secondary: 'willpower' }, // Shield Command
  // Trade
  3443: { primary: 'charisma', secondary: 'memory' }, // Trade
  3444: { primary: 'charisma', secondary: 'memory' }, // Retail
  16596: { primary: 'charisma', secondary: 'memory' }, // Wholesale
  18580: { primary: 'charisma', secondary: 'memory' }, // Tycoon
  3446: { primary: 'charisma', secondary: 'memory' }, // Broker Relations
  16622: { primary: 'charisma', secondary: 'memory' }, // Accounting
  16598: { primary: 'charisma', secondary: 'memory' }, // Marketing
  16597: { primary: 'charisma', secondary: 'memory' }, // Advanced Broker Relations
  16595: { primary: 'charisma', secondary: 'memory' }, // Daytrading
}

export const DEFAULT_SKILL_ATTRS: SkillAttrs = {
  primary: 'intelligence',
  secondary: 'memory',
}

export function skillAttrs(skillId: number): SkillAttrs {
  return SKILL_ATTRIBUTES[skillId] ?? DEFAULT_SKILL_ATTRS
}
