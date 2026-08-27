import { computeFitLoad, levelsFromSkillMap } from '@/lib/fitting/fitSkills'
import { clampLevel, omniEhp, skillPct, stackingProduct } from '@/lib/fitting/stacking'
import type {
  FitResists,
  FitShipStats,
  FitStatsContext,
  FitTankLayer,
  FittingType,
  FleetLinkId,
  ResolvedFitItem,
  ShipTrait,
} from '@/lib/fitting/types'
import {
  ACCELERATION_CONTROL,
  DRONE_INTERFACING,
  ENERGY_MANAGEMENT,
  ENERGY_SYSTEMS_OPERATION,
  EVASIVE_MANEUVERING,
  HIGH_SPEED_MANEUVERING,
  HULL_UPGRADES,
  MECHANICS,
  MOTION_PREDICTION,
  NAVIGATION,
  RAPID_FIRING,
  SHARPSHOOTER,
  SHIELD_MANAGEMENT,
} from '@/lib/fitting/types'

const BASE_WEAPON_SCALE = 5.5

function lvl(map: Map<number, number>, id: number): number {
  return clampLevel(map.get(id))
}

function onlineModules(items: ResolvedFitItem[]): ResolvedFitItem[] {
  return items.filter((item) => !item.offline && item.type.category === 'Module')
}

function chargeDamage(charge?: FittingType): number {
  const d = charge?.combat?.damage
  if (!d) return 0
  if (d.total) return d.total
  return (d.em ?? 0) + (d.thermal ?? 0) + (d.kinetic ?? 0) + (d.explosive ?? 0)
}

function parseTraitMultiplier(traits: ShipTrait[] | undefined, skillLevels: Map<number, number>, keywords: string[]): number {
  if (!traits?.length) return 1
  let mult = 1
  for (const trait of traits) {
    const text = trait.text.toLowerCase()
    if (!keywords.some((k) => text.includes(k))) continue
    const level = trait.skillId > 0 ? lvl(skillLevels, trait.skillId) : 5
    if (trait.unit === 105) mult *= 1 + (trait.bonus / 100) * level
    else if (trait.bonus) mult *= 1 + trait.bonus / 100
  }
  return mult
}

function applyResistBonuses(
  base: FitResists,
  modules: ResolvedFitItem[],
  skillLevels: Map<number, number>,
): FitResists {
  const bonuses = { em: 0, thermal: 0, kinetic: 0, explosive: 0 }
  for (const item of modules) {
    const rb = item.type.combat?.resistBonus
    if (!rb) continue
    if (rb.em) bonuses.em += rb.em
    if (rb.thermal) bonuses.thermal += rb.thermal
    if (rb.kinetic) bonuses.kinetic += rb.kinetic
    if (rb.explosive) bonuses.explosive += rb.explosive
  }
  const comp = 1 + 0.05 * lvl(skillLevels, 3387) // EM Comp - use id 3387? Actually EM Armor Comp = 3387
  return {
    em: Math.min(0.99, base.em - (1 - base.em) * (bonuses.em / 100) * comp),
    thermal: Math.min(0.99, base.thermal - (1 - base.thermal) * (bonuses.thermal / 100) * comp),
    kinetic: Math.min(0.99, base.kinetic - (1 - base.kinetic) * (bonuses.kinetic / 100) * comp),
    explosive: Math.min(0.99, base.explosive - (1 - base.explosive) * (bonuses.explosive / 100) * comp),
  }
}

function fleetLinkMult(links: FleetLinkId[], kind: 'speed' | 'armorRes' | 'shieldRes'): number {
  if (kind === 'speed' && links.includes('skirmish')) return 1.1
  if (kind === 'armorRes' && links.includes('armored')) return 1.1
  if (kind === 'shieldRes' && links.includes('information')) return 1.05
  return 1
}

function computeTank(
  ship: FittingType,
  items: ResolvedFitItem[],
  skillLevels: Map<number, number>,
  fleetLinks: FleetLinkId[],
): FitShipStats['tank'] {
  const c = ship.combat
  const online = onlineModules(items)
  let shieldHp = (c?.shieldHp ?? 0) * skillPct(lvl(skillLevels, SHIELD_MANAGEMENT), 0.05)
  let armorHp = (c?.armorHp ?? 0) * skillPct(lvl(skillLevels, HULL_UPGRADES), 0.05)
  const hullHp = (c?.hullHp ?? 0) * skillPct(lvl(skillLevels, MECHANICS), 0.05)

  for (const item of online) {
    if (item.type.combat?.shieldBonus) {
      shieldHp *= stackingProduct(item.type.combat.shieldBonus / 100, item.quantity)
    }
    if (item.type.combat?.armorBonus) {
      armorHp *= stackingProduct(item.type.combat.armorBonus / 100, item.quantity)
    }
  }

  shieldHp *= parseTraitMultiplier(ship.traits, skillLevels, ['shield'])
  armorHp *= parseTraitMultiplier(ship.traits, skillLevels, ['armor'])

  const shieldRes = applyResistBonuses(c?.shieldRes ?? { em: 1, thermal: 1, kinetic: 1, explosive: 1 }, online, skillLevels)
  const armorRes = applyResistBonuses(c?.armorRes ?? { em: 1, thermal: 1, kinetic: 1, explosive: 1 }, online, skillLevels)

  if (fleetLinkMult(fleetLinks, 'shieldRes') > 1) {
    for (const k of ['em', 'thermal', 'kinetic', 'explosive'] as const) {
      shieldRes[k] = Math.min(0.99, shieldRes[k] - (1 - shieldRes[k]) * 0.05)
    }
  }

  const shield: FitTankLayer = { hp: Math.round(shieldHp), resists: shieldRes, ehp: Math.round(omniEhp(shieldHp, shieldRes)) }
  const armor: FitTankLayer = { hp: Math.round(armorHp), resists: armorRes, ehp: Math.round(omniEhp(armorHp, armorRes)) }
  const hull = { hp: Math.round(hullHp), ehp: Math.round(hullHp) }
  return { shield, armor, hull, totalEhp: shield.ehp + armor.ehp + hull.ehp }
}

