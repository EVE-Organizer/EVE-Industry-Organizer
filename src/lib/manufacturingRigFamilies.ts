import type { BlueprintTier, StructureType } from '@/types'
import { catalogRigIconTypeId } from '@/lib/upwellCatalog'

/**
 * Product families for Upwell manufacturing rigs.
 * @see https://wiki.eveuniversity.org/Fitting_upwell_structures#Structure_rigs
 */
export type ManufacturingRigFamily =
  | 'ammo'
  | 'drones'
  | 'equipment'
  | 'ships_t1_small'
  | 'ships_t1_medium'
  | 'ships_t1_large'
  | 'ships_t2_small'
  | 'ships_t2_medium'
  | 'ships_t2_large'
  | 'ships_capital'
  | 'components_t2'
  | 'components_capital'
  | 'structures'

export const MANUFACTURING_RIG_FAMILY_SECTIONS: {
  title: string
  families: ManufacturingRigFamily[]
}[] = [
  { title: 'Consumables', families: ['ammo', 'drones', 'equipment'] },
  { title: 'T1 ships', families: ['ships_t1_small', 'ships_t1_medium', 'ships_t1_large'] },
  { title: 'T2 ships', families: ['ships_t2_small', 'ships_t2_medium', 'ships_t2_large'] },
  {
    title: 'Capitals and structures',
    families: ['ships_capital', 'components_t2', 'components_capital', 'structures'],
  },
]

/** M-Set (Raitaru), L-Set (Azbel), XL-Set (Sotiyo). */
export type ManufacturingRigFitSize = 'm' | 'l' | 'xl'

export function manufacturingRigFitSize(
  structureType: StructureType,
): ManufacturingRigFitSize | null {
  switch (structureType) {
    case 'raitaru':
    case 'custom':
      return 'm'
    case 'azbel':
      return 'l'
    case 'sotiyo':
      return 'xl'
    default:
      return null
  }
}

export type HullManufacturingRigRow = {
  id: string
  label: string
  iconTypeId: number
  families: ManufacturingRigFamily[]
  /** L-Set and XL-Set Efficiency rigs apply ME and TE together. */
  combinedMeTe: boolean
}

export type HullManufacturingRigSection = {
  title: string
  rows: HullManufacturingRigRow[]
}

const XL_CONSUMABLE_FAMILIES: ManufacturingRigFamily[] = ['ammo', 'drones', 'equipment']
const XL_SHIP_FAMILIES: ManufacturingRigFamily[] = [
  'ships_t1_small',
  'ships_t1_medium',
  'ships_t1_large',
  'ships_t2_small',
  'ships_t2_medium',
  'ships_t2_large',
  'ships_capital',
]
const XL_STRUCTURE_FAMILIES: ManufacturingRigFamily[] = [
  'components_t2',
  'components_capital',
  'structures',
]

/** Rig picker rows for the selected hull. M-Set = split ME/TE, L/XL = one Efficiency pick. */
export function hullManufacturingRigSections(
  structureType: StructureType,
): HullManufacturingRigSection[] {
  const size = manufacturingRigFitSize(structureType)
  if (!size) return []
  if (size === 'xl') {
    return [
      {
        title: 'XL-Set',
        rows: [
          {
            id: 'xl_consumable',
            label: 'Equipment and consumable',
            iconTypeId: catalogRigIconTypeId('manufacturing', 'ammo', 'xl') ?? 37178,
            families: XL_CONSUMABLE_FAMILIES,
            combinedMeTe: true,
          },
          {
            id: 'xl_ships',
            label: 'Ship manufacturing',
            iconTypeId: catalogRigIconTypeId('manufacturing', 'ships_capital', 'xl') ?? 37180,
            families: XL_SHIP_FAMILIES,
            combinedMeTe: true,
          },
          {
            id: 'xl_structures',
            label: 'Structure and component',
            iconTypeId: catalogRigIconTypeId('manufacturing', 'structures', 'xl') ?? 43704,
            families: XL_STRUCTURE_FAMILIES,
            combinedMeTe: true,
          },
        ],
      },
    ]
  }

  const combinedMeTe = size === 'l'
  return MANUFACTURING_RIG_FAMILY_SECTIONS.map((section) => ({
    title: combinedMeTe ? `${section.title} (L-Set)` : section.title,
    rows: section.families.map((family) => ({
      id: family,
      label: manufacturingRigFamilyLabel(family),
      iconTypeId: manufacturingRigFamilyIconTypeId(family),
      families: [family],
      combinedMeTe,
    })),
  }))
}

