import type { GateIntelLookup } from '@/services/data/gateIntelLoader'

export interface GateKillAttacker {
  shipTypeId?: number
  weaponTypeId?: number
}

export interface GateKillInput {
  locationId?: number | null
  attackers?: GateKillAttacker[]
}

export interface HotGate {
  name: string
  kills: number
}

export interface SystemGateIntel {
  gateKillCount: number
  offGateKillCount: number
  smartbombs: boolean
  dictors: boolean
  hictors: boolean
  hotGates: HotGate[]
}

export type GateKillBand = 'none' | 'low' | 'high'

const EMPTY_INTEL: SystemGateIntel = {
  gateKillCount: 0,
  offGateKillCount: 0,
  smartbombs: false,
  dictors: false,
  hictors: false,
  hotGates: [],
}

export function emptySystemGateIntel(): SystemGateIntel {
  return { ...EMPTY_INTEL, hotGates: [] }
}

function gateForLocation(
  lookup: GateIntelLookup,
  locationId: number | null | undefined,
): { systemId: number; name: string } | null {
  if (locationId == null || !Number.isFinite(locationId)) return null
  return lookup.gatesByLocationId.get(locationId) ?? null
}

function killHasSmartbomb(kill: GateKillInput, lookup: GateIntelLookup): boolean {
  for (const attacker of kill.attackers ?? []) {
    if (attacker.weaponTypeId != null && lookup.smartBombTypeIds.has(attacker.weaponTypeId)) {
      return true
    }
  }
  return false
}

function killHasDictor(kill: GateKillInput, lookup: GateIntelLookup): boolean {
  for (const attacker of kill.attackers ?? []) {
    if (attacker.shipTypeId != null && lookup.interdictorTypeIds.has(attacker.shipTypeId)) {
      return true
    }
  }
  return false
}

function killHasHictor(kill: GateKillInput, lookup: GateIntelLookup): boolean {
  for (const attacker of kill.attackers ?? []) {
    if (attacker.shipTypeId != null && lookup.hicTypeIds.has(attacker.shipTypeId)) {
      return true
    }
  }
  return false
}

export function classifySystemGateIntel(
  systemId: number,
  kills: GateKillInput[],
  lookup: GateIntelLookup,
): SystemGateIntel {
  const hotGateCounts = new Map<string, number>()
  let gateKillCount = 0
  let offGateKillCount = 0
  let smartbombs = false
  let dictors = false
  let hictors = false

  for (const kill of kills) {
    const gate = gateForLocation(lookup, kill.locationId)
    const isGateKill = gate != null && gate.systemId === systemId

    if (isGateKill) {
      gateKillCount++
      hotGateCounts.set(gate.name, (hotGateCounts.get(gate.name) ?? 0) + 1)
      if (killHasSmartbomb(kill, lookup)) smartbombs = true
      if (killHasDictor(kill, lookup)) dictors = true
      if (killHasHictor(kill, lookup)) hictors = true
    } else {
      offGateKillCount++
    }
  }

  const hotGates = [...hotGateCounts.entries()]
    .map(([name, killsAtGate]) => ({ name, kills: killsAtGate }))
    .sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name))

  return { gateKillCount, offGateKillCount, smartbombs, dictors, hictors, hotGates }
}

export function gateKillBand(gateKillCount: number): GateKillBand {
  if (gateKillCount >= 3) return 'high'
  if (gateKillCount >= 1) return 'low'
  return 'none'
}

export function gateKillBandBadgeClass(band: GateKillBand): string {
  switch (band) {
    case 'high':
      return 'badge-error'
    case 'low':
      return 'badge-warning'
    default:
      return 'badge-success'
  }
}

export function formatGateIntelFlags(intel: SystemGateIntel): string[] {
  const flags: string[] = []
  if (intel.smartbombs) flags.push('Smartbombs')
  if (intel.hictors) flags.push('HIC')
  if (intel.dictors) flags.push('Dictor')
  return flags
}

export function explainGateIntel(intel: SystemGateIntel): string {
  const parts: string[] = []
  if (intel.gateKillCount === 0) {
    parts.push('No gate kills in the last hour on zKillboard.')
  } else if (intel.gateKillCount === 1) {
    parts.push('1 gate kill in the last hour.')
  } else {
    parts.push(`${intel.gateKillCount} gate kills in the last hour.`)
  }

  if (intel.hotGates.length) {
    const gateList = intel.hotGates
      .slice(0, 4)
      .map((g) => `${g.name} (${g.kills})`)
      .join(', ')
    parts.push(`Gates: ${gateList}.`)
  }

  const flags = formatGateIntelFlags(intel)
  if (flags.length) {
    parts.push(`Flags: ${flags.join(', ')}.`)
  }

  return parts.join(' ')
}

export function zkillSystemUrl(systemId: number): string {
  return `https://zkillboard.com/system/${systemId}/`
}

export function eveGatecheckUrl(fromName: string, toName: string): string {
  const from = encodeURIComponent(fromName)
  const to = encodeURIComponent(toName)
  return `https://eve-gatecheck.space/eve/#${from}:${to}`
}