function hitChance(rangeKm: number, optimalM: number, falloffM: number): number {
  const rangeM = rangeKm * 1000
  if (rangeM <= optimalM) return 1
  if (falloffM <= 0) return 0.1
  return Math.max(0.1, 1 - (rangeM - optimalM) / falloffM)
}

function computeWeapons(
  ship: FittingType,
  items: ResolvedFitItem[],
  skillLevels: Map<number, number>,
  rangeKm: number,
): FitShipStats['weapons'] | undefined {
  const turrets = onlineModules(items).filter((item) => item.type.weapon === 'turret')
  if (!turrets.length) return undefined

  let cycleMs = 5000
  let optimalM = 0
  let falloffM = 0
  let tracking = 0
  let ammoName: string | undefined
  let dmgPerVolley = 0

  for (const item of turrets) {
    const mc = item.type.combat
    cycleMs = mc?.cycleTime ?? cycleMs
    optimalM = mc?.optimal ?? optimalM
    falloffM = mc?.falloff ?? falloffM
    tracking = mc?.tracking ?? tracking
    const cd = chargeDamage(item.charge)
    const mult = item.charge?.combat?.chargeDamageMult ?? 1
    dmgPerVolley += cd * mult * item.quantity
    if (item.charge) ammoName = item.charge.name
    if (item.charge?.combat?.optimalMod) optimalM *= item.charge.combat.optimalMod
    if (item.charge?.combat?.falloffMod) falloffM *= item.charge.combat.falloffMod
    if (item.charge?.combat?.trackingMod) tracking *= item.charge.combat.trackingMod
  }

  if (!dmgPerVolley) return undefined

  const heatSinks = onlineModules(items).filter((item) => item.type.group.includes('Heat Sink'))
  let damageMult = 1
  for (const hs of heatSinks) {
    const bonus = (hs.type.combat?.laserDamageBonus ?? hs.type.combat?.damageBonus ?? 0) / 100
    if (bonus) damageMult *= stackingProduct(bonus, hs.quantity)
  }

  const turretSkill = turrets[0]?.type.skills?.[0]?.skillId
  if (turretSkill) damageMult *= skillPct(lvl(skillLevels, turretSkill), 0.05)
  damageMult *= skillPct(lvl(skillLevels, RAPID_FIRING), 0.04)
  damageMult *= parseTraitMultiplier(ship.traits, skillLevels, ['damage', 'turret'])

  tracking *= skillPct(lvl(skillLevels, MOTION_PREDICTION), 0.05)
  tracking *= skillPct(lvl(skillLevels, SHARPSHOOTER), 0.05)

  const rawDps = (dmgPerVolley * BASE_WEAPON_SCALE * damageMult) / (cycleMs / 1000)
  const appliedDps = rawDps * hitChance(rangeKm, optimalM, falloffM)

  return {
    rawDps: Math.round(rawDps),
    appliedDps: Math.round(appliedDps),
    optimalKm: Math.round((optimalM / 1000) * 10) / 10,
    falloffKm: Math.round((falloffM / 1000) * 10) / 10,
    tracking: Math.round(tracking * 100) / 100,
    ammoName,
  }
}

function computeCap(
  ship: FittingType,
  items: ResolvedFitItem[],
  skillLevels: Map<number, number>,
): FitShipStats['capacitor'] {
  let capacity = (ship.combat?.capCapacity ?? 0) * skillPct(lvl(skillLevels, ENERGY_MANAGEMENT), 0.05)
  let rechargeMs = ship.combat?.capRecharge ?? 1
  rechargeMs /= skillPct(lvl(skillLevels, ENERGY_SYSTEMS_OPERATION), 0.05)

  for (const item of onlineModules(items)) {
    if (item.type.group.includes('Cap Battery') && item.type.combat?.capCapacity) {
      capacity += item.type.combat.capCapacity * item.quantity
    }
  }

  const peakRecharge = (2.5 * capacity) / (rechargeMs / 1000)
  let usage = 0
  for (const item of onlineModules(items)) {
    const need = item.type.combat?.capacitorNeed
    const cycle = item.type.combat?.cycleTime
    if (need && cycle) usage += (need / (cycle / 1000)) * item.quantity
  }

  const stablePercent = usage < peakRecharge ? Math.round((usage / peakRecharge) * 100) : null
  const lastsSeconds = usage >= peakRecharge ? Math.round(capacity / usage) : null

  return {
    capacity: Math.round(capacity * 10) / 10,
    peakRecharge: Math.round(peakRecharge * 100) / 100,
    usage: Math.round(usage * 100) / 100,
    stablePercent,
    lastsSeconds,
  }
}

