import type { SkillInfo, TypeInfo } from '@/types'
import type { ParsedEftFit } from '@/lib/eftParse'
import { formatSkillLevel } from '@/lib/skillFields'

export type FitSlot = 'ship' | 'high' | 'mid' | 'low' | 'rig' | 'subsystem' | 'drone' | 'charge' | 'implant' | 'module'

export interface FittingItemRecord {
  slot: FitSlot
  pg?: number
  cpu?: number
  pgOut?: number
  cpuOut?: number
  cal?: number
  calOut?: number
  meta?: number
  rigSize?: number
  drawback?: number
  de?: number[]
  skills?: [number, number][]
}

export type FitRole = 'dps' | 'tank' | 'logi' | 'general'
export type FitGoal = 'fits' | 'flies'

export const FITTING_SKILL_IDS = {
  cpuManagement: 3426,
  powerGridManagement: 3413,
  weaponUpgrades: 3318,
  advancedWeaponUpgrades: 11207,
  shieldUpgrades: 3425,
  energyGridUpgrades: 3424,
  electronicsUpgrades: 3427,
} as const

export const RIGGING_SKILL_IDS = {
  juryRigging: 26252,
  armor: 26253,
  astronautics: 26254,
  drones: 26255,
  electronicSuperiority: 26256,
  energyWeapon: 26258,
  projectileWeapon: 26257,
  hybridWeapon: 26259,
  launcher: 26260,
  shield: 26261,
} as const

/** T2 rigs need the matching skill at IV. T1 still lists it at I so rigging shows up under skills to fit. */
const RIG_GROUP_SKILL: Record<string, number> = {
  'Rig Armor': RIGGING_SKILL_IDS.armor,
  'Rig Shield': RIGGING_SKILL_IDS.shield,
  'Rig Drones': RIGGING_SKILL_IDS.drones,
  'Rig Navigation': RIGGING_SKILL_IDS.astronautics,
  'Rig Anchor': RIGGING_SKILL_IDS.astronautics,
  'Rig Core': RIGGING_SKILL_IDS.electronicSuperiority,
  'Rig Electronic Systems': RIGGING_SKILL_IDS.electronicSuperiority,
  'Rig Scanning': RIGGING_SKILL_IDS.electronicSuperiority,
  'Rig Targeting': RIGGING_SKILL_IDS.electronicSuperiority,
  'Rig Resource Processing': RIGGING_SKILL_IDS.electronicSuperiority,
  'Rig Energy Weapon': RIGGING_SKILL_IDS.energyWeapon,
  'Rig Hybrid Weapon': RIGGING_SKILL_IDS.hybridWeapon,
  'Rig Projectile Weapon': RIGGING_SKILL_IDS.projectileWeapon,
  'Rig Launcher': RIGGING_SKILL_IDS.launcher,
}

const RIGGING_SKILL_SET = new Set<number>(Object.values(RIGGING_SKILL_IDS))

const DRAWBACK_LABELS: Record<number, string> = {
  2706: 'Laser PG',
  2707: 'Hybrid PG',
  2708: 'Projectile PG',
  2712: 'Armor HP',
  2713: 'CPU output',
  2714: 'Launcher CPU',
  2716: 'Signature',
  2717: 'Agility',
  2718: 'Shield HP',
  3528: 'Cap recharge',
  5267: 'Repairer PG',
  5268: 'Cap repairer PG',
  5868: 'Cargo',
  5951: 'Warp speed',
}

const FIT_PG_DRAWBACK_IDS = new Set([2706, 2707, 2708, 5267, 5268])
const FIT_CPU_DRAWBACK_IDS = new Set([2713, 2714])

/** ponytail: standard stacking, not a full dogma sim. */
const STACKING = [1, 0.86911998, 0.57058314, 0.28295522, 0.10599055]

export function effectiveDrawbackPct(basePct: number, skillLevel: number): number {
  return basePct * (1 - 0.1 * Math.min(5, Math.max(0, skillLevel)))
}

export function stackedPercentMult(percents: number[]): number {
  if (!percents.length) return 1
  const sorted = [...percents].sort((a, b) => Math.abs(b) - Math.abs(a))
  let mult = 1
  for (let i = 0; i < sorted.length; i++) {
    mult *= 1 + (sorted[i]! / 100) * (STACKING[i] ?? 0)
  }
  return mult
}

