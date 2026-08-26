import type {
  BlueprintTier,
  FittedManufacturingRig,
  ManufacturingFamilyRigTiers,
  ManufacturingRigModifiers,
  ManufacturingRigTier,
} from '@/types'
import { DEFAULT_MANUFACTURING_RIGS } from '@/types'
import {
  manufacturingFamiliesFromRigName,
  manufacturingRigFamilyForProduct,
} from '@/lib/manufacturingRigFamilies'

/** T1/T2 M-Set/L-Set/XL-Set base bonuses before security scaling. */
export const RIG_ME_BASE: Record<'t1' | 't2', number> = { t1: 2, t2: 2.4 }
export const RIG_TE_BASE: Record<'t1' | 't2', number> = { t1: 20, t2: 24 }

/**
 * In-game security is true SDE security rounded to one decimal.
 * Highsec is 0.5+, lowsec is 0.1-0.4, null/WH is 0.0 and below.
 * True 0.45 therefore displays as 0.5 (highsec).
 */
export function displayedSystemSecurity(security: number): number {
  return Math.round(security * 10) / 10
}

/** Security multiplier for fitted engineering rigs (ESI 2355/2356/2357). */
export function rigSecurityMultiplier(security: number): number {
  const shown = displayedSystemSecurity(security)
  if (shown >= 0.5) return 1
  if (shown > 0) return 1.9
  return 2.1
}

export function rigSecurityLabel(security: number): string {
  const shown = displayedSystemSecurity(security)
  if (shown >= 0.5) return 'highsec'
  if (shown > 0) return 'lowsec'
  return 'nullsec'
}

function scaledRigPercent(basePercent: number, security: number): number {
  return basePercent * rigSecurityMultiplier(security)
}

function tierFromBase(base: number, kind: 'me' | 'te'): ManufacturingRigTier {
  if (base <= 0) return 'none'
  const t1 = kind === 'me' ? RIG_ME_BASE.t1 : RIG_TE_BASE.t1
  const t2 = kind === 'me' ? RIG_ME_BASE.t2 : RIG_TE_BASE.t2
  if (Math.abs(base - t2) < 0.2) return 't2'
  if (Math.abs(base - t1) < 0.2) return 't1'
  return 'custom'
}

export function familyRigsFromFitted(
  fitted: FittedManufacturingRig[],
): NonNullable<ManufacturingRigModifiers['familyRigs']> {
  const familyRigs: NonNullable<ManufacturingRigModifiers['familyRigs']> = {}
  for (const rig of fitted) {
    for (const family of manufacturingFamiliesFromRigName(rig.name)) {
      const current = familyRigs[family] ?? { meRig: 'none', teRig: 'none' }
      const meRig = tierFromBase(rig.meBase, 'me')
      const teRig = tierFromBase(rig.teBase, 'te')
      familyRigs[family] = {
        meRig: meRig !== 'none' ? meRig : current.meRig,
        teRig: teRig !== 'none' ? teRig : current.teRig,
      }
    }
  }
  return familyRigs
}

function resolveFamilyTier(
  row: ManufacturingFamilyRigTiers,
  kind: 'me' | 'te',
  security: number,
  global: ManufacturingRigModifiers,
): number {
  const tier = kind === 'me' ? row.meRig : row.teRig
  if (tier === 'none') return 0
  if (tier === 'custom') {
    return kind === 'me'
      ? Math.max(0, global.rigMeBonusPercent)
      : Math.max(0, global.rigTeBonusPercent)
  }
  return scaledRigPercent(kind === 'me' ? RIG_ME_BASE[tier] : RIG_TE_BASE[tier], security)
}

export function resolveRigBonuses(
  rigs: ManufacturingRigModifiers,
  security: number,
  product?: { productGroup: string; tier?: BlueprintTier; category?: string },
): { me: number; te: number; jobCost: number } {
  const family = product ? manufacturingRigFamilyForProduct(product) : null
  const familyRow = family ? rigs.familyRigs?.[family] : undefined
  if (familyRow) {
    return {
      me: resolveFamilyTier(familyRow, 'me', security, rigs),
      te: resolveFamilyTier(familyRow, 'te', security, rigs),
      jobCost: Math.max(0, rigs.rigJobCostBonusPercent),
    }
  }

  return {
    me: 0,
    te: 0,
    jobCost: Math.max(0, rigs.rigJobCostBonusPercent),
  }
}

/** Resolve stored ME rig tier (or custom paste) to an effective percent bonus. */
export function resolveRigMePercent(
  rigs: ManufacturingRigModifiers,
  security: number,
): number {
  const tier = rigs.meRig ?? (rigs.rigMeBonusPercent > 0 ? 'custom' : 'none')
  if (tier === 'none') return 0
  if (tier === 'custom') return Math.max(0, rigs.rigMeBonusPercent)
  return scaledRigPercent(RIG_ME_BASE[tier], security)
}

/** Resolve stored TE rig tier (or custom paste) to an effective percent bonus. */
export function resolveRigTePercent(
  rigs: ManufacturingRigModifiers,
  security: number,
): number {
  const tier = rigs.teRig ?? (rigs.rigTeBonusPercent > 0 ? 'custom' : 'none')
  if (tier === 'none') return 0
  if (tier === 'custom') return Math.max(0, rigs.rigTeBonusPercent)
  return scaledRigPercent(RIG_TE_BASE[tier], security)
}

/** Migrate legacy saves that only stored percent fields. */
export function normalizeManufacturingRigs(
  rigs: Partial<ManufacturingRigModifiers> | undefined,
): ManufacturingRigModifiers {
  const base = { ...DEFAULT_MANUFACTURING_RIGS, ...rigs }
  const fitted = Array.isArray(rigs?.fitted)
    ? rigs.fitted.filter((row) => row && typeof row.name === 'string')
    : undefined
  const familyRigs =
    rigs?.familyRigs ??
    (fitted && fitted.length > 0 ? familyRigsFromFitted(fitted) : undefined)
  return {
    ...base,
    meRig: rigs?.meRig ?? (base.rigMeBonusPercent > 0 ? 'custom' : 'none'),
    teRig: rigs?.teRig ?? (base.rigTeBonusPercent > 0 ? 'custom' : 'none'),
    fitted: fitted && fitted.length > 0 ? fitted : undefined,
    familyRigs,
  }
}

export function manufacturingRigTierLabel(tier: ManufacturingRigTier): string {
  switch (tier) {
    case 'none':
      return 'None'
    case 't1':
      return 'T1 rig'
    case 't2':
      return 'T2 rig'
    case 'custom':
      return 'Custom (tooltip)'
  }
}
