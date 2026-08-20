/** Build compact fitting dogma for the fit-skills tool. */

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function attrNum(attrs, id) {
  const row = attrs?.get(String(id))
  if (!row) return 0
  return num(row.valueFloat || row.valueInt)
}

function requiredSkills(attrs) {
  const skills = []
  for (const [skillAttr, levelAttr] of [
    ['182', '277'],
    ['183', '278'],
    ['184', '279'],
  ]) {
    const skillId = attrNum(attrs, skillAttr)
    const level = attrNum(attrs, levelAttr)
    if (skillId > 0 && level > 0) skills.push({ skillId, level })
  }
  return skills
}

const ELECTRONICS_UPGRADES_ID = 3432

const TURRET_GROUPS = new Set(['Energy Weapon', 'Projectile Weapon', 'Hybrid Weapon', 'Precursor Weapon'])
const LAUNCHER_GROUPS = new Set([
  'Missile Launcher Rocket',
  'Missile Launcher Light',
  'Missile Launcher Rapid Light',
  'Missile Launcher Heavy Assault',
  'Missile Launcher Heavy',
  'Missile Launcher Rapid Heavy',
  'Missile Launcher Cruise',
  'Missile Launcher Torpedo',
  'Missile Launcher XL Cruise',
  'Missile Launcher XL Torpedo',
  'Missile Launcher Rapid Torpedo',
  'Missile Launcher Bomb',
  'Missile Launcher Defender',
])

const ATTR = {
  hullHp: 9,
  powerOutput: 11,
  capacitorNeed: 6,
  power: 30,
  maxVelocity: 37,
  cpuOutput: 48,
  cpu: 50,
  cycleTime: 51,
  optimalRange: 54,
  capRecharge: 55,
  agility: 70,
  signature: 552,
  emDamage: 116,
  explosiveDamage: 117,
  kineticDamage: 118,
  thermalDamage: 118,
  thermalDamageAlt: 119,
  damageMultiplier: 124,
  maxTargets: 125,
  chargeSize: 128,
  falloff: 158,
  trackingSpeed: 160,
  mass: 192,
  shieldHp: 263,
  armorHp: 265,
  shieldEmRes: 267,
  shieldExplRes: 268,
  shieldKinRes: 269,
  shieldThermRes: 270,
  armorEmRes: 271,
  armorExplRes: 272,
  armorKinRes: 273,
  armorThermRes: 274,
  droneBay: 283,
  capCapacity: 482,
  lockRange: 76,
  warpSpeed: 552,
  scanRes: 564,
  chargeGroup1: 604,
  chargeGroup2: 605,
  chargeGroup3: 606,
  chargeGroup4: 607,
  chargeGroup5: 608,
  calibration: 1132,
  calibrationCost: 1154,
  droneBandwidth: 1271,
  shieldBonus: 417,
  armorHpBonus: 448,
  speedFactor: 653,
  sigRadiusBonus: 554,
  rofBonus: 653,
  damageBonus: 292,
  laserDamageBonus: 1955,
  rofBonus: 653,
  miningAmount: 77,
  optimalMod: 120,
  falloffMod: 779,
  trackingMod: 244,
  chargeDamageMult: 633,
  emResBonus: 805,
  thermResBonus: 806,
  kinResBonus: 807,
  explResBonus: 808,
  repairAmount: 108,
  optimalBonus: 158,
}

function weaponKind(groupName) {
  if (TURRET_GROUPS.has(groupName)) return 'turret'
  if (LAUNCHER_GROUPS.has(groupName) || groupName.startsWith('Missile Launcher')) return 'launcher'
  if (groupName === 'Smart Bomb') return 'smartbomb'
  return undefined
}

function weaponFamily(groupName) {
  if (groupName === 'Energy Weapon' || groupName === 'Rig Energy Weapon') return 'energy'
  if (groupName === 'Projectile Weapon' || groupName === 'Rig Projectile Weapon') return 'projectile'
  if (groupName === 'Hybrid Weapon' || groupName === 'Rig Hybrid Weapon') return 'hybrid'
  if (groupName.startsWith('Missile Launcher') || groupName === 'Rig Launcher') return 'launcher'
  if (groupName === 'Armor Repairer') return 'armorRepair'
  return undefined
}

function rigDrawback(groupName, attrs) {
  const pct = attrNum(attrs, 1138)
  if (pct === 0) return undefined

  const family = weaponFamily(groupName)
  if (family === 'energy' || family === 'projectile' || family === 'hybrid' || family === 'launcher') {
    if (attrNum(attrs, 64) > 1) return { family, stat: 'cpu', pct }
    if (attrNum(attrs, 204) !== 0 || attrNum(attrs, 310) !== 0) return { family, stat: 'power', pct }
    return undefined
  }

  if (groupName === 'Rig Armor') {
    if (attrNum(attrs, 806) !== 0 || attrNum(attrs, 312) !== 0) {
      return { family: 'armorRepair', stat: 'power', pct }
    }
  }

  return undefined
}