function drawbackHitsModulePg(effectId: number, group: string): boolean {
  if (effectId === 2706) return group === 'Energy Weapon'
  if (effectId === 2707) return group === 'Hybrid Weapon'
  if (effectId === 2708) return group === 'Projectile Weapon'
  if (effectId === 5267) return /repair/i.test(group)
  if (effectId === 5268) return /capacitor booster|energy transfer|remote capacitor/i.test(group)
  return false
}

function drawbackHitsModuleCpu(effectId: number, group: string): boolean {
  return effectId === 2714 && /launcher/i.test(group)
}

const FITTING_SKILL_SET = new Set<number>(Object.values(FITTING_SKILL_IDS))

/** CCP rank-1 skillpoints to reach each level. */
const SP_AT_LEVEL = [0, 250, 1415, 8000, 45255, 256000]

/** ponytail: no attribute remap/implants; 30 SP/min is unmapped ~20/20. */
export const DEFAULT_SP_PER_MIN = 30

const WEAPON_GROUP_RE =
  /turret|launcher|smartbomb|missile|rocket|torpedo|railgun|blaster|pulse|beam|autocannon|artillery|precursor|disintegrator|energy weapon|hybrid weapon|projectile weapon/i

const DPS_SUPPORT_IDS = [3310, 3311, 3312, 3315, 3316, 3317, 20312, 12441, 12442, 20212, 20314, 21071]
const TANK_SUPPORT_IDS = [3416, 3419, 16069, 21802, 3394, 12365, 21059]
const LOGI_SUPPORT_IDS = [3421, 3422, 3423, 16069, 27902, 21803, 24568]

export interface FitPiece {
  name: string
  typeId: number | null
  slot: FitSlot | 'unknown'
  quantity: number
  pg: number
  cpu: number
  cal: number
  required: { skillId: number; level: number }[]
  enough: boolean
  missing: { skillId: number; name: string; need: number; have: number }[]
  sizeOk: boolean
}

export interface ResourceCheck {
  used: number
  output: number
  ok: boolean
}

export interface SkillGapRow {
  skillId: number
  name: string
  need: number
  have: number
  enough: boolean
  kind: 'fit' | 'use' | 'fitting'
}

export interface RigDrawbackRow {
  name: string
  typeId: number
  label: string
  basePct: number
  nowPct: number
  atVPct: number
  skillId: number
  skillName: string
  skillLevel: number
  affectsFit: boolean
}

export interface TrainQueueItem {
  skillId: number
  name: string
  from: number
  to: number
  sp: number
  minutes: number
}

export interface FitSkillAnalysis {
  hullName: string
  fitName: string
  hullTypeId: number | null
  unresolved: string[]
  online: boolean
  rigSizeOk: boolean
  pg: ResourceCheck
  cpu: ResourceCheck
  cal: ResourceCheck
  rigDrawbacks: RigDrawbackRow[]
  fittingLevels: Record<number, number>
  pieces: FitPiece[]
  fitSkills: SkillGapRow[]
  useSkills: SkillGapRow[]
  owned: FitPiece[]
  queueFits: TrainQueueItem[]
  queueFlies: TrainQueueItem[]
  queueFitsMinutes: number
  queueFliesMinutes: number
  budgetMinutes: number
  queueFitsWithinBudget: TrainQueueItem[]
  queueFliesWithinBudget: TrainQueueItem[]
}

export function buildTypeNameIndex(types: TypeInfo[]): Map<string, TypeInfo> {
  const map = new Map<string, TypeInfo>()
  for (const type of types) {
    map.set(type.name.toLowerCase(), type)
  }
  return map
}

export function esiLevelsFromSkills(
  skills: { skill_id: number; trained_skill_level: number }[] | undefined,
): Map<number, number> {
  const map = new Map<number, number>()
  for (const skill of skills ?? []) {
    map.set(skill.skill_id, Math.min(5, Math.max(0, skill.trained_skill_level)))
  }
  return map
}

const LEVEL_TOKEN = /^(i|ii|iii|iv|v|[0-5])$/i

