import { useEffect, useMemo } from 'react'
import { LocationCombobox } from '@/components/LocationCombobox'
import { useAuthStore } from '@/stores/authStore'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { usePlayerStructureLocations } from '@/hooks/usePlayerStructureLocations'
import { findProductionLocation } from '@/lib/productionLocations'
import {
  patchRefineryType,
  REFINERY_TYPE_IDS,
  REFINERY_TYPES,
  refineryTypeFromTypeId,
  refineryTypeLabel,
} from '@/lib/refinerySettings'
import { securityForSystem } from '@/lib/structureSettings'
import type { GlobalSettings, ProductionLocation, RefineryType, SystemInfo } from '@/types'

interface RefineryLocationPickerProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  systems?: SystemInfo[]
  size?: 'sm' | 'md'
}

function locationRefineryType(location: ProductionLocation): RefineryType {
  return refineryTypeFromTypeId(location.structureTypeId, location.kind)
}

export function RefineryLocationPicker({
  settings,
  onChange,
  systems,
  size = 'md',
}: RefineryLocationPickerProps) {
  const facility = settings.reactionFacility
  const configured = useAuthStore((s) => s.configured)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const { hasAll, missing } = useAuthScopes(activeCharacterId)
  const { locations, jumpsTo, isLoading, error } = usePlayerStructureLocations(
    facility.reactionSystemId,
    'refinery',
  )

  const selectedLocation = useMemo(
    () =>
      findProductionLocation(locations, settings.reactionLocationId, settings.reactionLocationKind),
    [locations, settings.reactionLocationId, settings.reactionLocationKind],
  )

  const triggerRefineryType = selectedLocation
    ? locationRefineryType(selectedLocation)
    : facility.refineryType

  useEffect(() => {
    if (settings.reactionLocationId == null || isLoading) return
    if (selectedLocation) return
    onChange({ reactionLocationId: null, reactionLocationKind: null })
  }, [activeCharacterId, isLoading, onChange, selectedLocation, settings.reactionLocationId])

  // Keep reaction system aligned when a saved character location loads asynchronously.
  useEffect(() => {
    if (settings.reactionLocationId == null || isLoading || !selectedLocation) return
    const systemId = selectedLocation.solarSystemId
    if (systemId <= 0 || facility.reactionSystemId === systemId) return
    onChange({
      reactionFacility: {
        ...settings.reactionFacility,
        reactionSystemId: systemId,
        reactionSystemSecurity: securityForSystem(
          systems,
          systemId,
          settings.reactionFacility.reactionSystemSecurity ?? 1,
        ),
      },
    })
  }, [
    facility.reactionSystemId,
    facility.reactionSystemSecurity,
    isLoading,
    onChange,
    selectedLocation,
    settings.reactionLocationId,
    systems,
  ])

  function selectPreset(type: RefineryType) {
    onChange({
      reactionLocationId: null,
      reactionLocationKind: null,
      ...patchRefineryType(type, facility),
    })
  }

  function selectLocation(location: ProductionLocation) {
    const refineryType = locationRefineryType(location)
    onChange({
      reactionLocationId: location.locationId,
      reactionLocationKind: location.kind,
      ...patchRefineryType(refineryType, {
        ...facility,
        reactionSystemId: location.solarSystemId || facility.reactionSystemId,
        reactionSystemSecurity: securityForSystem(
          systems,
          location.solarSystemId || facility.reactionSystemId,
          facility.reactionSystemSecurity ?? 1,
        ),
      }),
    })
  }

  return (
    <LocationCombobox
      size={size}
      triggerTypeId={REFINERY_TYPE_IDS[triggerRefineryType]}
      triggerLabel={
        selectedLocation ? selectedLocation.name : refineryTypeLabel(facility.refineryType)
      }
      searchPlaceholder="Search refineries…"
      searchAriaLabel="Search refinery locations"
      locations={locations}
      selectedLocation={selectedLocation}
      locationTypeId={(location) => REFINERY_TYPE_IDS[locationRefineryType(location)]}
      locationDetail={(location) => {
        const jumps = jumpsTo(location)
        if (jumps == null) return 'structure'
        if (jumps === 0) return 'this system'
        return `${jumps} jump${jumps === 1 ? '' : 's'}`
      }}
      onSelectLocation={selectLocation}
      presets={REFINERY_TYPES}
      presetKey={(type) => type}
      presetLabel={refineryTypeLabel}
      presetTypeId={(type) => REFINERY_TYPE_IDS[type]}
      presetSelected={(type) => !selectedLocation && type === facility.refineryType}
      onSelectPreset={selectPreset}
      showCharacterLocations={configured && activeCharacterId != null}
      isLoading={isLoading}
      hasAll={hasAll}
      missing={missing}
      error={error}
      locationsHeading={`Player structures${locations.length > 0 ? ` · ${locations.length}` : ''}`}
      emptyLocations="No refineries within 5 jumps, and none holding this character's items."
      errorFallback="Failed to load refinery locations"
    />
  )
}
