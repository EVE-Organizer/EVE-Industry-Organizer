import type { ImageVariant } from '@/lib/eveImages'

/** Category liquidity presets for Top Blueprints min vol/day (Jita 1w research). */
export type BlueprintVolumePresetId =
  | 'ammo'
  | 'module'
  | 'charge'
  | 'ship'
  | 'drone'
  | 'fighter'
  | 'formula'
  | 'commodity'
  | 'implant'
  | 'subsystem'
  | 'deployable'
  | 'structure'
  | 'structure_module'
  | 'starbase'
  | 'material'

export interface BlueprintVolumePreset {
  id: BlueprintVolumePresetId
  label: string
  iconTypeId: number
  imageVariant?: ImageVariant
  minVolume: number
  tooltip: string
  /** Extra search terms (SDE category name, synonyms). */
  keywords: string[]
}

/**
 * Suggested min vol/day floors from Jita 1w averages on rankable products.
 * Weapon ammo is split out of SDE Charge; reactions use Formula.
 */
export const BLUEPRINT_VOLUME_PRESETS: BlueprintVolumePreset[] = [
  {
    id: 'ammo',
    label: 'Ammo',
    iconTypeId: 209,
    minVolume: 10_000,
    tooltip: 'Projectiles, missiles, crystals. Median weapon ammo ~36k/day at Jita.',
    keywords: ['ammunition', 'missile', 'projectile', 'hybrid', 'charge'],
  },
  {
    id: 'module',
    label: 'Module',
    iconTypeId: 3841,
    minVolume: 100,
    tooltip: 'Ship modules. p75 ~140/day at Jita.',
    keywords: ['modules', 'equipment', 'rig'],
  },
  {
    id: 'charge',
    label: 'Charge',
    iconTypeId: 28668,
    minVolume: 50_000,
    tooltip: 'Scripts, cap boosters, nanite paste (non-weapon charges).',
    keywords: ['script', 'booster', 'paste', 'capacitor'],
  },
  {
    id: 'ship',
    label: 'Ship',
    iconTypeId: 32880,
    minVolume: 31,
    tooltip: 'Hull BPOs. Median ~31/day at Jita.',
    keywords: ['ships', 'hull', 'frigate', 'cruiser'],
  },
  {
    id: 'drone',
    label: 'Drone',
    iconTypeId: 2454,
    minVolume: 250,
    tooltip: 'Combat and mining drones. Median ~280/day at Jita.',
    keywords: ['drones'],
  },
  {
    id: 'fighter',
    label: 'Fighter',
    iconTypeId: 23061,
    minVolume: 24,
    tooltip: 'Capital fighter tubes. Median ~24/day at Jita.',
    keywords: ['fighters', 'capital'],
  },
  {
    id: 'formula',
    label: 'Formula',
    iconTypeId: 46204,
    imageVariant: 'bp',
    minVolume: 5_000,
    tooltip: 'Reaction formulas. Lower tail ~1.6k/day; 5k keeps active formulas.',
    keywords: ['reaction', 'formula', 'formulas', 'biochemical', 'composite'],
  },
  {
    id: 'commodity',
    label: 'Commodity',
    iconTypeId: 11545,
    minVolume: 500,
    tooltip: 'Planetary and advanced commodities. Wide range; 500/day drops illiquid.',
    keywords: ['commodities', 'pi', 'planetary'],
  },
  {
    id: 'implant',
    label: 'Implant',
    iconTypeId: 28680,
    minVolume: 15,
    tooltip: 'Implants and boosters. p75 ~15/day at Jita.',
    keywords: ['implants', 'booster'],
  },
  {
    id: 'subsystem',
    label: 'Subsystem',
    iconTypeId: 45595,
    minVolume: 26,
    tooltip: 'T3 subsystems. Median ~26/day at Jita.',
    keywords: ['subsystems', 't3', 'strategic cruiser'],
  },
  {
    id: 'deployable',
    label: 'Deployable',
    iconTypeId: 33474,
    minVolume: 30,
    tooltip: 'Mobile structures and deployables. Median ~30/day at Jita.',
    keywords: ['mobile', 'deployables'],
  },
  {
    id: 'structure',
    label: 'Structure',
    iconTypeId: 35835,
    minVolume: 5,
    tooltip: 'Citadels and engineering complexes. Low hub turnover.',
    keywords: ['citadel', 'azbel', 'sotiyo', 'raitaru', 'athanor'],
  },
  {
    id: 'structure_module',
    label: 'Structure module',
    iconTypeId: 35925,
    minVolume: 8,
    tooltip: 'Standup modules and structure equipment.',
    keywords: ['standup', 'structure module'],
  },
  {
    id: 'starbase',
    label: 'Starbase',
    iconTypeId: 17167,
    minVolume: 10,
    tooltip: 'POS structures and batteries.',
    keywords: ['pos', 'starbase', 'tower'],
  },
  {
    id: 'material',
    label: 'Material',
    iconTypeId: 4051,
    minVolume: 100_000,
    tooltip: 'Fuel blocks and bulk materials. Very high daily volume.',
    keywords: ['fuel block', 'materials', 'fuel'],
  },
]

const PRESET_BY_VOLUME = new Map(
  BLUEPRINT_VOLUME_PRESETS.map((preset) => [preset.minVolume, preset.id]),
)

export function volumePresetById(id: BlueprintVolumePresetId): BlueprintVolumePreset {
  return BLUEPRINT_VOLUME_PRESETS.find((preset) => preset.id === id)!
}

export function activeVolumePreset(minVolume: number): BlueprintVolumePreset | null {
  if (minVolume <= 0) return null
  const id = PRESET_BY_VOLUME.get(minVolume)
  return id ? volumePresetById(id) : null
}

export function filterVolumePresets(query: string): BlueprintVolumePreset[] {
  const q = query.trim().toLowerCase()
  if (!q) return BLUEPRINT_VOLUME_PRESETS

  function matchesText(text: string): boolean {
    const lower = text.toLowerCase()
    let from = 0
    while (from <= lower.length - q.length) {
      const idx = lower.indexOf(q, from)
      if (idx === -1) return false
      const atWordStart = idx === 0 || !/[a-z0-9]/.test(lower[idx - 1]!)
      if (atWordStart) return true
      from = idx + 1
    }
    return false
  }

  return BLUEPRINT_VOLUME_PRESETS.filter((preset) => {
    if (matchesText(preset.label)) return true
    if (matchesText(preset.tooltip)) return true
    return preset.keywords.some(
      (word) => word === q || word.startsWith(q) || word.split(/\s+/).some((part) => part.startsWith(q)),
    )
  })
}