export function parsePastedSkillLevels(text: string, skills: SkillInfo[]): Map<number, number> {
  const byName = new Map(skills.map((s) => [s.name.toLowerCase(), s.skillId]))
  const levels = new Map<number, number>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const colon = line.match(/^(.+?)[:]\s*(\S+)\s*$/)
    const spaced = line.match(/^(.+?)\s+(\S+)\s*$/)
    const match = colon ?? spaced
    if (!match) continue
    const name = match[1]!.trim().toLowerCase()
    const level = parseSkillLevelToken(match[2]!)
    const skillId = byName.get(name)
    if (skillId == null || level == null) continue
    levels.set(skillId, level)
  }
  return levels
}

function parseSkillLevelToken(token: string): number | null {
  const t = token.trim().toLowerCase()
  if (!LEVEL_TOKEN.test(t)) return null
  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 }
  if (t in roman) return roman[t]!
  const n = Number(t)
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : null
}

export function skillpointsToLevel(rank: number, level: number): number {
  const clamped = Math.min(5, Math.max(0, Math.floor(level)))
  return SP_AT_LEVEL[clamped]! * rank
}

export function skillpointsBetween(rank: number, from: number, to: number): number {
  return Math.max(0, skillpointsToLevel(rank, to) - skillpointsToLevel(rank, from))
}

export function formatTrainTime(minutes: number): string {
  if (minutes <= 0) return '0m'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = minutes / 60
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`
  return `${(hours / 24).toFixed(1)}d`
}

export function formatDrawbackPct(pct: number): string {
  if (pct === 0) return '0%'
  const rounded = Math.round(pct * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`
}

function groupOf(type: TypeInfo | undefined): string {
  return type?.group ?? ''
}

function isTech2Rig(record: FittingItemRecord, name: string): boolean {
  if ((record.meta ?? 0) >= 2) return true
  return /\sII$/.test(name)
}

export function riggingSkillsFor(group: string, name: string, record: FittingItemRecord): { skillId: number; level: number }[] {
  if (record.slot !== 'rig' && !group.startsWith('Rig ')) return []
  const skillId = RIG_GROUP_SKILL[group]
  if (!skillId) return []
  return [{ skillId, level: isTech2Rig(record, name) ? 4 : 1 }]
}

function isWeaponGroup(group: string): boolean {
  return WEAPON_GROUP_RE.test(group)
}

function requiresSkill(record: FittingItemRecord | undefined, skillId: number): boolean {
  return (record?.skills ?? []).some(([id]) => id === skillId)
}

function pgMult(record: FittingItemRecord, group: string, levels: Record<number, number>): number {
  let mult = 1
  if (isWeaponGroup(group)) {
    mult *= 1 - 0.02 * (levels[FITTING_SKILL_IDS.advancedWeaponUpgrades] ?? 0)
  }
  if (requiresSkill(record, FITTING_SKILL_IDS.shieldUpgrades)) {
    mult *= 1 - 0.05 * (levels[FITTING_SKILL_IDS.shieldUpgrades] ?? 0)
  }
  if (requiresSkill(record, FITTING_SKILL_IDS.energyGridUpgrades)) {
    mult *= 1 - 0.05 * (levels[FITTING_SKILL_IDS.energyGridUpgrades] ?? 0)
  }
  return mult
}

function cpuMult(record: FittingItemRecord, group: string, levels: Record<number, number>): number {
  let mult = 1
  if (isWeaponGroup(group)) {
    mult *= 1 - 0.05 * (levels[FITTING_SKILL_IDS.weaponUpgrades] ?? 0)
  }
  if (requiresSkill(record, FITTING_SKILL_IDS.electronicsUpgrades)) {
    mult *= 1 - 0.05 * (levels[FITTING_SKILL_IDS.electronicsUpgrades] ?? 0)
  }
  return mult
}

function shipOutput(base: number, bonusSkillLevel: number): number {
  return base * (1 + 0.05 * bonusSkillLevel)
}

