import type { Remap } from '@/lib/characterPlan/sp'
import {
  BADGER_HS_EFT,
  BUSTARD_HS_EFT,
  HULK_HS_EFT,
  HULK_MLU2_EFT,
  PORPOISE_BURST_EFT,
  PORPOISE_BURST2_EFT,
  RETRIEVER_HS_EFT,
} from '@/lib/characterPlan/fits'
import type { SkillTarget } from '@/lib/characterPlan/buildPlan'

export interface PlanFit {
  id: string
  label: string
  eft: string
  note: string
}

export interface PlanStep {
  id: string
  title: string
  goal: string
  remap: Remap
  /** Skills trained in this step (prereqs expanded at build time). */
  targets: SkillTarget[]
  fits: PlanFit[]
  skip: string[]
}

export interface CharacterPath {
  id: string
  name: string
  role: string
  summary: string
  steps: PlanStep[]
}

const INT_MEM: Remap = { primary: 'intelligence', secondary: 'memory' }
const PER_WIL: Remap = { primary: 'perception', secondary: 'willpower' }
const CHA_MEM: Remap = { primary: 'charisma', secondary: 'memory' }
const CHA_WIL: Remap = { primary: 'charisma', secondary: 'willpower' }

const S = {
  industry: 3380,
  advancedIndustry: 3388,
  massProduction: 3387,
  advancedMassProduction: 24625,
  science: 3402,
  research: 3403,
  metallurgy: 3409,
  laboratoryOperation: 3406,
  cybernetics: 3411,
  industrialReconfiguration: 58956,
  mining: 3386,
  miningUpgrades: 22578,
  astrogeology: 3410,
  miningBarge: 17940,
  exhumers: 22551,
  miningFrigate: 32918,
  drones: 3436,
  miningDroneOperation: 3438,
  targetManagement: 3429,
  cpu: 3426,
  pgm: 3413,
  mechanics: 3392,
  hullUpgrades: 3394,
  shieldUpgrades: 3425,
  tacticalShield: 3420,
  cloaking: 11579,
  spaceshipCommand: 3327,
  caldariHauler: 3342,
  transportShips: 19719,
  oreHauler: 3184,
  industrialCommandShips: 29637,
  navigation: 3449,
  afterburner: 3450,
  hsm: 3454,
  warpDrive: 3455,
  leadership: 3348,
  miningForeman: 22536,
  miningDirector: 22552,
  trade: 3443,
  retail: 3444,
  wholesale: 16596,
  brokerRelations: 3446,
  accounting: 16622,
  marketing: 16598,
  advancedBroker: 16597,
} as const

