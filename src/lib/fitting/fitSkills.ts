import {
  ADVANCED_WEAPON_UPGRADES,
  ARMOR_RIGGING,
  CPU_MANAGEMENT,
  ELECTRONICS_UPGRADES,
  ENERGY_WEAPON_RIGGING,
  HYBRID_WEAPON_RIGGING,
  LAUNCHER_RIGGING,
  POWER_GRID_MANAGEMENT,
  PROJECTILE_WEAPON_RIGGING,
  RIGGING_SKILL_BY_FAMILY,
  WEAPON_UPGRADES,
  type FitLoad,
  type FitSkillRow,
  type FittingData,
  type FittingIndex,
  type FittingLevels,
  type FittingType,
  type ParsedFit,
  type ResolvedFitItem,
  type SkillInfoLite,
} from '@/lib/fitting/types'

export function buildFittingIndex(data: FittingData): FittingIndex {
  const byId = new Map<number, FittingType>()
  const byName = new Map<string, FittingType>()
  for (const type of data.types) {
    byId.set(type.typeId, type)
    byName.set(type.name.toLowerCase(), type)
  }
  return { byId, byName }
}

export function lookupType(index: FittingIndex, name: string): FittingType | undefined {
  return index.byName.get(name.trim().toLowerCase())
}

export function resolveFit(
  parsed: ParsedFit,
  index: FittingIndex,
): { ship: FittingType; items: ResolvedFitItem[]; unknown: string[] } {
  const ship = lookupType(index, parsed.shipName)
  if (!ship || ship.category !== 'Ship') {
    throw new Error(`Unknown ship: ${parsed.shipName}`)
  }
  const unknown: string[] = []
  const items: ResolvedFitItem[] = []
  for (const item of parsed.items) {
    const type = lookupType(index, item.name)
    if (!type) {
      unknown.push(item.name)
      continue
    }
    const charge = item.chargeName ? lookupType(index, item.chargeName) : undefined
    if (item.chargeName && !charge) unknown.push(item.chargeName)
    items.push({ type, quantity: item.quantity, charge, offline: item.offline ?? false })
  }
  return { ship, items, unknown }
}

function clampLevel(level: number | undefined): number {
  if (!Number.isFinite(level)) return 0
  return Math.min(5, Math.max(0, Math.floor(level ?? 0)))
}

export function emptyFittingLevels(): FittingLevels {
  return {
    cpuManagement: 0,
    powerGridManagement: 0,
    weaponUpgrades: 0,
    advancedWeaponUpgrades: 0,
    electronicsUpgrades: 0,
    rigging: {},
  }
}

export function levelsFromSkillMap(trained: Map<number, number>): FittingLevels {
  const rigging: Record<string, number> = {}
  for (const [family, skillId] of Object.entries(RIGGING_SKILL_BY_FAMILY)) {
    rigging[family] = clampLevel(trained.get(skillId))
  }
  return {
    cpuManagement: clampLevel(trained.get(CPU_MANAGEMENT)),
    powerGridManagement: clampLevel(trained.get(POWER_GRID_MANAGEMENT)),
    weaponUpgrades: clampLevel(trained.get(WEAPON_UPGRADES)),
    advancedWeaponUpgrades: clampLevel(trained.get(ADVANCED_WEAPON_UPGRADES)),
    electronicsUpgrades: clampLevel(trained.get(ELECTRONICS_UPGRADES)),
    rigging,
  }
}

function onlineItems(items: ResolvedFitItem[]): ResolvedFitItem[] {
  return items.filter((item) => !item.offline && item.type.category === 'Module')
}

function drawbackMultiplier(
  item: FittingType,
  rigs: FittingType[],
  levels: FittingLevels,
  stat: 'cpu' | 'power',
): number {
  let mult = 1
  const family = item.family
  if (!family) return 1
  for (const rig of rigs) {
    const draw = rig.rigDrawback
    if (!draw || draw.stat !== stat || draw.family !== family) continue
    const skill = clampLevel(levels.rigging[draw.family])
    const pct = draw.pct * (1 - 0.1 * skill)
    mult *= 1 + pct / 100
  }
  return mult
}

export function moduleCpu(item: FittingType, levels: FittingLevels, rigs: FittingType[]): number {
  let cpu = item.cpu ?? 0
  if (item.weapon) cpu *= 1 - 0.05 * levels.weaponUpgrades
  if (item.electronicsUpgrades) cpu *= 1 - 0.05 * levels.electronicsUpgrades
  cpu *= drawbackMultiplier(item, rigs, levels, 'cpu')
  return cpu
}

export function modulePower(item: FittingType, levels: FittingLevels, rigs: FittingType[]): number {
  let power = item.power ?? 0
  if (item.weapon === 'turret' || item.weapon === 'launcher') {
    power *= 1 - 0.02 * levels.advancedWeaponUpgrades
  }
  power *= drawbackMultiplier(item, rigs, levels, 'power')
  return power
}