function usedResources(
  pieces: { record: FittingItemRecord; group: string; quantity: number }[],
  levels: Record<number, number>,
): { pg: number; cpu: number; cal: number; cpuOutMult: number } {
  const rigs = pieces.filter((piece) => piece.record.slot === 'rig')

  function percentsFor(match: (effectId: number, group: string) => boolean, group: string): number[] {
    const percents: number[] = []
    for (const rig of rigs) {
      const effects = rig.record.de ?? []
      if (!effects.some((effectId) => match(effectId, group))) continue
      const skillId = RIG_GROUP_SKILL[rig.group]
      const skillLevel = skillId != null ? (levels[skillId] ?? 0) : 0
      percents.push(effectiveDrawbackPct(rig.record.drawback ?? 0, skillLevel))
    }
    return percents
  }

  const cpuOutMult = stackedPercentMult(percentsFor((effectId) => effectId === 2713, ''))
  let pg = 0
  let cpu = 0
  let cal = 0
  for (const piece of pieces) {
    const slot = piece.record.slot
    if (slot === 'charge' || slot === 'drone' || slot === 'implant' || slot === 'ship') continue
    const pgMultNow =
      (piece.record.pg ?? 0) === 0
        ? 0
        : pgMult(piece.record, piece.group, levels) *
          stackedPercentMult(percentsFor(drawbackHitsModulePg, piece.group))
    const cpuMultNow =
      (piece.record.cpu ?? 0) === 0
        ? 0
        : cpuMult(piece.record, piece.group, levels) *
          stackedPercentMult(percentsFor(drawbackHitsModuleCpu, piece.group))
    pg += (piece.record.pg ?? 0) * pgMultNow
    cpu += (piece.record.cpu ?? 0) * cpuMultNow
    cal += piece.record.cal ?? 0
  }
  return { pg, cpu, cal, cpuOutMult }
}

