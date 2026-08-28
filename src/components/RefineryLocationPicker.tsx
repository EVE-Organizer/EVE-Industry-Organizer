import { useEffect, useMemo, useRef, useState } from 'react'
import { EveImage } from '@/components/EveImage'
import { useAuthStore } from '@/stores/authStore'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { usePlayerStructureLocations } from '@/hooks/usePlayerStructureLocations'
import { findProductionLocation } from '@/lib/productionLocations'
import { refineryTypeFromTypeId } from '@/lib/refineryTypeFromTypeId'
import {
  patchRefineryType,
  REFINERY_TYPE_IDS,
  REFINERY_TYPES,
  refineryTypeLabel,
} from '@/lib/refinerySettings'
import type { GlobalSettings, ProductionLocation, RefineryType } from '@/types'

interface RefineryLocationPickerProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  size?: 'sm' | 'md'
}

function RefineryArt({ type, slotSize }: { type: RefineryType; slotSize: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-eve-border bg-base-300/80 shadow-sm"
      style={{ width: slotSize, height: slotSize }}
      aria-hidden
    >
      <EveImage
        id={REFINERY_TYPE_IDS[type]}
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

function locationRefineryType(location: ProductionLocation): RefineryType {
  return refineryTypeFromTypeId(location.structureTypeId, location.kind)
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase())
}

export function RefineryLocationPicker({
  settings,
  onChange,
  size = 'md',
}: RefineryLocationPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const facility = settings.reactionFacility
  const configured = useAuthStore((s) => s.configured)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const { hasAll, missing } = useAuthScopes(activeCharacterId)
  const {
    locations,
    jumpsTo,
    isLoading,
    error,
  } = usePlayerStructureLocations(facility.reactionSystemId, 'refinery')

  const selectedLocation = useMemo(
    () =>
      findProductionLocation(
        locations,
        settings.reactionLocationId,
        settings.reactionLocationKind,
      ),
    [locations, settings.reactionLocationId, settings.reactionLocationKind],
  )

  const triggerLabel = selectedLocation
    ? selectedLocation.name
    : refineryTypeLabel(facility.refineryType)

  const triggerRefineryType = selectedLocation
    ? locationRefineryType(selectedLocation)
    : facility.refineryType

  const filteredLocations = useMemo(() => {
    const q = query.trim()
    if (!q) return locations
    return locations.filter((location) => matchesQuery(location.name, q))
  }, [locations, query])

  const filteredPresets = useMemo(() => {
    const q = query.trim()
    if (!q) return REFINERY_TYPES
    return REFINERY_TYPES.filter((type) => matchesQuery(refineryTypeLabel(type), q))
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
    if (settings.reactionLocationId == null || isLoading) return
    if (selectedLocation) return
    onChange({ reactionLocationId: null, reactionLocationKind: null })
  }, [
    activeCharacterId,
    isLoading,
    onChange,
    selectedLocation,
    settings.reactionLocationId,
  ])

  // Keep reaction system aligned when a saved character location loads asynchronously.
  useEffect(() => {
    if (settings.reactionLocationId == null || isLoading || !selectedLocation) return
    const systemId = selectedLocation.solarSystemId
    if (systemId <= 0 || facility.reactionSystemId === systemId) return
    onChange({
      reactionFacility: { ...settings.reactionFacility, reactionSystemId: systemId },
    })
  }, [
    facility.reactionSystemId,
    isLoading,
    onChange,
    selectedLocation,
    settings.reactionFacility,
    settings.reactionLocationId,
  ])

  function selectPreset(type: RefineryType) {
    onChange({
      reactionLocationId: null,
      reactionLocationKind: null,
      ...patchRefineryType(type, facility),
    })
    setOpen(false)
  }

  function selectLocation(location: ProductionLocation) {
    const refineryType = locationRefineryType(location)
    onChange({
      reactionLocationId: location.locationId,
      reactionLocationKind: location.kind,
      ...patchRefineryType(refineryType, {
        ...facility,
        reactionSystemId: location.solarSystemId || facility.reactionSystemId,
      }),
    })
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
          <RefineryArt type={triggerRefineryType} slotSize={triggerSlot} />
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
                placeholder="Search refineries…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Search refinery locations"
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
                      Player structures (3 jumps)
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
                      No refineries within 3 jumps of this character. Private citadels still need
                      corp access or a prior dock.
                    </li>
                  ) : (
                    filteredLocations.map((location) => {
                      const selected = selectedLocation?.id === location.id
                      const refineryType = locationRefineryType(location)
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
                            <RefineryArt type={refineryType} slotSize={optionSlot} />
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
                    const selected = !selectedLocation && type === facility.refineryType
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
                          <RefineryArt type={type} slotSize={optionSlot} />
                          <span className="font-medium truncate">{refineryTypeLabel(type)}</span>
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
          {error instanceof Error ? error.message : 'Failed to load refinery locations'}
        </p>
      ) : null}
    </div>
  )
}