export function computeFitLoad(
  ship: FittingType,
  items: ResolvedFitItem[],
  levels: FittingLevels,
): FitLoad {
  const online = onlineItems(items)
  const rigs = online.map((item) => item.type).filter((type) => type.rigDrawback)
  let cpuUsed = 0
  let powerUsed = 0
  for (const item of online) {
    cpuUsed += moduleCpu(item.type, levels, rigs) * item.quantity
    powerUsed += modulePower(item.type, levels, rigs) * item.quantity
  }
  const cpuOutput = (ship.cpuOutput ?? 0) * (1 + 0.05 * levels.cpuManagement)
  const powerOutput = (ship.powerOutput ?? 0) * (1 + 0.05 * levels.powerGridManagement)
  return {
    cpuUsed,
    cpuOutput,
    powerUsed,
    powerOutput,
    cpuOk: cpuUsed <= cpuOutput + 1e-6,
    powerOk: powerUsed <= powerOutput + 1e-6,
  }
}

function mergeSkill(into: Map<number, number>, skillId: number, level: number): void {
  const current = into.get(skillId) ?? 0
  if (level > current) into.set(skillId, level)
}

function collectDirectSkills(ship: FittingType, items: ResolvedFitItem[]): Map<number, number> {
  const required = new Map<number, number>()
  for (const skill of ship.skills ?? []) mergeSkill(required, skill.skillId, skill.level)
  for (const item of items) {
    for (const skill of item.type.skills ?? []) mergeSkill(required, skill.skillId, skill.level)
    for (const skill of item.charge?.skills ?? []) mergeSkill(required, skill.skillId, skill.level)
  }
  return required
}

export function expandPrerequisites(
  required: Map<number, number>,
  skills: SkillInfoLite[],
): Map<number, number> {
  const byId = new Map(skills.map((skill) => [skill.skillId, skill]))
  const out = new Map(required)
  const queue = [...out.entries()]
  while (queue.length) {
    const [skillId] = queue.pop() ?? []
    if (skillId == null) break
    const info = byId.get(skillId)
    if (!info) continue
    for (const pre of info.prerequisites) {
      const current = out.get(pre.skillId) ?? 0
      if (pre.level > current) {
        out.set(pre.skillId, pre.level)
        queue.push([pre.skillId, pre.level])
      }
    }
  }
  return out
}

export function requiredSkills(
  ship: FittingType,
  items: ResolvedFitItem[],
  skills: SkillInfoLite[],
): Map<number, number> {
  return expandPrerequisites(collectDirectSkills(ship, items), skills)
}

function spToLevel(rank: number, level: number): number {
  const table = [0, 250, 1414, 8000, 45255, 256000]
  return Math.round((table[level] ?? 0) * rank)
}

function extraSp(skillId: number, from: number, to: number, skills: SkillInfoLite[]): number {
  if (to <= from) return 0
  const rank = skills.find((skill) => skill.skillId === skillId)?.rank ?? 1
  return spToLevel(rank, to) - spToLevel(rank, from)
}

function floorsFromRequired(required: Map<number, number>): FittingLevels {
  const levels = emptyFittingLevels()
  levels.cpuManagement = required.get(CPU_MANAGEMENT) ?? 0
  levels.powerGridManagement = required.get(POWER_GRID_MANAGEMENT) ?? 0
  levels.weaponUpgrades = required.get(WEAPON_UPGRADES) ?? 0
  levels.advancedWeaponUpgrades = required.get(ADVANCED_WEAPON_UPGRADES) ?? 0
  levels.electronicsUpgrades = required.get(ELECTRONICS_UPGRADES) ?? 0
  for (const [family, skillId] of Object.entries(RIGGING_SKILL_BY_FAMILY)) {
    levels.rigging[family] = required.get(skillId) ?? 0
  }
  return levels
}

function fittingSkillSp(levels: FittingLevels, floors: FittingLevels, skills: SkillInfoLite[]): number {
  let sp = 0
  sp += extraSp(CPU_MANAGEMENT, floors.cpuManagement, levels.cpuManagement, skills)
  sp += extraSp(POWER_GRID_MANAGEMENT, floors.powerGridManagement, levels.powerGridManagement, skills)
  sp += extraSp(WEAPON_UPGRADES, floors.weaponUpgrades, levels.weaponUpgrades, skills)
  sp += extraSp(ADVANCED_WEAPON_UPGRADES, floors.advancedWeaponUpgrades, levels.advancedWeaponUpgrades, skills)
  sp += extraSp(ELECTRONICS_UPGRADES, floors.electronicsUpgrades, levels.electronicsUpgrades, skills)
  for (const [family, skillId] of Object.entries(RIGGING_SKILL_BY_FAMILY)) {
    sp += extraSp(skillId, floors.rigging[family] ?? 0, levels.rigging[family] ?? 0, skills)
  }
  return sp
}