export function analyzeFit(options: {
  parsed: ParsedEftFit
  typesByName: Map<string, TypeInfo>
  fittingByTypeId: Map<number, FittingItemRecord>
  skills: SkillInfo[]
  characterLevels: Map<number, number>
  role: FitRole
  budgetDays: number
  spPerMin?: number
}): FitSkillAnalysis {
  const {
    parsed,
    typesByName,
    fittingByTypeId,
    skills,
    characterLevels,
    role,
    budgetDays,
  } = options
  const spPerMin = options.spPerMin ?? DEFAULT_SP_PER_MIN
  const skillById = new Map(skills.map((s) => [s.skillId, s]))
  const unresolved: string[] = [...parsed.unknown]

  function lookup(name: string): TypeInfo | undefined {
    return typesByName.get(name.toLowerCase())
  }

  const hullType = parsed.hullName ? lookup(parsed.hullName) : undefined
  if (parsed.hullName && !hullType) unresolved.push(parsed.hullName)
  const hullRecord = hullType ? fittingByTypeId.get(hullType.typeId) : undefined

  const modulePieces: { record: FittingItemRecord; group: string; quantity: number; name: string }[] =
    []
  const pieces: FitPiece[] = []

  function addPiece(name: string, quantity: number, fallbackSlot: FitSlot): void {
    const type = lookup(name)
    if (!type) {
      unresolved.push(name)
      pieces.push({
        name,
        typeId: null,
        slot: 'unknown',
        quantity,
        pg: 0,
        cpu: 0,
        cal: 0,
        required: [],
        enough: false,
        sizeOk: true,
        missing: [{ skillId: 0, name: 'Unknown type', need: 1, have: 0 }],
      })
      return
    }
    const record = { ...(fittingByTypeId.get(type.typeId) ?? { slot: fallbackSlot }) }
    if (type.category === 'Implant' || type.group === 'Booster') record.slot = 'implant'
    const required = [
      ...(record.skills ?? []).map(([skillId, level]) => ({ skillId, level })),
      ...riggingSkillsFor(type.group, type.name, record),
    ]
    const hullRigSize = hullRecord?.rigSize ?? 0
    const sizeOk =
      record.slot !== 'rig' || hullRigSize === 0 || (record.rigSize ?? 0) === 0 || record.rigSize === hullRigSize
    const missing = required
      .filter((req) => (characterLevels.get(req.skillId) ?? 0) < req.level)
      .map((req) => ({
        skillId: req.skillId,
        name: skillById.get(req.skillId)?.name ?? `Skill ${req.skillId}`,
        need: req.level,
        have: characterLevels.get(req.skillId) ?? 0,
      }))
    if (!sizeOk) {
      missing.push({ skillId: 0, name: 'Wrong rig size', need: hullRigSize, have: record.rigSize ?? 0 })
    }
    pieces.push({
      name: type.name,
      typeId: type.typeId,
      slot: record.slot,
      quantity,
      pg: record.pg ?? 0,
      cpu: record.cpu ?? 0,
      cal: record.cal ?? 0,
      required,
      enough: missing.length === 0,
      sizeOk,
      missing,
    })
    if (record.slot !== 'charge') {
      modulePieces.push({ record, group: groupOf(type), quantity, name: type.name })
    }
  }

  if (hullType) addPiece(hullType.name, 1, 'ship')

  for (const line of parsed.lines) {
    if (line.emptySlot) continue
    addPiece(line.name, line.quantity, 'module')
    if (line.chargeName) addPiece(line.chargeName, line.quantity, 'charge')
  }

  const hasWeapons = modulePieces.some((p) => isWeaponGroup(p.group))
  const needWu = hasWeapons
  const needAwu = hasWeapons && modulePieces.some((p) => isWeaponGroup(p.group) && (p.record.pg ?? 0) > 0)
  const needShield = modulePieces.some((p) => requiresSkill(p.record, FITTING_SKILL_IDS.shieldUpgrades))
  const needEgu = modulePieces.some((p) => requiresSkill(p.record, FITTING_SKILL_IDS.energyGridUpgrades))
  const needEu = modulePieces.some((p) => requiresSkill(p.record, FITTING_SKILL_IDS.electronicsUpgrades))
  const needPg = modulePieces.some((p) => (p.record.pg ?? 0) > 0)
  const needCpu = modulePieces.some((p) => (p.record.cpu ?? 0) > 0)

  const currentFitting: Record<number, number> = {
    [FITTING_SKILL_IDS.powerGridManagement]: characterLevels.get(FITTING_SKILL_IDS.powerGridManagement) ?? 0,
    [FITTING_SKILL_IDS.cpuManagement]: characterLevels.get(FITTING_SKILL_IDS.cpuManagement) ?? 0,
    [FITTING_SKILL_IDS.weaponUpgrades]: characterLevels.get(FITTING_SKILL_IDS.weaponUpgrades) ?? 0,
    [FITTING_SKILL_IDS.advancedWeaponUpgrades]: characterLevels.get(FITTING_SKILL_IDS.advancedWeaponUpgrades) ?? 0,
    [FITTING_SKILL_IDS.shieldUpgrades]: characterLevels.get(FITTING_SKILL_IDS.shieldUpgrades) ?? 0,
    [FITTING_SKILL_IDS.energyGridUpgrades]: characterLevels.get(FITTING_SKILL_IDS.energyGridUpgrades) ?? 0,
    [FITTING_SKILL_IDS.electronicsUpgrades]: characterLevels.get(FITTING_SKILL_IDS.electronicsUpgrades) ?? 0,
  }

  const drawbackSkills: { id: number; min: number }[] = []
  const drawbackSkillMins = new Map<number, number>()
  for (const piece of modulePieces) {
    if (piece.record.slot !== 'rig') continue
    const skillId = RIG_GROUP_SKILL[piece.group]
    if (skillId == null) continue
    const affectsFit = (piece.record.de ?? []).some(
      (effectId) => FIT_PG_DRAWBACK_IDS.has(effectId) || FIT_CPU_DRAWBACK_IDS.has(effectId),
    )
    if (!affectsFit) continue
    const min = isTech2Rig(piece.record, piece.name) ? 4 : 0
    drawbackSkillMins.set(skillId, Math.max(drawbackSkillMins.get(skillId) ?? 0, min))
  }
  for (const [id, min] of drawbackSkillMins) {
    currentFitting[id] = characterLevels.get(id) ?? 0
    drawbackSkills.push({ id, min })
  }

  const pgOutBase = hullRecord?.pgOut ?? 0
  const cpuOutBase = hullRecord?.cpuOut ?? 0
  const calOut = hullRecord?.calOut ?? 0

  function mergeLevels(fitting: Record<number, number>): Record<number, number> {
    const merged = { ...fitting }
    for (const [skillId, level] of characterLevels) {
      merged[skillId] = Math.max(merged[skillId] ?? 0, level)
    }
    return merged
  }

  function check(levels: Record<number, number>): {
    pg: ResourceCheck
    cpu: ResourceCheck
    cal: ResourceCheck
    rigSizeOk: boolean
    online: boolean
  } {
    const used = usedResources(modulePieces, mergeLevels(levels))
    const pgOut = shipOutput(pgOutBase, levels[FITTING_SKILL_IDS.powerGridManagement] ?? 0)
    const cpuOut =
      shipOutput(cpuOutBase, levels[FITTING_SKILL_IDS.cpuManagement] ?? 0) * used.cpuOutMult
    const pg = { used: used.pg, output: pgOut, ok: used.pg <= pgOut + 1e-6 }
    const cpu = { used: used.cpu, output: cpuOut, ok: used.cpu <= cpuOut + 1e-6 }
    const cal = { used: used.cal, output: calOut, ok: calOut === 0 || used.cal <= calOut + 1e-6 }
    const rigSizeOk = pieces.every((p) => p.sizeOk)
    return { pg, cpu, cal, rigSizeOk, online: pg.ok && cpu.ok && cal.ok && rigSizeOk }
  }

  const fittingLevels = cheapestFittingLevels({
    current: currentFitting,
    needPg,
    needCpu,
    needWu,
    needAwu,
    needShield,
    needEgu,
    needEu,
    extra: drawbackSkills,
    skillById,
    fits: (levels) => check(levels).online,
  })

  const withFitting = check(fittingLevels)
  const requiredFit = new Map<number, number>()
  const requiredUse = new Map<number, number>()

  for (const piece of pieces) {
    const isUse =
      piece.slot === 'charge' || piece.slot === 'drone' || piece.slot === 'implant'
    for (const req of piece.required) {
      const target = isUse ? requiredUse : requiredFit
      target.set(req.skillId, Math.max(target.get(req.skillId) ?? 0, req.level))
    }
  }

  for (const [skillId, level] of Object.entries(fittingLevels)) {
    const id = Number(skillId)
    if (level > (characterLevels.get(id) ?? 0)) {
      requiredFit.set(id, Math.max(requiredFit.get(id) ?? 0, level))
    }
  }

  const fitSkills = toGapRows(requiredFit, characterLevels, skillById, 'fit')
  const useSkills = toGapRows(requiredUse, characterLevels, skillById, 'use')

  const fliesNeed = new Map(requiredFit)
  for (const [id, level] of requiredUse) fliesNeed.set(id, Math.max(fliesNeed.get(id) ?? 0, level))
  for (const [id, level] of requiredFit) {
    if (!FITTING_SKILL_SET.has(id)) fliesNeed.set(id, Math.max(level, 5))
  }
  for (const extraId of extraSkillsForRole(role, pieces, modulePieces)) {
    fliesNeed.set(extraId, Math.max(fliesNeed.get(extraId) ?? 0, 4))
  }

  const queueFits = buildQueue(requiredFit, characterLevels, skillById, spPerMin)
  const queueFlies = buildQueue(fliesNeed, characterLevels, skillById, spPerMin)
  const budgetMinutes = Math.max(0, budgetDays) * 24 * 60

  return {
    hullName: hullType?.name ?? parsed.hullName,
    fitName: parsed.fitName,
    hullTypeId: hullType?.typeId ?? null,
    unresolved: [...new Set(unresolved)],
    online: withFitting.online,
    rigSizeOk: withFitting.rigSizeOk,
    pg: withFitting.pg,
    cpu: withFitting.cpu,
    cal: withFitting.cal,
    rigDrawbacks: collectRigDrawbacks(
      pieces,
      typesByName,
      fittingByTypeId,
      mergeLevels(fittingLevels),
      skillById,
    ),
    fittingLevels,
    pieces,
    fitSkills,
    useSkills,
    owned: pieces,
    queueFits,
    queueFlies,
    queueFitsMinutes: queueFits.reduce((sum, item) => sum + item.minutes, 0),
    queueFliesMinutes: queueFlies.reduce((sum, item) => sum + item.minutes, 0),
    budgetMinutes,
    queueFitsWithinBudget: cutQueue(queueFits, budgetMinutes),
    queueFliesWithinBudget: cutQueue(queueFlies, budgetMinutes),
  }
}