export function manufacturingRigFamilyLabel(family: ManufacturingRigFamily): string {
  switch (family) {
    case 'ammo':
      return 'Ammunition'
    case 'drones':
      return 'Drones and fighters'
    case 'equipment':
      return 'Equipment'
    case 'ships_t1_small':
      return 'T1 small ships'
    case 'ships_t1_medium':
      return 'T1 medium ships'
    case 'ships_t1_large':
      return 'T1 large ships'
    case 'ships_t2_small':
      return 'T2 small ships'
    case 'ships_t2_medium':
      return 'T2 medium ships'
    case 'ships_t2_large':
      return 'T2 large ships'
    case 'ships_capital':
      return 'Capital ships'
    case 'components_t2':
      return 'T2 components'
    case 'components_capital':
      return 'Capital components'
    case 'structures':
      return 'Structures'
  }
}

/** M-Set / XL manufacturing rig type IDs for category icons (ESI inventory types). */
export const MANUFACTURING_RIG_FAMILY_ICON_TYPE_ID: Record<ManufacturingRigFamily, number> = {
  ammo: 37158,
  drones: 37156,
  equipment: 43920,
  ships_t1_small: 37154,
  ships_t1_medium: 37146,
  ships_t1_large: 43732,
  ships_t2_small: 43855,
  ships_t2_medium: 43858,
  ships_t2_large: 43862,
  ships_capital: 37180,
  components_t2: 43867,
  components_capital: 43870,
  structures: 43875,
}

export function manufacturingRigFamilyIconTypeId(family: ManufacturingRigFamily): number {
  return (
    catalogRigIconTypeId('manufacturing', family) ?? MANUFACTURING_RIG_FAMILY_ICON_TYPE_ID[family]
  )
}

const ALL_SHIPS: ManufacturingRigFamily[] = [
  'ships_t1_small',
  'ships_t1_medium',
  'ships_t1_large',
  'ships_t2_small',
  'ships_t2_medium',
  'ships_t2_large',
  'ships_capital',
]

const LAB_NAME = /blueprint copy|invention|me research|te research|laboratory optimization/i

/** Ordered most-specific first so "Small Ship" wins over generic "Ship Manufacturing". */
const RIG_NAME_FAMILIES: { match: RegExp; families: ManufacturingRigFamily[] }[] = [
  { match: /equipment and consumable manufacturing/i, families: ['ammo', 'drones', 'equipment'] },
  {
    match: /structure and component manufacturing/i,
    families: ['components_t2', 'components_capital', 'structures'],
  },
  { match: /advanced component manufacturing/i, families: ['components_t2'] },
  { match: /basic capital component manufacturing/i, families: ['components_capital'] },
  { match: /structure manufacturing/i, families: ['structures'] },
  { match: /equipment manufacturing/i, families: ['equipment'] },
  {
    match: /ammunition manufacturing|ammunition efficiency|ammunition me|ammunition te/i,
    families: ['ammo'],
  },
  { match: /drone and fighter/i, families: ['drones'] },
  { match: /advanced small ship/i, families: ['ships_t2_small'] },
  { match: /advanced medium ship/i, families: ['ships_t2_medium'] },
  { match: /advanced large ship/i, families: ['ships_t2_large'] },
  { match: /basic small ship/i, families: ['ships_t1_small'] },
  { match: /basic medium ship/i, families: ['ships_t1_medium'] },
  { match: /basic large ship/i, families: ['ships_t1_large'] },
  { match: /capital ship/i, families: ['ships_capital'] },
  { match: /ship manufacturing|ship efficiency/i, families: ALL_SHIPS },
]

const SHIPS_T1_SMALL = new Set([
  'Frigate',
  'Destroyer',
  'Shuttle',
  'Corvette',
  'Tactical Destroyer',
  'Special Edition Yachts',
])
const SHIPS_T2_SMALL = new Set([
  'Assault Frigate',
  'Covert Ops',
  'Electronic Attack Ship',
  'Interceptor',
  'Interdictor',
  'Stealth Bomber',
  'Command Destroyer',
  'Expedition Frigate',
  'Logistics Frigate',
])
const SHIPS_T1_MEDIUM = new Set([
  'Cruiser',
  'Attack Battlecruiser',
  'Combat Battlecruiser',
  'Hauler',
  'Mining Barge',
  'Strategic Cruiser',
])
const SHIPS_T2_MEDIUM = new Set([
  'Heavy Assault Cruiser',
  'Heavy Interdiction Cruiser',
  'Logistics',
  'Combat Recon Ship',
  'Force Recon Ship',
  'Command Ship',
  'Flag Cruiser',
  'Blockade Runner',
  'Deep Space Transport',
  'Exhumer',
])
const SHIPS_T1_LARGE = new Set([
  'Battleship',
  'Freighter',
  'Industrial Command Ship',
  'Expedition Command Ship',
])
const SHIPS_T2_LARGE = new Set(['Black Ops', 'Marauder', 'Jump Freighter'])
const SHIPS_CAPITAL = new Set([
  'Carrier',
  'Command Carrier',
  'Dreadnought',
  'Lancer Dreadnought',
  'Force Auxiliary',
  'Supercarrier',
  'Titan',
  'Capital Industrial Ship',
])