function computeNavigation(
  ship: FittingType,
  items: ResolvedFitItem[],
  skillLevels: Map<number, number>,
  fleetLinks: FleetLinkId[],
): FitShipStats['navigation'] {
  let velocity = (ship.combat?.velocity ?? 0) * skillPct(lvl(skillLevels, NAVIGATION), 0.05)
  let signature = ship.combat?.signature ?? 40
  const agility = ship.combat?.agility ?? 1
  const mass = ship.combat?.mass ?? 1

  for (const item of onlineModules(items)) {
    const g = item.type.group
    if (g.includes('Afterburner') || g.includes('Microwarpdrive')) {
      const factor = item.type.combat?.speedFactor ?? 0
      const isMwd = g.includes('Microwarpdrive')
      const acBonus = isMwd ? 0.1 * lvl(skillLevels, HIGH_SPEED_MANEUVERING) : 0.05 * lvl(skillLevels, ACCELERATION_CONTROL)
      velocity *= 1 + factor * (1 + acBonus)
      if (isMwd && item.type.combat?.speedFactor) signature *= 4.5
    }
  }

  velocity *= fleetLinkMult(fleetLinks, 'speed')
  velocity *= parseTraitMultiplier(ship.traits, skillLevels, ['velocity', 'speed'])

  const alignSeconds =
    agility > 0 ? Math.round(((Math.log(2) * agility * mass) / (1 + 0.05 * lvl(skillLevels, EVASIVE_MANEUVERING))) * 10) / 10 : 0

  return {
    maxVelocity: Math.round(velocity),
    alignSeconds,
    signature: Math.round(signature),
    lockRange: ship.combat?.lockRange,
    maxTargets: ship.combat?.maxTargets,
    warpSpeed: ship.combat?.warpSpeed,
  }
}

function computeDrones(
  ship: FittingType,
  items: ResolvedFitItem[],
  skillLevels: Map<number, number>,
): FitShipStats['drones'] | undefined {
  const droneItems = items.filter((item) => item.type.category === 'Drone' && !item.offline)
  if (!droneItems.length) return undefined

  const bandwidth = ship.combat?.droneBandwidth ?? 0
  const bay = ship.combat?.droneBay ?? 0
  let usedBw = 0
  let dps = 0

  for (const item of droneItems) {
    const bw = item.type.combat?.droneBandwidth ?? 5
    const count = Math.min(item.quantity, Math.floor((bandwidth - usedBw) / bw), Math.floor(bay / (item.type.combat?.droneVolume ?? 5)))
    if (count <= 0) continue
    usedBw += bw * count
    const dmg = chargeDamage(item.type) || (item.type.combat?.damageMultiplier ?? 0)
    const cycle = item.type.combat?.cycleTime ?? 2000
    dps += (dmg * BASE_WEAPON_SCALE * count) / (cycle / 1000)
  }

  dps *= skillPct(lvl(skillLevels, DRONE_INTERFACING), 0.05)

  return { dps: Math.round(dps), bandwidth, bay }
}

function unmappedTraits(traits: ShipTrait[] | undefined): string[] {
  if (!traits?.length) return []
  return traits
    .filter((t) => t.skillId === -1 || !/damage|turret|armor|shield|velocity|capacitor|tracking|optimal|mining|rof/i.test(t.text))
    .map((t) => t.text.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
}

function computeCalibration(ship: FittingType, items: ResolvedFitItem[]) {
  const output = ship.combat?.calibration ?? 400
  let used = 0
  for (const item of onlineModules(items)) {
    used += (item.type.combat?.calibrationCost ?? 0) * item.quantity
  }
  return { used, output, ok: used <= output }
}

export function computeFitStats(
  ship: FittingType,
  items: ResolvedFitItem[],
  ctx: FitStatsContext,
): FitShipStats {
  const fittingLevels = ctx.fittingLevels ?? levelsFromSkillMap(ctx.skillLevels)
  const load = computeFitLoad(ship, items, fittingLevels)
  const cal = computeCalibration(ship, items)
  load.calibrationUsed = cal.used
  load.calibrationOutput = cal.output
  load.calibrationOk = cal.ok

  return {
    load,
    tank: computeTank(ship, items, ctx.skillLevels, ctx.fleetLinks),
    weapons: computeWeapons(ship, items, ctx.skillLevels, ctx.rangeKm),
    drones: computeDrones(ship, items, ctx.skillLevels),
    capacitor: computeCap(ship, items, ctx.skillLevels),
    navigation: computeNavigation(ship, items, ctx.skillLevels, ctx.fleetLinks),
    unmappedTraits: unmappedTraits(ship.traits),
  }
}
