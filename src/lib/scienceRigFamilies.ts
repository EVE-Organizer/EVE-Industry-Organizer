import type { ScienceActivity, StructureType } from '@/types'

/** M-Set split rigs, L-Set optimization, or XL laboratory bundle. */
export type ScienceRigLayout = 'split' | 'optimization' | 'xl-laboratory'

export function scienceRigLayout(structureType: StructureType): ScienceRigLayout | null {
  if (structureType === 'npc') return null
  if (structureType === 'sotiyo') return 'xl-laboratory'
  if (structureType === 'azbel') return 'optimization'
  return 'split'
}

export function scienceRigSetLabel(layout: ScienceRigLayout): string {
  switch (layout) {
    case 'split':
      return 'M-Set'
    case 'optimization':
      return 'L-Set'
    case 'xl-laboratory':
      return 'XL-Set'
  }
}

/** In-game rig type IDs from SDE (T1 rig icons for each laboratory row). */
export const SCIENCE_RIG_ROW: Record<
  ScienceActivity,
  {
    label: string
    section: string
    /** L-Set optimization rig (Azbel row icon). */
    iconTypeId: number
    /** M-Set cost optimization T1. */
    mCostIconTypeId: number
    /** M-Set accelerator T1. */
    mTimeIconTypeId: number
  }
> = {
  copy: {
    label: 'Blueprint copy',
    section: 'Laboratory',
    iconTypeId: 43729,
    mCostIconTypeId: 43891,
    mTimeIconTypeId: 43893,
  },
  invention: {
    label: 'Invention',
    section: 'Laboratory',
    iconTypeId: 43722,
    mCostIconTypeId: 43879,
    mTimeIconTypeId: 43880,
  },
}

/** Standup XL-Set Laboratory Optimization I */
export const XL_LABORATORY_RIG_ICON = 37183