function extraSkillsForRole(
  role: FitRole,
  pieces: FitPiece[],
  modulePieces: { group: string }[],
): number[] {
  if (role === 'general') return []
  const groups = modulePieces.map((p) => p.group).join(' ')
  const names = pieces.map((p) => p.name).join(' ')
  const hay = `${groups} ${names}`
  if (role === 'dps') return DPS_SUPPORT_IDS
  if (role === 'tank') {
    if (/shield/i.test(hay)) return TANK_SUPPORT_IDS
    if (/armor|plate|repairer/i.test(hay)) return TANK_SUPPORT_IDS
    return TANK_SUPPORT_IDS
  }
  if (role === 'logi') {
    if (/remote|logistics|capacitor emission/i.test(hay)) return LOGI_SUPPORT_IDS
    return LOGI_SUPPORT_IDS
  }
  return []
}

function collectRigDrawbacks(
  pieces: FitPiece[],
  typesByName: Map<string, TypeInfo>,
  fittingByTypeId: Map<number, FittingItemRecord>,
  plannedLevels: Record<number, number>,
  skillById: Map<number, SkillInfo>,
): RigDrawbackRow[] {
  const rows: RigDrawbackRow[] = []
  for (const piece of pieces) {
    if (piece.slot !== 'rig' || piece.typeId == null) continue
    const record = fittingByTypeId.get(piece.typeId)
    if (!record) continue
    const group = typesByName.get(piece.name.toLowerCase())?.group ?? ''
    const skillId = RIG_GROUP_SKILL[group] ?? 0
    const skillLevel = skillId ? (plannedLevels[skillId] ?? 0) : 0
    const basePct = record.drawback ?? 0
    for (const effectId of record.de ?? []) {
      const label = DRAWBACK_LABELS[effectId]
      if (!label) continue
      rows.push({
        name: piece.name,
        typeId: piece.typeId,
        label,
        basePct,
        nowPct: effectiveDrawbackPct(basePct, skillLevel),
        atVPct: effectiveDrawbackPct(basePct, 5),
        skillId,
        skillName: skillById.get(skillId)?.name ?? 'Rigging',
        skillLevel,
        affectsFit: FIT_PG_DRAWBACK_IDS.has(effectId) || FIT_CPU_DRAWBACK_IDS.has(effectId),
      })
    }
  }
  return rows
}