function chargeGroups(attrs) {
  const groups = []
  for (const id of [604, 605, 606, 607, 608]) {
    const g = attrNum(attrs, id)
    if (g > 0) groups.push(g)
  }
  return groups
}

function hasChargeCombat(attrs) {
  return (
    attrNum(attrs, 116) > 0 ||
    attrNum(attrs, 117) > 0 ||
    attrNum(attrs, 118) > 0 ||
    attrNum(attrs, 119) > 0 ||
    attrNum(attrs, 77) > 0 ||
    chargeGroups(attrs).length > 0
  )
}

function extractCombat(attrs, category, groupName) {
  if (!attrs) return undefined
  const combat = {}

  if (category === 'Ship') {
    if (attrNum(attrs, ATTR.shieldHp)) combat.shieldHp = attrNum(attrs, ATTR.shieldHp)
    if (attrNum(attrs, ATTR.armorHp)) combat.armorHp = attrNum(attrs, ATTR.armorHp)
    if (attrNum(attrs, ATTR.hullHp)) combat.hullHp = attrNum(attrs, ATTR.hullHp)
    const shieldRes = {
      em: attrNum(attrs, ATTR.shieldEmRes) || 1,
      thermal: attrNum(attrs, ATTR.shieldThermRes) || 1,
      kinetic: attrNum(attrs, ATTR.shieldKinRes) || 1,
      explosive: attrNum(attrs, ATTR.shieldExplRes) || 1,
    }
    const armorRes = {
      em: attrNum(attrs, ATTR.armorEmRes) || 1,
      thermal: attrNum(attrs, ATTR.armorThermRes) || 1,
      kinetic: attrNum(attrs, ATTR.armorKinRes) || 1,
      explosive: attrNum(attrs, ATTR.armorExplRes) || 1,
    }
    combat.shieldRes = shieldRes
    combat.armorRes = armorRes
    if (attrNum(attrs, ATTR.maxVelocity)) combat.velocity = attrNum(attrs, ATTR.maxVelocity)
    if (attrNum(attrs, ATTR.mass)) combat.mass = attrNum(attrs, ATTR.mass)
    if (attrNum(attrs, ATTR.agility)) combat.agility = attrNum(attrs, ATTR.agility)
    if (attrNum(attrs, ATTR.signature)) combat.signature = attrNum(attrs, ATTR.signature)
    if (attrNum(attrs, ATTR.capCapacity)) combat.capCapacity = attrNum(attrs, ATTR.capCapacity)
    if (attrNum(attrs, ATTR.capRecharge)) combat.capRecharge = attrNum(attrs, ATTR.capRecharge)
    if (attrNum(attrs, ATTR.calibration)) combat.calibration = attrNum(attrs, ATTR.calibration)
    if (attrNum(attrs, ATTR.droneBandwidth)) combat.droneBandwidth = attrNum(attrs, ATTR.droneBandwidth)
    if (attrNum(attrs, ATTR.droneBay)) combat.droneBay = attrNum(attrs, ATTR.droneBay)
    if (attrNum(attrs, ATTR.scanRes)) combat.scanRes = attrNum(attrs, ATTR.scanRes)
    if (attrNum(attrs, ATTR.maxTargets)) combat.maxTargets = attrNum(attrs, ATTR.maxTargets)
    if (attrNum(attrs, ATTR.lockRange)) combat.lockRange = attrNum(attrs, ATTR.lockRange)
    if (attrNum(attrs, ATTR.warpSpeed)) combat.warpSpeed = attrNum(attrs, ATTR.warpSpeed)
  }

  if (category === 'Module') {
    if (attrNum(attrs, ATTR.damageMultiplier)) combat.damageMultiplier = attrNum(attrs, ATTR.damageMultiplier)
    if (attrNum(attrs, ATTR.cycleTime)) combat.cycleTime = attrNum(attrs, ATTR.cycleTime)
    if (attrNum(attrs, ATTR.optimalRange)) combat.optimal = attrNum(attrs, ATTR.optimalRange)
    if (attrNum(attrs, ATTR.falloff)) combat.falloff = attrNum(attrs, ATTR.falloff)
    if (attrNum(attrs, ATTR.trackingSpeed)) combat.tracking = attrNum(attrs, ATTR.trackingSpeed)
    if (attrNum(attrs, ATTR.capacitorNeed)) combat.capacitorNeed = attrNum(attrs, ATTR.capacitorNeed)
    if (attrNum(attrs, ATTR.calibrationCost)) combat.calibrationCost = attrNum(attrs, ATTR.calibrationCost)
    if (attrNum(attrs, ATTR.speedFactor)) combat.speedFactor = attrNum(attrs, ATTR.speedFactor)
    if (attrNum(attrs, ATTR.shieldBonus)) combat.shieldBonus = attrNum(attrs, ATTR.shieldBonus)
    if (attrNum(attrs, ATTR.armorHpBonus)) combat.armorBonus = attrNum(attrs, ATTR.armorHpBonus)
    if (attrNum(attrs, ATTR.damageBonus)) combat.damageBonus = attrNum(attrs, ATTR.damageBonus)
    if (attrNum(attrs, ATTR.laserDamageBonus)) combat.laserDamageBonus = attrNum(attrs, ATTR.laserDamageBonus)
    if (attrNum(attrs, ATTR.rofBonus)) combat.rofBonus = attrNum(attrs, ATTR.rofBonus)
    if (attrNum(attrs, ATTR.miningAmount)) combat.miningAmount = attrNum(attrs, ATTR.miningAmount)
    if (attrNum(attrs, ATTR.repairAmount)) combat.repairAmount = attrNum(attrs, ATTR.repairAmount)
    const groups = chargeGroups(attrs)
    if (groups.length) combat.chargeGroups = groups
    if (attrNum(attrs, ATTR.chargeSize)) combat.chargeSize = attrNum(attrs, ATTR.chargeSize)
    const resBonus = {}
    if (attrNum(attrs, ATTR.emResBonus)) resBonus.em = attrNum(attrs, ATTR.emResBonus)
    if (attrNum(attrs, ATTR.thermResBonus)) resBonus.thermal = attrNum(attrs, ATTR.thermResBonus)
    if (attrNum(attrs, ATTR.kinResBonus)) resBonus.kinetic = attrNum(attrs, ATTR.kinResBonus)
    if (attrNum(attrs, ATTR.explResBonus)) resBonus.explosive = attrNum(attrs, ATTR.explResBonus)
    if (Object.keys(resBonus).length) combat.resistBonus = resBonus
  }

  if (category === 'Charge') {
    const damage = {}
    if (attrNum(attrs, 116)) damage.em = attrNum(attrs, 116)
    if (attrNum(attrs, 119)) damage.thermal = attrNum(attrs, 119)
    if (attrNum(attrs, 118)) damage.kinetic = attrNum(attrs, 118)
    if (attrNum(attrs, 117)) damage.explosive = attrNum(attrs, 117)
    if (attrNum(attrs, 114)) damage.total = attrNum(attrs, 114)
    if (Object.keys(damage).length) combat.damage = damage
    if (attrNum(attrs, ATTR.miningAmount)) combat.miningAmount = attrNum(attrs, ATTR.miningAmount)
    const cg = chargeGroups(attrs)
    if (cg.length) combat.chargeGroup = cg[0]
    if (attrNum(attrs, ATTR.chargeSize)) combat.chargeSize = attrNum(attrs, ATTR.chargeSize)
    if (attrNum(attrs, ATTR.optimalRange)) combat.optimalBonus = attrNum(attrs, ATTR.optimalRange)
    if (attrNum(attrs, ATTR.falloff)) combat.falloffBonus = attrNum(attrs, ATTR.falloff)
    if (attrNum(attrs, ATTR.chargeDamageMult)) combat.chargeDamageMult = attrNum(attrs, ATTR.chargeDamageMult)
    if (attrNum(attrs, ATTR.optimalMod)) combat.optimalMod = attrNum(attrs, ATTR.optimalMod)
    if (attrNum(attrs, ATTR.falloffMod)) combat.falloffMod = attrNum(attrs, ATTR.falloffMod)
    if (attrNum(attrs, ATTR.trackingMod)) combat.trackingMod = attrNum(attrs, ATTR.trackingMod)
  }

  if (category === 'Drone') {
    if (attrNum(attrs, ATTR.damageMultiplier)) combat.damageMultiplier = attrNum(attrs, ATTR.damageMultiplier)
    if (attrNum(attrs, ATTR.cycleTime)) combat.cycleTime = attrNum(attrs, ATTR.cycleTime)
    if (attrNum(attrs, ATTR.droneBandwidth)) combat.droneBandwidth = attrNum(attrs, ATTR.droneBandwidth)
    const damage = {}
    if (attrNum(attrs, 116)) damage.em = attrNum(attrs, 116)
    if (attrNum(attrs, 119)) damage.thermal = attrNum(attrs, 119)
    if (attrNum(attrs, 118)) damage.kinetic = attrNum(attrs, 118)
    if (attrNum(attrs, 117)) damage.explosive = attrNum(attrs, 117)
    if (Object.keys(damage).length) combat.damage = damage
  }

  if (category === 'Implant') {
    const bonuses = {}
    if (attrNum(attrs, ATTR.damageBonus)) bonuses.damage = attrNum(attrs, ATTR.damageBonus)
    if (attrNum(attrs, ATTR.shieldBonus)) bonuses.shield = attrNum(attrs, ATTR.shieldBonus)
    if (attrNum(attrs, ATTR.armorHpBonus)) bonuses.armor = attrNum(attrs, ATTR.armorHpBonus)
    if (attrNum(attrs, ATTR.speedFactor)) bonuses.velocity = attrNum(attrs, ATTR.speedFactor)
    if (attrNum(attrs, ATTR.capCapacity)) bonuses.cap = attrNum(attrs, ATTR.capCapacity)
    if (Object.keys(bonuses).length) combat.implantBonuses = bonuses
  }

  return Object.keys(combat).length ? combat : undefined
}

