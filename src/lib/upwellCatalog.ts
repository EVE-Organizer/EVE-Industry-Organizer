import type {
  RefineryType,
  StructureType,
  UpwellCatalog,
  UpwellHull,
  UpwellRig,
  UpwellRigActivity,
  UpwellRoleBonuses,
} from '@/types'
import { REFINERY_HULL_PRESETS, STRUCTURE_HULL_PRESETS } from '@/types'

export const EMPTY_UPWELL: UpwellCatalog = { hulls: [], rigs: [] }

const ENG_HULL_TYPE_ID: Record<Exclude<StructureType, 'npc' | 'custom'>, number> = {
  raitaru: 35825,
  azbel: 35826,
  sotiyo: 35827,
}

const REFINERY_HULL_TYPE_ID: Record<Exclude<RefineryType, 'none' | 'custom'>, number> = {
  athanor: 35835,
  tatara: 35836,
}

let catalog: UpwellCatalog = EMPTY_UPWELL

export function setUpwellCatalog(next: UpwellCatalog | null | undefined): void {
  catalog = next?.hulls && next?.rigs ? next : EMPTY_UPWELL
}

export function getUpwellCatalog(): UpwellCatalog {
  return catalog
}

export function parseUpwellCatalog(raw: unknown): UpwellCatalog {
  if (!raw || typeof raw !== 'object') return EMPTY_UPWELL
  const hulls = Array.isArray((raw as UpwellCatalog).hulls) ? (raw as UpwellCatalog).hulls : []
  const rigs = Array.isArray((raw as UpwellCatalog).rigs) ? (raw as UpwellCatalog).rigs : []
  return { hulls, rigs }
}

function hullByTypeId(typeId: number): UpwellHull | undefined {
  return catalog.hulls.find((hull) => hull.typeId === typeId)
}

export function structureHullPreset(structureType: Exclude<StructureType, 'npc' | 'custom'>): {
  hullMeBonusPercent: number
  hullTeBonusPercent: number
  hullJobCostBonusPercent: number
} {
  const hull = hullByTypeId(ENG_HULL_TYPE_ID[structureType])
  if (!hull) return STRUCTURE_HULL_PRESETS[structureType]
  return {
    hullMeBonusPercent: hull.roleBonuses.me,
    hullTeBonusPercent: hull.roleBonuses.te,
    hullJobCostBonusPercent: hull.roleBonuses.jobCost,
  }
}

export function refineryHullPreset(refineryType: Exclude<RefineryType, 'none' | 'custom'>): {
  hullTeBonusPercent: number
} {
  const hull = hullByTypeId(REFINERY_HULL_TYPE_ID[refineryType])
  if (!hull) return REFINERY_HULL_PRESETS[refineryType]
  return { hullTeBonusPercent: hull.roleBonuses.te }
}

export function upwellRigByTypeId(typeId: number): UpwellRig | undefined {
  return catalog.rigs.find((rig) => rig.typeId === typeId)
}

export function upwellRigBonuses(typeId: number): UpwellRoleBonuses | undefined {
  const rig = upwellRigByTypeId(typeId)
  if (!rig) return undefined
  return { me: rig.me, te: rig.te, jobCost: rig.jobCost }
}

function manufacturingBonusRow(
  kind: 'me' | 'te' | 'jobCost',
  tier: 't1' | 't2',
): UpwellRig | undefined {
  return catalog.rigs.find(
    (rig) => rig.activity === 'manufacturing' && rig.tier === tier && rig[kind] > 0,
  )
}

export function catalogRigBase(kind: 'me' | 'te' | 'cost', tier: 't1' | 't2'): number | undefined {
  const field = kind === 'cost' ? 'jobCost' : kind
  return manufacturingBonusRow(field, tier)?.[field]
}

export function catalogRigIconTypeId(
  activity: UpwellRigActivity,
  family: string,
  size: 'm' | 'l' | 'xl' = 'm',
): number | undefined {
  const match = catalog.rigs.find(
    (rig) =>
      rig.activity === activity &&
      rig.size === size &&
      rig.tier === 't1' &&
      (family === '' || rig.families.includes(family)),
  )
  return match?.typeId
}
