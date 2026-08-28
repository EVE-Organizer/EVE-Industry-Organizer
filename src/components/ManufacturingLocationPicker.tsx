import { useEffect, useMemo } from 'react'
import { LocationCombobox } from '@/components/LocationCombobox'
import { useAuthStore } from '@/stores/authStore'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { usePlayerStructureLocations } from '@/hooks/usePlayerStructureLocations'
import { findProductionLocation } from '@/lib/productionLocations'
import {
  patchScienceStructureType,
  patchStructureType,
  patchManufacturingSystemFromList,
  patchManufacturingSystemIfStale,
  patchScienceFacilityFromLocation,
  scienceFacilityForSystem,
  securityForSystem,
  STRUCTURE_TYPE_IDS,
  STRUCTURE_TYPES,
  structureTypeFromTypeId,
  structureTypeLabel,
  type ScienceFacilityKey,
} from '@/lib/structureSettings'
import { defaultScienceFacility } from '@/types'
import type {
  GlobalSettings,
  ProductionLocation,
  ProductionLocationKind,
  ScienceFacilitySettings,
  StructureType,
  SystemInfo,
} from '@/types'

export type EngineeringActivity = 'manufacturing' | 'copy' | 'invention'

interface ManufacturingLocationPickerProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  systems?: SystemInfo[]
  size?: 'sm' | 'md'
  activity?: EngineeringActivity
  /** Show buy-list inventory hint when a character station is selected (Plan page). */
  showInventoryHint?: boolean
}

function scienceFacilityKey(activity: 'copy' | 'invention'): ScienceFacilityKey {
  return activity === 'copy' ? 'copyFacility' : 'inventionFacility'
}

function activityLocation(
  settings: GlobalSettings,
  activity: EngineeringActivity,
): {
  locationId: number | null | undefined
  locationKind: ProductionLocationKind | null | undefined
  structureType: StructureType
  fallbackSystemId: number
  facility?: ScienceFacilitySettings
} {
  if (activity === 'copy') {
    const facility = settings.copyFacility ?? defaultScienceFacility(settings.manufacturingSystemId)
    return {
      locationId: settings.copyLocationId,
      locationKind: settings.copyLocationKind,
      structureType: facility.structureType,
      fallbackSystemId: facility.systemId,
      facility,
    }
  }
  if (activity === 'invention') {
    const facility =
      settings.inventionFacility ?? defaultScienceFacility(settings.manufacturingSystemId)
    return {
      locationId: settings.inventionLocationId,
      locationKind: settings.inventionLocationKind,
      structureType: facility.structureType,
      fallbackSystemId: facility.systemId,
      facility,
    }
  }
  return {
    locationId: settings.productionLocationId,
    locationKind: settings.productionLocationKind,
    structureType: settings.structureType,
    fallbackSystemId: settings.manufacturingSystemId,
  }
}

function locationStructureType(location: ProductionLocation): StructureType {
  return structureTypeFromTypeId(location.structureTypeId)
}