export const CHARACTER_PATHS: CharacterPath[] = [
  {
    id: 'hauler',
    name: 'Hauler / manufacturer',
    role: 'Move product, run the factory jobs',
    summary:
      'This character hauls and builds. Month 1 gets a Badger on the road, then a Bustard for the Jita run. Manufacturing slots come in month 2 once the hull is online. Transport Ships I is enough to undock the Bustard; higher levels only grow the fleet hangar.',
    steps: [
      {
        id: 'h1',
        title: 'Month 1: Badger, then Bustard',
        goal: 'Haul T1 industrials immediately, then undock a cloaky Bustard for Jita and the build system.',
        remap: PER_WIL,
        targets: [
          { skillId: S.spaceshipCommand, level: 3 },
          { skillId: S.caldariHauler, level: 5 },
          { skillId: S.industry, level: 5 },
          { skillId: S.transportShips, level: 1 },
          { skillId: S.navigation, level: 3 },
          { skillId: S.afterburner, level: 3 },
          { skillId: S.hsm, level: 1 },
          { skillId: S.cpu, level: 4 },
          { skillId: S.cloaking, level: 3 },
          { skillId: S.hullUpgrades, level: 4 },
          { skillId: S.warpDrive, level: 4 },
          { skillId: S.shieldUpgrades, level: 1 },
          { skillId: S.pgm, level: 3 },
        ],
        fits: [
          {
            id: 'badger',
            label: 'Badger (first week)',
            eft: BADGER_HS_EFT,
            note: 'Caldari Hauler I plus Expanded Cargohold II. Compact MWD and Improved Cloak II need High Speed Maneuvering I and Cloaking III, so the cloak trick comes later in the month. Until then, stick to highsec and keep the cargo cheap.',
          },
          {
            id: 'bustard',
            label: 'Bustard HS cloak MWD',
            eft: BUSTARD_HS_EFT,
            note: 'Needs Caldari Hauler V, Industry V, Transport Ships I. Compact MWD (not T2) so you skip High Speed Maneuvering IV. Compact extenders skip Shield Upgrades IV. One warp stab plus the DST hull bonus is enough against a single point. Do not fit cargo expanders: they only touch the tiny main hold, not the fleet hangar.',
          },
        ],
        skip: [
          'Transport Ships V (fleet hangar size, train later if you actually fill 50k m³)',
          'Microwarpdrive II / High Speed Maneuvering IV',
          'Shield Upgrades IV and T2 large extenders (CPU/PG tax for little EHP in highsec)',
          'Cargohold Optimization rigs on the Bustard',
        ],
      },
      {
        id: 'h2',
        title: 'Month 2: more jobs, faster jobs',
        goal: 'Turn the hauler into the main manufacturer: 6 job slots, shorter runs, basic ME/TE research.',
        remap: INT_MEM,
        targets: [
          { skillId: S.massProduction, level: 5 },
          { skillId: S.advancedIndustry, level: 4 },
          { skillId: S.science, level: 4 },
          { skillId: S.laboratoryOperation, level: 4 },
          { skillId: S.research, level: 4 },
          { skillId: S.metallurgy, level: 4 },
          { skillId: S.transportShips, level: 3 },
          { skillId: S.tacticalShield, level: 4 },
        ],
        fits: [
          {
            id: 'bustard-m2',
            label: 'Same Bustard hull',
            eft: BUSTARD_HS_EFT,
            note: 'Optional swap: Compact EM Shield Hardener → Multispectrum Shield Hardener II after Tactical Shield Manipulation IV. Hangar grows with Transport Ships III (5% per level on the 50k fleet hangar).',
          },
        ],
        skip: [
          'Advanced Mass Production V (rank 8; III in month 3 is the slot bump that matters)',
          'Advanced Industry V (4% more time cut, long rank-3 train)',
          'Laboratory Operation V and Advanced Laboratory Operation unless you are drowning in research jobs',
        ],
      },
      {
        id: 'h3',
        title: 'Month 3: extra slots',
        goal: '11 manufacturing slots if you still have jobs queued. Stop when the extra slot is idle.',
        remap: INT_MEM,
        targets: [
          { skillId: S.advancedMassProduction, level: 3 },
          { skillId: S.advancedIndustry, level: 5 },
          { skillId: S.transportShips, level: 4 },
        ],
        fits: [],
        skip: [
          'Advanced Mass Production IV and V until you actually use 10 or 11 slots',
          'A second DST hull (Mastodon/Occator). One racial hauler V is the expensive gate; stay Caldari.',
        ],
      },
    ],
  },
  {
    id: 'miner',
    name: 'Miner / manufacturer',
    role: 'Feed minerals, boost, then Hulk yield',
    summary:
      'Same Omega clock as the hauler, different hulls. Retriever in week 1 so you are mining while the long barge skills run. Porpoise next (Mining Foreman V is the real gate, not Industrial Command Ships). Hulk is a month-2 hull: Exhumers I is cheap, Mining Barge V and Astrogeology V are not. Factory slots stay on the hauler character; this one lives in a belt.',
    steps: [
      {
        id: 'm1',
        title: 'Month 1: Retriever, then Porpoise',
        goal: 'Mine in a Retriever, then undock a Porpoise to boost and hold ore. Do not wait on the Hulk.',
        remap: INT_MEM,
        targets: [
          { skillId: S.industry, level: 5 },
          { skillId: S.mining, level: 4 },
          { skillId: S.science, level: 4 },
          { skillId: S.astrogeology, level: 3 },
          { skillId: S.miningFrigate, level: 3 },
          { skillId: S.miningBarge, level: 1 },
          { skillId: S.cpu, level: 4 },
          { skillId: S.miningUpgrades, level: 1 },
          { skillId: S.targetManagement, level: 3 },
          { skillId: S.leadership, level: 1 },
          { skillId: S.miningForeman, level: 5 },
          { skillId: S.miningDirector, level: 1 },
          { skillId: S.spaceshipCommand, level: 5 },
          { skillId: S.oreHauler, level: 3 },
          { skillId: S.industrialCommandShips, level: 1 },
          { skillId: S.drones, level: 1 },
          { skillId: S.miningDroneOperation, level: 1 },
        ],
        fits: [
          {
            id: 'retriever',
            label: 'Retriever (week 1)',
            eft: RETRIEVER_HS_EFT,
            note: 'Mining Barge I, Astrogeology III, Industry V, Mining Frigate III. Elara MLUs only need Mining Upgrades I. Strip Miner I needs Mining IV. This is the hull that pays for month 1.',
          },
          {
            id: 'porpoise',
            label: 'Porpoise HS boost',
            eft: PORPOISE_BURST_EFT,
            note: 'Industrial Command Ships I, ORE Hauler III, Mining Director I, Mining Foreman V. Burst I (not II) so you skip Leadership V this month. Skip the industrial core: Medium Industrial Core I requires Industrial Reconfiguration, which requires Advanced Mass Production I, which requires Mass Production V.',
          },
        ],
        skip: [
          'Hulk / Exhumers (Mining Barge V + Astrogeology V belong in month 2)',
          'Mining Laser Upgrade II (Mining Upgrades IV, after the hulls)',
          'Mining Foreman Burst II (Leadership V)',
          'Industrial core and compressors',
          'Mining Foreman Mindlink (Mining Director V)',
        ],
      },
      {
        id: 'm2',
        title: 'Month 2: Hulk yield',
        goal: 'Finish Mining Barge V and Astrogeology V, then undock the Hulk. Leave T2 MLUs for month 3; Elara upgrades already work.',
        remap: INT_MEM,
        targets: [
          { skillId: S.miningBarge, level: 5 },
          { skillId: S.astrogeology, level: 5 },
          { skillId: S.exhumers, level: 1 },
        ],
        fits: [
          {
            id: 'hulk',
            label: 'Hulk HS ore',
            eft: HULK_HS_EFT,
            note: 'Exhumers I is minutes once Mining Barge V and Astrogeology V are done. Strip Miner I until Mining V. Elara MLUs only need Mining Upgrades I. Hulk tank is still gankable in busy ice; mine in quieter highsec or sit under the Porpoise.',
          },
        ],
        skip: [
          'Exhumers V this month (yield per level is real, but rank 5 to V is a later polish)',
          'Modulated Strip Miner II until Mining V plus the ore-processing skill for that crystal',
          'Mackinaw / Skiff (one exhumer hull is enough)',
          'Orca (Industrial Command Ships V plus a much longer core train)',
        ],
      },
      {
        id: 'm3',
        title: 'Month 3: better boost and T2 MLUs',
        goal: 'Leadership V for Mining Foreman Burst II, Mining Upgrades IV for MLU II, Exhumers IV for more Hulk yield. Leave the industrial core until you want compression enough to train Mass Production V.',
        remap: CHA_WIL,
        targets: [
          { skillId: S.leadership, level: 5 },
          { skillId: S.miningDirector, level: 4 },
          { skillId: S.miningUpgrades, level: 4 },
          { skillId: S.exhumers, level: 4 },
          { skillId: S.mining, level: 5 },
        ],
        fits: [
          {
            id: 'porpoise-burst2',
            label: 'Porpoise HS boost II',
            eft: PORPOISE_BURST2_EFT,
            note: 'Burst II needs Leadership V, Mining Foreman V, Mining Director I. Skip the industrial core in this window: Medium Industrial Core I requires Industrial Reconfiguration I, which requires Advanced Mass Production I, which requires Mass Production V.',
          },
          {
            id: 'hulk-mlu2',
            label: 'Hulk HS ore MLU II',
            eft: HULK_MLU2_EFT,
            note: 'Swap Elara upgrades for Mining Laser Upgrade II after Mining Upgrades IV. Same hull, more m³/hr.',
          },
        ],
        skip: [
          'Mining Director V / mindlink until bursts are in daily use',
          'Industrial Command Ships V (Orca gate, not Porpoise)',
          'Mass Production V and the industrial core until you are compressing every session',
          'Every T2 crystal skill. Train Simple Ore Processing IV only for the rocks you actually mine.',
        ],
      },
    ],
  },
  {
    id: 'seller',
    name: 'Jita seller',
    role: 'List and relist in Jita 4-4',
    summary:
      'This character does not manufacture or haul. They sit in Jita IV Caldari Navy Assembly Plant and put up sell orders for the other two. Station trading does not need ship skills. Marketing II is only here because Wholesale requires it; you still list from the same station.',
    steps: [
      {
        id: 's1',
        title: 'Month 1: tax, fees, 65 orders',
        goal: 'Trade V + Retail V = 65 orders. Broker Relations V and Accounting IV cut the Jita NPC take.',
        remap: CHA_MEM,
        targets: [
          { skillId: S.trade, level: 5 },
          { skillId: S.retail, level: 5 },
          { skillId: S.brokerRelations, level: 5 },
          { skillId: S.accounting, level: 4 },
          { skillId: S.marketing, level: 2 },
        ],
        fits: [],
        skip: [
          'Any hauler or combat ship',
          'Marketing III to V, Procurement, Visibility, Daytrading (those are for remote orders while you are not in Jita)',
          'Tycoon (32 orders per level at rank 6)',
          'Accounting V this month (rank 3 to V is month 2, when volume justifies it)',
        ],
      },
      {
        id: 's2',
        title: 'Month 2: Accounting V and more slots',
        goal: 'Sales tax to 3.375%. Wholesale for extra orders when 65 is not enough.',
        remap: CHA_MEM,
        targets: [
          { skillId: S.accounting, level: 5 },
          { skillId: S.wholesale, level: 3 },
          { skillId: S.advancedBroker, level: 4 },
        ],
        fits: [],
        skip: [
          'Wholesale V and Tycoon until you are actually hitting the order cap',
          'Advanced Broker Relations V if you rarely modify orders (it only helps relist fees)',
        ],
      },
      {
        id: 's3',
        title: 'Month 3: only if the order bar is full',
        goal: 'Wholesale IV or V for 129 to 145 orders. Stop if you still have empty slots.',
        remap: CHA_MEM,
        targets: [
          { skillId: S.wholesale, level: 5 },
        ],
        fits: [],
        skip: [
          'Tycoon I+ unless you are a full-time station trader with hundreds of items',
          'Jump Freighter / Bowhead. The hauler character already moves the boxes.',
        ],
      },
    ],
  },
]

export const PLAN_ASSUMPTIONS = {
  clone: 'Omega, three separate accounts so all three queues run at once',
  remap: 'Neural remap 27 primary / 21 secondary / 17 elsewhere, one remap per step',
  implants: 'Optional +3 attribute implants (Cybernetics I). +5 needs Cybernetics V and is not in this plan.',
  start: 'From a new character. Subtract anything you already trained.',
}
