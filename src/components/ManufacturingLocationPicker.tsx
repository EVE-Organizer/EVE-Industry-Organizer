import { useEffect, useMemo, useRef, useState } from 'react'
import { EveImage } from '@/components/EveImage'
import { useAuthStore } from '@/stores/authStore'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { usePlayerStructureLocations } from '@/hooks/usePlayerStructureLocations'
import { findProductionLocation } from '@/lib/productionLocations'
import { structureTypeFromTypeId } from '@/lib/structureTypeFromTypeId'
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
    const facility =
      settings.copyFacility ?? defaultScienceFacility(settings.manufacturingSystemId)
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

function LocationArt({
  structureType,
  slotSize,
}: {
  structureType: StructureType
  slotSize: number
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-eve-border bg-base-300/80 shadow-sm"
      style={{ width: slotSize, height: slotSize }}
      aria-hidden
    >
      <EveImage
        id={STRUCTURE_TYPE_IDS[structureType]}
        variant="render"
        size={slotSize}
        framed={false}
        alt=""
        lazy={false}
        className="max-w-full max-h-full object-contain"
      />
    </span>
  )
}

function locationStructureType(location: ProductionLocation): StructureType {
  return structureTypeFromTypeId(location.structureTypeId)
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase())
}

export function ManufacturingLocationPicker({
  settings,
  onChange,
  systems,
  size = 'md',
  activity = 'manufacturing',
  showInventoryHint = false,
}: ManufacturingLocationPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
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
  const {
    locations,
    jumpsTo,
    isLoading,
    error,
  } = usePlayerStructureLocations(current.fallbackSystemId, 'manufacturing')

  const selectedLocation = useMemo(
    () =>
      findProductionLocation(
        locations,
        current.locationId,
        current.locationKind,
      ),
    [locations, current.locationId, current.locationKind],
  )

  const triggerLabel = selectedLocation
    ? selectedLocation.name
    : structureTypeLabel(current.structureType)

  const triggerStructureType = selectedLocation
    ? locationStructureType(selectedLocation)
    : current.structureType

  const filteredLocations = useMemo(() => {
    const q = query.trim()
    if (!q) return locations
    return locations.filter((location) => matchesQuery(location.name, q))
  }, [locations, query])

  const filteredPresets = useMemo(() => {
    const q = query.trim()
    if (!q) return STRUCTURE_TYPES
    return STRUCTURE_TYPES.filter((type) => matchesQuery(structureTypeLabel(type), q))
  }, [query])

  const showCharacterLocations = configured && activeCharacterId != null
  const hasSearch = query.trim().length > 0
  const showLocationSection =
    showCharacterLocations && (!hasSearch || filteredLocations.length > 0 || isLoading || !hasAll)
  const showPresetSection = !hasSearch || filteredPresets.length > 0
  const noMatches =
    hasSearch && filteredLocations.length === 0 && filteredPresets.length === 0

  const triggerSlot = size === 'sm' ? 40 : 44
  const optionSlot = size === 'sm' ? 36 : 40
  const triggerClass =
    size === 'sm'
      ? 'input input-bordered input-sm !h-12 !min-h-12 py-1'
      : 'input input-bordered !h-14 !min-h-14 py-1.5'

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const id = window.requestAnimationFrame(() => searchRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

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
  }, [
    activity,
    activeCharacterId,
    current.locationId,
    isLoading,
    onChange,
    selectedLocation,
  ])

  // Keep build system + security aligned when location or SDE loads asynchronously.
  useEffect(() => {
    if (activity !== 'manufacturing') return
    if (settings.productionLocationId == null || isLoading || !selectedLocation) return
    const patch = patchManufacturingSystemIfStale(
      systems,
      selectedLocation.solarSystemId,
      {
        manufacturingSystemId: settings.manufacturingSystemId,
        buildSystemSecurity: settings.buildSystemSecurity,
      },
    )
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
    setOpen(false)
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
    setOpen(false)
  }

  return (
    <div className="w-full min-w-0">
      <div ref={rootRef} className="relative w-full min-w-0">
        <button
          type="button"
          className={`${triggerClass} flex items-center gap-3 w-full overflow-hidden pr-8 text-left ${
            open ? 'input-primary' : ''
          }`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <LocationArt structureType={triggerStructureType} slotSize={triggerSlot} />
          <span className="grow min-w-0 truncate text-sm">{triggerLabel}</span>
        </button>
        <span
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-40"
          aria-hidden
        >
          ▾
        </span>

        {open ? (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-eve-border bg-base-200 shadow-lg">
            <div className="sticky top-0 z-10 border-b border-eve-border/60 bg-base-200 p-2">
              <input
                ref={searchRef}
                type="search"
                className={`input input-bordered w-full ${size === 'sm' ? 'input-sm' : ''}`}
                placeholder="Search locations…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label={
                  activity === 'copy'
                    ? 'Search copy locations'
                    : activity === 'invention'
                      ? 'Search invention locations'
                      : 'Search manufacturing locations'
                }
              />
            </div>

            <ul className="max-h-[min(36rem,70vh)] overflow-y-auto py-1" role="listbox">
              {noMatches ? (
                <li className="px-3 py-2 text-xs opacity-60">No matching locations.</li>
              ) : null}

              {showLocationSection ? (
                <>
                  {!hasSearch ? (
                    <li className="menu-title px-3 py-1.5 text-[10px] uppercase tracking-wide opacity-50">
                      Player structures
                      {locations.length > 0 ? ` · ${locations.length}` : ''}
                    </li>
                  ) : null}
                  {!hasAll ? (
                    <li className="px-3 py-2 text-xs text-warning">
                      Missing scopes: {missing.join(', ')}. Re-authorize from the nav bar.
                    </li>
                  ) : isLoading ? (
                    <li className="px-3 py-2 text-xs opacity-60">Loading locations…</li>
                  ) : !hasSearch && locations.length === 0 ? (
                    <li className="px-3 py-2 text-xs opacity-60">
                      No structures within 5 jumps, and none holding this character's items.
                    </li>
                  ) : (
                    filteredLocations.map((location) => {
                      const selected = selectedLocation?.id === location.id
                      const structureType = locationStructureType(location)
                      const jumps = jumpsTo(location)
                      return (
                        <li key={location.id} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-base-300/80 ${
                              selected ? 'bg-primary/10 text-primary' : ''
                            }`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectLocation(location)}
                          >
                            <LocationArt structureType={structureType} slotSize={optionSlot} />
                            <span className="min-w-0 truncate">
                              <span className="font-medium">{location.name}</span>
                              <span className="ml-1 text-xs opacity-50">
                                {jumps == null
                                  ? 'structure'
                                  : jumps === 0
                                    ? 'this system'
                                    : `${jumps} jump${jumps === 1 ? '' : 's'}`}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })
                  )}
                </>
              ) : null}

              {showPresetSection ? (
                <>
                  {!hasSearch ? (
                    <li className="menu-title px-3 py-1.5 text-[10px] uppercase tracking-wide opacity-50">
                      Presets
                    </li>
                  ) : null}
                  {filteredPresets.map((type) => {
                    const selected = !selectedLocation && type === current.structureType
                    return (
                      <li key={type} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-base-300/80 ${
                            selected ? 'bg-primary/10 text-primary' : ''
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPreset(type)}
                        >
                          <LocationArt structureType={type} slotSize={optionSlot} />
                          <span className="font-medium truncate">{structureTypeLabel(type)}</span>
                        </button>
                      </li>
                    )
                  })}
                </>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-error mt-1">
          {error instanceof Error ? error.message : 'Failed to load locations'}
        </p>
      ) : null}

      {showInventoryHint && activity === 'manufacturing' && selectedLocation ? (
        <p className="text-[11px] opacity-60 mt-1">
          Buy-list inventory matches {selectedLocation.name} for the nav bar character.
        </p>
      ) : null}
    </div>
  )
}
