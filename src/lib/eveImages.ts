import type { BlueprintFilterTier, BlueprintTier, HubId, MineralStock } from '@/types'
import { MINERAL_TYPE_IDS } from '@/types'

/** EVE Image Service only accepts these sizes (see ESI image server docs). */
export const VALID_IMAGE_SIZES = [32, 64, 128, 256, 512, 1024] as const

export type ValidImageSize = (typeof VALID_IMAGE_SIZES)[number]

/** Snap requested px to the smallest valid CDN size that fits. */
export function normalizeImageSize(requested: number): ValidImageSize {
  for (const size of VALID_IMAGE_SIZES) {
    if (requested <= size) return size
  }
  return 1024
}

export function typeIconUrl(typeId: number, size = 32): string {
  return `https://images.evetech.net/types/${typeId}/icon?size=${normalizeImageSize(size)}`
}

export function typeRenderUrl(typeId: number, size = 128): string {
  return `https://images.evetech.net/types/${typeId}/render?size=${normalizeImageSize(size)}`
}

export function blueprintIconUrl(typeId: number, size = 32): string {
  return `https://images.evetech.net/types/${typeId}/bp?size=${normalizeImageSize(size)}`
}

/** NPC faction logos use the corporations category. */
export function corporationLogoUrl(corporationId: number, size = 64): string {
  return `https://images.evetech.net/corporations/${corporationId}/logo?size=${normalizeImageSize(size)}`
}

export type ImageVariant = 'icon' | 'render' | 'bp' | 'faction'

/** Build a fallback chain from most to least preferred. */
export function imageUrlChain(
  typeId: number,
  variant: ImageVariant,
  size: number,
  productTypeId?: number,
): string[] {
  const urls: string[] = []
  const add = (url: string) => {
    if (!urls.includes(url)) urls.push(url)
  }

  switch (variant) {
    case 'render':
      add(typeRenderUrl(typeId, size))
      add(typeIconUrl(typeId, size))
      if (productTypeId && productTypeId !== typeId) {
        add(typeRenderUrl(productTypeId, size))
        add(typeIconUrl(productTypeId, size))
      }
      break
    case 'bp':
      add(blueprintIconUrl(typeId, size))
      if (productTypeId) add(typeIconUrl(productTypeId, size))
      add(typeIconUrl(typeId, size))
      break
    case 'faction':
      add(corporationLogoUrl(typeId, size))
      break
    default:
      add(typeIconUrl(typeId, size))
      if (productTypeId && productTypeId !== typeId) add(typeIconUrl(productTypeId, size))
  }

  return urls
}

/** Representative product type icons for blueprint tier filters. */
export const TIER_TYPE_IDS: Record<BlueprintTier, number> = {
  t1: 215,
  t2: 2048,
  faction: 17888,
}

export const TIER_FILTER_LABELS: Record<BlueprintFilterTier, string> = {
  t1: 'T1',
  t2: 'T2',
  faction: 'Faction',
  all: 'All tiers',
}

/** Skill path cards on the Progression page. */
export const PATH_TYPE_IDS: Record<string, number> = {
  't1-ammo': 215,
  't2-invention': 2048,
  'trade-tax': 16622,
  'mining-reprocess': 1230,
}

/** Dashboard / nav shortcut tiles. */
export const NAV_TYPE_IDS = {
  blueprints: 3841,
  accounts: 3380,
  progression: 24625,
  dashboard: 215,
} as const

export const MINERAL_KEYS = Object.keys(MINERAL_TYPE_IDS) as (keyof MineralStock)[]

export function mineralIconUrl(key: keyof MineralStock, size = 32): string {
  return typeIconUrl(MINERAL_TYPE_IDS[key], size)
}

/** Primary empire faction corp IDs for trade hub branding. */
export const HUB_FACTION_IDS: Record<HubId, number> = {
  jita: 500001,
  amarr: 500002,
  dodixie: 500004,
  rens: 500003,
  hek: 500003,
}

export function hubFactionLogoUrl(hubId: HubId, size = 64): string {
  return corporationLogoUrl(HUB_FACTION_IDS[hubId], size)
}
