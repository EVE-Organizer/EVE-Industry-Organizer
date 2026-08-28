import { useEffect, useMemo } from 'react'
import { LocationCombobox } from '@/components/LocationCombobox'
import { useAuthStore } from '@/stores/authStore'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { useProductionLocations } from '@/hooks/useCharacterIndustryData'
import { findProductionLocation } from '@/lib/productionLocations'
import {
  MINING_REPROCESS_HULLS,
  miningReprocessHullFromLocation,
  miningReprocessHullLabel,
  miningReprocessSpaceFromSystem,
  normalizeMiningReprocessFacility,
} from '@/lib/miningReprocess'
import type { GlobalSettings, MiningReprocessHull, ProductionLocation, SystemInfo } from '@/types'

interface ReprocessLocationPickerProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  systems?: SystemInfo[]
  size?: 'sm' | 'md'
}

function hullTypeId(hull: MiningReprocessHull): number {
  return MINING_REPROCESS_HULLS.find((row) => row.id === hull)?.typeId ?? 1529
}

export function ReprocessLocationPicker({
  settings,
  onChange,
  systems,
  size = 'md',
}: ReprocessLocationPickerProps) {
  const facility = normalizeMiningReprocessFacility(settings.miningReprocessFacility)
  const configured = useAuthStore((s) => s.configured)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const { hasAll, missing } = useAuthScopes(activeCharacterId)
  const {
    data: locations = [],
    isLoading,
    error,
  } = useProductionLocations(configured && activeCharacterId != null ? activeCharacterId : null)

  const selectedLocation = useMemo(
    () =>
      findProductionLocation(
        locations,
        settings.miningReprocessLocationId,
        settings.miningReprocessLocationKind,
      ),
    [locations, settings.miningReprocessLocationId, settings.miningReprocessLocationKind],
  )

  const triggerHull = selectedLocation
    ? miningReprocessHullFromLocation(selectedLocation.kind, selectedLocation.structureTypeId)
    : facility.hull

  useEffect(() => {
    if (settings.miningReprocessLocationId == null || isLoading) return
    if (selectedLocation) return
    onChange({ miningReprocessLocationId: null, miningReprocessLocationKind: null })
  }, [activeCharacterId, isLoading, onChange, selectedLocation, settings.miningReprocessLocationId])

  useEffect(() => {
    if (settings.miningReprocessLocationId == null || isLoading || !selectedLocation) return
    const hull = miningReprocessHullFromLocation(
      selectedLocation.kind,
      selectedLocation.structureTypeId,
    )
    const space = miningReprocessSpaceFromSystem(
      systems,
      selectedLocation.solarSystemId,
      facility.space,
    )
    const next = normalizeMiningReprocessFacility({
      ...facility,
      hull,
      space,
      rig: hull === 'npc' ? 'none' : facility.rig,
    })
    if (next.hull === facility.hull && next.space === facility.space && next.rig === facility.rig) {
      return
    }
    onChange({ miningReprocessFacility: next })
  }, [facility, isLoading, onChange, selectedLocation, settings.miningReprocessLocationId, systems])

  function selectPreset(hull: MiningReprocessHull) {
    onChange({
      miningReprocessLocationId: null,
      miningReprocessLocationKind: null,
      miningReprocessFacility: normalizeMiningReprocessFacility({
        ...facility,
        hull,
        rig: hull === 'npc' ? 'none' : facility.rig,
      }),
    })
  }

  function selectLocation(location: ProductionLocation) {
    const hull = miningReprocessHullFromLocation(location.kind, location.structureTypeId)
    onChange({
      miningReprocessLocationId: location.locationId,
      miningReprocessLocationKind: location.kind,
      miningReprocessFacility: normalizeMiningReprocessFacility({
        ...facility,
        hull,
        space: miningReprocessSpaceFromSystem(systems, location.solarSystemId, facility.space),
        rig: hull === 'npc' ? 'none' : facility.rig,
      }),
    })
  }

  return (
    <LocationCombobox
      size={size}
      triggerTypeId={hullTypeId(triggerHull)}
      triggerLabel={
        selectedLocation ? selectedLocation.name : miningReprocessHullLabel(facility.hull)
      }
      searchPlaceholder="Search reprocess locations…"
      searchAriaLabel="Search reprocess locations"
      locations={locations}
      selectedLocation={selectedLocation}
      locationTypeId={(location) =>
        hullTypeId(miningReprocessHullFromLocation(location.kind, location.structureTypeId))
      }
      locationDetail={(location) => (location.kind === 'structure' ? '(structure)' : '(station)')}
      onSelectLocation={selectLocation}
      presets={MINING_REPROCESS_HULLS}
      presetKey={(hull) => hull.id}
      presetLabel={(hull) => hull.label}
      presetTypeId={(hull) => hull.typeId}
      presetSelected={(hull) => !selectedLocation && hull.id === facility.hull}
      presetHint={(hull) => hull.hint}
      onSelectPreset={(hull) => selectPreset(hull.id)}
      showCharacterLocations={configured && activeCharacterId != null}
      isLoading={isLoading}
      hasAll={hasAll}
      missing={missing}
      error={error}
      locationsHeading="Your locations"
      emptyLocations="No locations found. Run a job or store assets at a station or structure."
      errorFallback="Failed to load reprocess locations"
      listClassName="max-h-72"
    />
  )
}
