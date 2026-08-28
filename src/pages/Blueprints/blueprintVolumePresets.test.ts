import { describe, expect, it } from 'vitest'
import {
  activeVolumePreset,
  BLUEPRINT_VOLUME_PRESETS,
  filterVolumePresets,
  volumePresetById,
} from '@/pages/Blueprints/blueprintVolumePresets'

describe('blueprintVolumePresets', () => {
  it('maps preset thresholds back to presets', () => {
    expect(activeVolumePreset(0)).toBeNull()
    expect(activeVolumePreset(10_000)?.id).toBe('ammo')
    expect(activeVolumePreset(100)?.id).toBe('module')
    expect(activeVolumePreset(999)).toBeNull()
  })

  it('uses unique minVolume per preset', () => {
    const volumes = BLUEPRINT_VOLUME_PRESETS.map((preset) => preset.minVolume)
    expect(new Set(volumes).size).toBe(volumes.length)
  })

  it('filters presets by label and keywords', () => {
    expect(filterVolumePresets('drone').map((p) => p.id)).toEqual(['drone'])
    expect(filterVolumePresets('formula').map((p) => p.id)).toEqual(['formula'])
    expect(filterVolumePresets('pos').map((p) => p.id)).toEqual(['starbase'])
  })

  it('finds preset by id', () => {
    expect(volumePresetById('ship').minVolume).toBe(31)
  })
})