function toGapRows(
  needed: Map<number, number>,
  have: Map<number, number>,
  skillById: Map<number, SkillInfo>,
  kind: SkillGapRow['kind'],
): SkillGapRow[] {
  const rows: SkillGapRow[] = []
  for (const [skillId, need] of needed) {
    const trained = have.get(skillId) ?? 0
    rows.push({
      skillId,
      name: skillById.get(skillId)?.name ?? `Skill ${skillId}`,
      need,
      have: trained,
      enough: trained >= need,
      kind: FITTING_SKILL_SET.has(skillId) || RIGGING_SKILL_SET.has(skillId) ? 'fitting' : kind,
    })
  }
  rows.sort((a, b) => Number(a.enough) - Number(b.enough) || a.name.localeCompare(b.name))
  return rows
}

function expandPrereqs(
  needed: Map<number, number>,
  skillById: Map<number, SkillInfo>,
): Map<number, number> {
  const out = new Map(needed)
  const stack = [...out.keys()]
  while (stack.length) {
    const skillId = stack.pop()!
    const info = skillById.get(skillId)
    if (!info) continue
    for (const req of info.prerequisites) {
      const prev = out.get(req.skillId) ?? 0
      if (req.level > prev) {
        out.set(req.skillId, req.level)
        stack.push(req.skillId)
      }
    }
  }
  return out
}