export function isLabStructureRigName(name: string): boolean {
  return LAB_NAME.test(name)
}

export function manufacturingFamiliesFromRigName(name: string): ManufacturingRigFamily[] {
  if (isLabStructureRigName(name)) return []
  for (const row of RIG_NAME_FAMILIES) {
    if (row.match.test(name)) return row.families
  }
  return []
}

function shipFamily(productGroup: string): ManufacturingRigFamily | null {
  if (SHIPS_CAPITAL.has(productGroup)) return 'ships_capital'
  if (SHIPS_T2_SMALL.has(productGroup)) return 'ships_t2_small'
  if (SHIPS_T2_MEDIUM.has(productGroup)) return 'ships_t2_medium'
  if (SHIPS_T2_LARGE.has(productGroup)) return 'ships_t2_large'
  if (SHIPS_T1_SMALL.has(productGroup)) return 'ships_t1_small'
  if (SHIPS_T1_MEDIUM.has(productGroup)) return 'ships_t1_medium'
  if (SHIPS_T1_LARGE.has(productGroup)) return 'ships_t1_large'
  return null
}

const SKIP_GROUPS = new Set([
  'Arkonor',
  'Bistot',
  'Crokite',
  'Dark Ochre',
  'Gneiss',
  'Hedbergite',
  'Hemorphite',
  'Ice',
  'Jaspet',
  'Kernite',
  'Mercoxit',
  'Omber',
  'Plagioclase',
  'Pyroxeres',
  'Scordite',
  'Spodumain',
  'Veldspar',
  'Biochemical Material',
  'Composite',
  'Hybrid Polymers',
  'Intermediate Materials',
  'Molecular-Forged Materials',
  'Unrefined Mineral',
  'Commodities',
  'Data Interfaces',
  'Expired Abyssal Battlefields Filaments',
  'Expired Jump Filaments',
  'Jump Filaments',
  'Miscellaneous',
  'Mutaplasmids',
  'Tool',
  'Warp Matrix Filaments',
  'Special Edition Commodities',
])

export function manufacturingRigFamilyForProduct(input: {
  productGroup: string
  tier?: BlueprintTier
  category?: string
}): ManufacturingRigFamily | null {
  const group = input.productGroup
  const category = input.category

  if (SKIP_GROUPS.has(group) || category === 'Asteroid') return null
  if (category === 'Material' && group !== 'Fuel Block') return null

  if (category === 'Charge' || group === 'Nanite Repair Paste') return 'ammo'
  if (category === 'Drone' || category === 'Fighter') return 'drones'
  if (
    category === 'Module' ||
    category === 'Implant' ||
    category === 'Deployable' ||
    category === 'Subsystem' ||
    category === 'Celestial'
  ) {
    return 'equipment'
  }
  if (category === 'Ship') return shipFamily(group)
  if (
    category === 'Structure' ||
    category === 'Starbase' ||
    category === 'Structure Module' ||
    category === 'Infrastructure Upgrades' ||
    category === 'Sovereignty Structures' ||
    category === 'Orbitals'
  ) {
    return 'structures'
  }

  if (group === 'Fuel Block' || group === 'Structure Components') return 'structures'
  if (
    group === 'Capital Construction Components' ||
    group === 'Advanced Capital Construction Components'
  ) {
    return 'components_capital'
  }
  if (
    group === 'Construction Components' ||
    group === 'Hybrid Tech Components' ||
    group === 'Unknown Components'
  ) {
    return 'components_t2'
  }

  const ships = shipFamily(group)
  if (ships) return ships

  if (
    /ammo|charge|missile|rocket|torpedo|bomb|crystal|probe|script|condenser|nanite/i.test(group)
  ) {
    return 'ammo'
  }
  if (/drone|fighter/i.test(group)) return 'drones'

  return 'equipment'
}