export function ManufacturingLocationPicker({
  settings,
  onChange,
  systems,
  size = 'md',
  activity = 'manufacturing',
  showInventoryHint = false,
}: ManufacturingLocationPickerProps) {
  const current = activityLocation(settings, activity)
  const scienceFacility =
    activity === 'copy'
      ? settings.copyFacility
      : activity === 'invention'
        ? settings.inventionFacility
        : undefined

  const configured = useAuthStore((s) => s.configured)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const { hasAll, missing } = useAuthScopes(activeCharacterId)
  const { locations, jumpsTo, isLoading, error } = usePlayerStructureLocations(
    current.fallbackSystemId,
    'manufacturing',
  )

  const selectedLocation = useMemo(
    () => findProductionLocation(locations, current.locationId, current.locationKind),
    [locations, current.locationId, current.locationKind],
  )

  const triggerStructureType = selectedLocation
    ? locationStructureType(selectedLocation)
    : current.structureType

  useEffect(() => {
    if (current.locationId == null || isLoading) return
    if (selectedLocation) return
    if (activity === 'copy') {
      onChange({ copyLocationId: null, copyLocationKind: null })
    } else if (activity === 'invention') {
      onChange({ inventionLocationId: null, inventionLocationKind: null })
    } else {
      onChange({ productionLocationId: null, productionLocationKind: null })
    }
  }, [activity, activeCharacterId, current.locationId, isLoading, onChange, selectedLocation])

  // Keep build system + security aligned when location or SDE loads asynchronously.
  useEffect(() => {
    if (activity !== 'manufacturing') return
    if (settings.productionLocationId == null || isLoading || !selectedLocation) return
    const patch = patchManufacturingSystemIfStale(systems, selectedLocation.solarSystemId, {
      manufacturingSystemId: settings.manufacturingSystemId,
      buildSystemSecurity: settings.buildSystemSecurity,
    })
    if (patch) onChange(patch)
  }, [
    activity,
    isLoading,
    onChange,
    selectedLocation,
    settings.buildSystemSecurity,
    settings.manufacturingSystemId,
    settings.productionLocationId,
    systems,
  ])

  // Apply structure type and system when a saved copy/invention location loads.
  useEffect(() => {
    if (activity !== 'copy' && activity !== 'invention') return
    if (current.locationId == null || isLoading || !selectedLocation) return
    const patch = patchScienceFacilityFromLocation(
      scienceFacilityKey(activity),
      current.facility ?? scienceFacility,
      locationStructureType(selectedLocation),
      selectedLocation.solarSystemId,
      systems,
      settings.manufacturingSystemId,
    )
    if (patch) onChange(patch)
  }, [
    activity,
    current.facility,
    current.locationId,
    isLoading,
    onChange,
    selectedLocation,
    scienceFacility?.structureType,
    scienceFacility?.systemId,
    scienceFacility?.systemSecurity,
    settings.manufacturingSystemId,
    systems,
  ])

  function selectPreset(type: StructureType) {
    if (activity === 'copy' || activity === 'invention') {
      const key = scienceFacilityKey(activity)
      const facility = current.facility ?? settings[key]
      onChange({
        ...(activity === 'copy'
          ? { copyLocationId: null, copyLocationKind: null }
          : { inventionLocationId: null, inventionLocationKind: null }),
        ...patchScienceStructureType(key, type, facility),
      })
    } else {
      onChange({
        productionLocationId: null,
        productionLocationKind: null,
        ...patchStructureType(type),
      })
    }
  }

  function selectLocation(location: ProductionLocation) {
    const systemId = location.solarSystemId
    const structureType = locationStructureType(location)
    if (activity === 'copy' || activity === 'invention') {
      const key = scienceFacilityKey(activity)
      const base = current.facility ?? settings[key]
      const facility =
        systemId > 0
          ? scienceFacilityForSystem(
              base,
              systemId,
              securityForSystem(systems, systemId, base.systemSecurity ?? 1),
            )
          : base
      onChange({
        ...(activity === 'copy'
          ? { copyLocationId: location.locationId, copyLocationKind: location.kind }
          : { inventionLocationId: location.locationId, inventionLocationKind: location.kind }),
        ...patchScienceStructureType(key, structureType, facility),
      })
    } else {
      onChange({
        productionLocationId: location.locationId,
        productionLocationKind: location.kind,
        ...(systemId > 0
          ? patchManufacturingSystemFromList(systems, systemId, settings.buildSystemSecurity ?? 1)
          : {}),
        ...patchStructureType(structureType),
      })
    }
  }

  return (
    <LocationCombobox
      size={size}
      triggerTypeId={STRUCTURE_TYPE_IDS[triggerStructureType]}
      triggerLabel={
        selectedLocation ? selectedLocation.name : structureTypeLabel(current.structureType)
      }
      searchPlaceholder="Search locations…"
      searchAriaLabel={
        activity === 'copy'
          ? 'Search copy locations'
          : activity === 'invention'
            ? 'Search invention locations'
            : 'Search manufacturing locations'
      }
      locations={locations}
      selectedLocation={selectedLocation}
      locationTypeId={(location) => STRUCTURE_TYPE_IDS[locationStructureType(location)]}
      locationDetail={(location) => {
        const jumps = jumpsTo(location)
        if (jumps == null) return 'structure'
        if (jumps === 0) return 'this system'
        return `${jumps} jump${jumps === 1 ? '' : 's'}`
      }}
      onSelectLocation={selectLocation}
      presets={STRUCTURE_TYPES}
      presetKey={(type) => type}
      presetLabel={structureTypeLabel}
      presetTypeId={(type) => STRUCTURE_TYPE_IDS[type]}
      presetSelected={(type) => !selectedLocation && type === current.structureType}
      onSelectPreset={selectPreset}
      showCharacterLocations={configured && activeCharacterId != null}
      isLoading={isLoading}
      hasAll={hasAll}
      missing={missing}
      error={error}
      locationsHeading={`Player structures${locations.length > 0 ? ` · ${locations.length}` : ''}`}
      emptyLocations="No structures within 5 jumps, and none holding this character's items."
      errorFallback="Failed to load locations"
    >
      {showInventoryHint && activity === 'manufacturing' && selectedLocation ? (
        <p className="text-[11px] opacity-60 mt-1">
          Buy-list inventory matches {selectedLocation.name} for the nav bar character.
        </p>
      ) : null}
    </LocationCombobox>
  )
}