function buildQueue(
  needed: Map<number, number>,
  have: Map<number, number>,
  skillById: Map<number, SkillInfo>,
  spPerMin: number,
): TrainQueueItem[] {
  const full = expandPrereqs(needed, skillById)
  const remaining = new Map<number, number>()
  for (const [skillId, to] of full) {
    const from = have.get(skillId) ?? 0
    if (to > from) remaining.set(skillId, to)
  }

  const items: TrainQueueItem[] = []
  const trained = new Map(have)

  while (remaining.size) {
    const ready: number[] = []
    for (const skillId of remaining.keys()) {
      const info = skillById.get(skillId)
      const prereqs = info?.prerequisites ?? []
      if (prereqs.every((req) => (trained.get(req.skillId) ?? 0) >= req.level)) {
        ready.push(skillId)
      }
    }
    if (!ready.length) {
      ready.push([...remaining.keys()][0]!)
    }
    ready.sort((a, b) => (skillById.get(a)?.name ?? '').localeCompare(skillById.get(b)?.name ?? ''))
    const skillId = ready[0]!
    const to = remaining.get(skillId)!
    const from = trained.get(skillId) ?? 0
    const rank = skillById.get(skillId)?.rank ?? 1
    const sp = skillpointsBetween(rank, from, to)
    items.push({
      skillId,
      name: skillById.get(skillId)?.name ?? `Skill ${skillId}`,
      from,
      to,
      sp,
      minutes: sp / spPerMin,
    })
    trained.set(skillId, to)
    remaining.delete(skillId)
  }
  return items
}

function cutQueue(queue: TrainQueueItem[], budgetMinutes: number): TrainQueueItem[] {
  if (budgetMinutes <= 0) return []
  const out: TrainQueueItem[] = []
  let used = 0
  for (const item of queue) {
    if (used + item.minutes > budgetMinutes) break
    out.push(item)
    used += item.minutes
  }
  return out
}

function cheapestFittingLevels(options: {
  current: Record<number, number>
  needPg: boolean
  needCpu: boolean
  needWu: boolean
  needAwu: boolean
  needShield: boolean
  needEgu: boolean
  needEu: boolean
  extra?: { id: number; min: number }[]
  skillById: Map<number, SkillInfo>
  fits: (levels: Record<number, number>) => boolean
}): Record<number, number> {
  const ids: number[] = []
  if (options.needPg) ids.push(FITTING_SKILL_IDS.powerGridManagement)
  if (options.needCpu) ids.push(FITTING_SKILL_IDS.cpuManagement)
  if (options.needWu) ids.push(FITTING_SKILL_IDS.weaponUpgrades)
  if (options.needAwu) ids.push(FITTING_SKILL_IDS.advancedWeaponUpgrades)
  if (options.needShield) ids.push(FITTING_SKILL_IDS.shieldUpgrades)
  if (options.needEgu) ids.push(FITTING_SKILL_IDS.energyGridUpgrades)
  if (options.needEu) ids.push(FITTING_SKILL_IDS.electronicsUpgrades)
  const extraMin = new Map<number, number>()
  for (const extra of options.extra ?? []) {
    extraMin.set(extra.id, extra.min)
    if (!ids.includes(extra.id)) ids.push(extra.id)
  }

  const start = { ...options.current }
  for (const [id, min] of extraMin) {
    start[id] = Math.max(start[id] ?? 0, min)
  }
  if (options.fits(start)) return start
  if (!ids.length) return start

  let best: Record<number, number> | null = null
  let bestSp = Infinity

  function rec(index: number, levels: Record<number, number>): void {
    if (index >= ids.length) {
      const wu = levels[FITTING_SKILL_IDS.weaponUpgrades] ?? 0
      const awu = levels[FITTING_SKILL_IDS.advancedWeaponUpgrades] ?? 0
      if (awu > 0 && wu < 4) return
      if (!options.fits(levels)) return
      let sp = 0
      for (const id of ids) {
        const rank = options.skillById.get(id)?.rank ?? 2
        sp += skillpointsBetween(rank, options.current[id] ?? 0, levels[id] ?? 0)
      }
      if (sp < bestSp) {
        bestSp = sp
        best = { ...levels }
      }
      return
    }
    const id = ids[index]!
    const from = Math.max(options.current[id] ?? 0, extraMin.get(id) ?? 0)
    for (let level = from; level <= 5; level++) {
      rec(index + 1, { ...levels, [id]: level })
    }
  }

  rec(0, start)
  return best ?? { ...start, ...Object.fromEntries(ids.map((id) => [id, 5])) }
}

export function formatGapLevel(row: Pick<SkillGapRow, 'need' | 'have'>): string {
  return `${formatSkillLevel(row.have)} / ${formatSkillLevel(row.need)}`
}