function usedFamilies(items: ResolvedFitItem[]): Set<string> {
  const families = new Set<string>()
  for (const item of items) {
    if (item.type.rigDrawback) families.add(item.type.rigDrawback.family)
  }
  return families
}

/** Lowest extra SP combo of fitting skills that makes the fit go online. */
export function minFittingLevels(
  ship: FittingType,
  items: ResolvedFitItem[],
  required: Map<number, number>,
  skills: SkillInfoLite[],
): { levels: FittingLevels; load: FitLoad } | null {
  const floors = floorsFromRequired(required)
  const families = [...usedFamilies(items)]
  let best: { levels: FittingLevels; load: FitLoad; sp: number } | null = null

  const cpuRange = range(floors.cpuManagement, 5)
  const pgmRange = range(floors.powerGridManagement, 5)
  const wuRange = range(floors.weaponUpgrades, 5)
  const awuRange = range(floors.advancedWeaponUpgrades, 5)
  const euRange = range(floors.electronicsUpgrades, 5)

  for (const cpuManagement of cpuRange) {
    for (const powerGridManagement of pgmRange) {
      for (const weaponUpgrades of wuRange) {
        for (const advancedWeaponUpgrades of awuRange) {
          for (const electronicsUpgrades of euRange) {
            const combos = familyCombos(families, floors)
            for (const rigging of combos) {
              const levels: FittingLevels = {
                cpuManagement,
                powerGridManagement,
                weaponUpgrades,
                advancedWeaponUpgrades,
                electronicsUpgrades,
                rigging,
              }
              const load = computeFitLoad(ship, items, levels)
              if (!load.cpuOk || !load.powerOk) continue
              const sp = fittingSkillSp(levels, floors, skills)
              if (!best || sp < best.sp) best = { levels, load, sp }
            }
          }
        }
      }
    }
  }

  return best ? { levels: best.levels, load: best.load } : null
}

function range(from: number, to: number): number[] {
  const start = clampLevel(from)
  const out = []
  for (let i = start; i <= to; i++) out.push(i)
  return out
}

function familyCombos(families: string[], floors: FittingLevels): Record<string, number>[] {
  if (families.length === 0) return [{ ...floors.rigging }]
  const [first, ...rest] = families
  const tail = familyCombos(rest, floors)
  const out: Record<string, number>[] = []
  for (const level of range(floors.rigging[first] ?? 0, 5)) {
    for (const combo of tail) {
      out.push({ ...combo, [first]: level })
    }
  }
  return out
}

export function skillRows(
  required: Map<number, number>,
  skills: SkillInfoLite[],
  trained?: Map<number, number>,
): FitSkillRow[] {
  const byId = new Map(skills.map((skill) => [skill.skillId, skill]))
  const rows: FitSkillRow[] = []
  for (const [skillId, level] of required) {
    const info = byId.get(skillId)
    rows.push({
      skillId,
      name: info?.name ?? `Skill ${skillId}`,
      required: level,
      trained: trained?.get(skillId),
      rank: info?.rank ?? 1,
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

export function mergeFittingSkills(
  required: Map<number, number>,
  levels: FittingLevels,
): Map<number, number> {
  const out = new Map(required)
  mergeSkill(out, CPU_MANAGEMENT, levels.cpuManagement)
  mergeSkill(out, POWER_GRID_MANAGEMENT, levels.powerGridManagement)
  mergeSkill(out, WEAPON_UPGRADES, levels.weaponUpgrades)
  mergeSkill(out, ADVANCED_WEAPON_UPGRADES, levels.advancedWeaponUpgrades)
  mergeSkill(out, ELECTRONICS_UPGRADES, levels.electronicsUpgrades)
  for (const [family, skillId] of Object.entries(RIGGING_SKILL_BY_FAMILY)) {
    mergeSkill(out, skillId, levels.rigging[family] ?? 0)
  }
  return out
}

export function formatMw(value: number): string {
  return `${value.toFixed(2)} MW`
}

export function formatCpu(value: number): string {
  return `${value.toFixed(2)} tf`
}

export {
  CPU_MANAGEMENT,
  POWER_GRID_MANAGEMENT,
  WEAPON_UPGRADES,
  ADVANCED_WEAPON_UPGRADES,
  ELECTRONICS_UPGRADES,
  ENERGY_WEAPON_RIGGING,
  HYBRID_WEAPON_RIGGING,
  PROJECTILE_WEAPON_RIGGING,
  LAUNCHER_RIGGING,
  ARMOR_RIGGING,
}