function buildTraitsByShip(invTraits) {
  const byShip = new Map()
  if (!invTraits) return byShip
  for (const row of invTraits) {
    const typeId = num(row.typeID)
    if (!byShip.has(typeId)) byShip.set(typeId, [])
    byShip.get(typeId).push({
      skillId: num(row.skillID),
      bonus: num(row.bonus),
      unit: num(row.unitID),
      text: row.bonusText ?? '',
    })
  }
  return byShip
}

export function buildFittingRecords(types, groups, categories, typeAttributes, invTraits) {
  const groupById = new Map(groups.map((group) => [group.groupID, group]))
  const categoryById = new Map(
    categories.map((category) => [category.categoryID, category.categoryName]),
  )
  const attrsByType = new Map()
  for (const row of typeAttributes) {
    if (!attrsByType.has(row.typeID)) attrsByType.set(row.typeID, new Map())
    attrsByType.get(row.typeID).set(row.attributeID, row)
  }
  const traitsByShip = buildTraitsByShip(invTraits)

  const moduleChargeGroups = new Set()
  for (const type of types) {
    if (type.published !== '1') continue
    const group = groupById.get(type.groupID)
    const category = categoryById.get(group?.categoryID ?? '') ?? 'Unknown'
    if (category !== 'Module') continue
    const attrs = attrsByType.get(type.typeID)
    for (const g of chargeGroups(attrs)) moduleChargeGroups.add(g)
  }

  const records = []
  for (const type of types) {
    if (type.published !== '1') continue
    const group = groupById.get(type.groupID)
    const category = categoryById.get(group?.categoryID ?? '') ?? 'Unknown'
    const groupName = group?.groupName ?? 'Unknown'
    const attrs = attrsByType.get(type.typeID)
    const cpu = attrNum(attrs, 50)
    const power = attrNum(attrs, 30)
    const cpuOutput = attrNum(attrs, 48)
    const powerOutput = attrNum(attrs, 11)
    const skills = requiredSkills(attrs)
    const drawback = rigDrawback(groupName, attrs)
    const kind = weaponKind(groupName)
    const family = weaponFamily(groupName)
    const combat = extractCombat(attrs, category, groupName)

    const isShip = category === 'Ship'
    const isModule = category === 'Module'
    const isDrone = category === 'Drone'
    const isImplant = category === 'Implant'
    const chargeGroupIds = chargeGroups(attrs)
    const isCharge =
      category === 'Charge' &&
      (skills.length > 0 ||
        hasChargeCombat(attrs) ||
        chargeGroupIds.some((g) => moduleChargeGroups.has(g)))

    if (!isShip && !isModule && !isCharge && !isDrone && !isImplant) continue

    const record = {
      typeId: num(type.typeID),
      name: type.typeName,
      group: groupName,
      category: isImplant ? 'Implant' : category,
      groupId: num(group?.groupID),
    }
    if (isShip) {
      record.cpuOutput = cpuOutput
      record.powerOutput = powerOutput
      const traits = traitsByShip.get(record.typeId)
      if (traits?.length) record.traits = traits
    } else {
      if (cpu) record.cpu = cpu
      if (power) record.power = power
    }
    if (skills.length) record.skills = skills
    if (kind) record.weapon = kind
    if (family) record.family = family
    if (drawback) record.rigDrawback = drawback
    if (skills.some((skill) => skill.skillId === ELECTRONICS_UPGRADES_ID)) {
      record.electronicsUpgrades = true
    }
    if (combat) record.combat = combat
    records.push(record)
  }

  return records.sort((a, b) => a.typeId - b.typeId)
}
