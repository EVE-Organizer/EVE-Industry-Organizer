import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LoadingState } from '@/components/Layout'
import { GalaxyMapCanvas } from '@/components/map/GalaxyMapCanvas'
import { MapLegend } from '@/components/map/MapLegend'
import { MapSystemSearch } from '@/components/map/MapSystemSearch'
import { MapSidebar, type MapSidebarTab } from '@/components/map/MapSidebar'
import { MapOverlayContextProvider } from '@/components/map/mapOverlayContext'
import { useSdeData } from '@/hooks/useSdeData'
import { useMapData } from '@/hooks/useMapData'
import { useMapOverlays } from '@/hooks/useMapOverlays'
import { buildMapGraph } from '@/services/data/mapLoader'
import { buildMapOpportunities } from '@/lib/mapOpportunities'
import { getHubMarket } from '@/services/data/sdeLoader'
import { useAppStore } from '@/stores/appStore'
import { hubDisplayName } from '@/lib/hubDisplay'
import { DEFAULT_BATCH_SIZE, HUBS } from '@/types'
import type { HubId } from '@/types'
import { DEFAULT_MAP_LAYERS, type MapLayers, type WarIntelAnchor, type WarIntelRadius, type WarIntelWindow, type WarTheater } from '@/types/map'
import { loadWarIntelSettings, saveWarIntelSettings } from '@/lib/warIntelSettings'
import { SPIKE_THRESHOLD } from '@/lib/volumeSpike'

export function MapPage() {
  const { data: sde, isLoading: sdeLoading } = useSdeData()
  const { data: mapData, isLoading: mapLoading } = useMapData()
  const settings = useAppStore((s) => s.userData.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)

  const [layers, setLayers] = useState<MapLayers>(() => ({ ...DEFAULT_MAP_LAYERS }))
  const [warIntelAnchor, setWarIntelAnchor] = useState<WarIntelAnchor>(
    () => loadWarIntelSettings().anchor,
  )
  const [warIntelRadius, setWarIntelRadius] = useState<WarIntelRadius>(
    () => loadWarIntelSettings().radius,
  )
  const [warIntelWindow, setWarIntelWindow] = useState<WarIntelWindow>(
    () => loadWarIntelSettings().window,
  )
  const [centerSystemId, setCenterSystemId] = useState<number | null>(() => {
    const saved = loadWarIntelSettings()
    return saved.anchor === 'mapCenter' ? saved.mapCenterSystemId : null
  })
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null)
  const [selectedProductTypeId, setSelectedProductTypeId] = useState<number | null>(null)
  const [refreshWarToken, setRefreshWarToken] = useState(0)
  const [recenterToken, setRecenterToken] = useState(0)
  const [focusedWarTheaterId, setFocusedWarTheaterId] = useState<string | null>(null)
  const [warTheaterFocusToken, setWarTheaterFocusToken] = useState(0)
  const [sidebarTab, setSidebarTab] = useState<MapSidebarTab>('opportunity')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mapOverlayRoot, setMapOverlayRoot] = useState<HTMLElement | null>(null)
  const mapWorkspaceRef = useRef<HTMLDivElement>(null)

  const manufacturingSystemId = settings.manufacturingSystemId
  const primaryHub = settings.primaryHub
  const sellHubId = settings.sellHubId ?? settings.primaryHub

  const defaultCenter = useMemo(() => {
    if (manufacturingSystemId) return manufacturingSystemId
    const hubMarket = sde ? getHubMarket(sde.market, primaryHub) : null
    return hubMarket?.marketSystemId ?? HUBS[0]!.marketSystemId
  }, [manufacturingSystemId, sde, primaryHub])

  const activeCenter = centerSystemId ?? defaultCenter

  useEffect(() => {
    const prev = loadWarIntelSettings()
    saveWarIntelSettings({
      anchor: warIntelAnchor,
      radius: warIntelRadius,
      window: warIntelWindow,
      mapCenterSystemId:
        warIntelAnchor === 'mapCenter'
          ? (centerSystemId ?? defaultCenter)
          : prev.mapCenterSystemId,
    })
  }, [warIntelAnchor, warIntelRadius, warIntelWindow, centerSystemId, defaultCenter])

  const graph = useMemo(
    () => (mapData ? buildMapGraph(mapData) : undefined),
    [mapData],
  )

  const overlays = useMapOverlays({
    sde,
    graph,
    primaryHub,
    sellHubId,
    manufacturingSystemId,
    centerSystemId: activeCenter,
    layers,
    refreshWarToken,
    warIntelAnchor,
    warIntelRadius,
    warIntelWindow,
  })

  const opportunities = useMemo(() => {
    if (!sde || !graph) return []
    return buildMapOpportunities({
      sde,
      graph,
      settings: { ...settings, batchSize: DEFAULT_BATCH_SIZE },
      primaryHub,
      sellHubId,
      warResults: overlays.warResults,
      warTheaters: overlays.warTheaters,
      haulOutRoute: overlays.haulOutRoute,
      campSystemIds: overlays.campSystemIds,
    })
  }, [
    sde,
    graph,
    settings,
    primaryHub,
    sellHubId,
    overlays.warResults,
    overlays.warTheaters,
    overlays.haulOutRoute,
    overlays.campSystemIds,
  ])

  const spikeHubIds = useMemo(() => {
    const ids = new Set<HubId>()
    if (!sde) return ids
    const typeIds = opportunities.map((o) => o.productTypeId)
    for (const hub of HUBS) {
      const spikes = typeIds.filter((typeId) => {
        const hubMarket = sde.market.hubs[hub.id]
        if (!hubMarket) return false
        const w = hubMarket.products[String(typeId)]?.['1w']?.avgVolume ?? 0
        const d = hubMarket.products[String(typeId)]?.['1d']?.avgVolume ?? 0
        return w > 0 && d / w >= SPIKE_THRESHOLD
      })
      if (spikes.length > 0) ids.add(hub.id)
    }
    return ids
  }, [sde, opportunities])

  const factorySystem = sde?.systems.find((s) => s.systemId === manufacturingSystemId)
  const buyHubName = hubDisplayName(primaryHub)

  const warCount = useMemo(
    () => overlays.warTheaters.reduce((sum, t) => sum + t.systemIds.length, 0),
    [overlays.warTheaters],
  )

  const warIntelAge = useMemo(() => {
    if (!overlays.killsFetchedAt) return null
    return new Date(overlays.killsFetchedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [overlays.killsFetchedAt])

  const handleResetCenter = useCallback(() => {
    setCenterSystemId(defaultCenter)
    setSelectedSystemId(null)
    setRecenterToken((t) => t + 1)
  }, [defaultCenter])

  const handleSetSellHub = useCallback(
    (hubId: HubId) => {
      updateSettings({ sellHubId: hubId })
    },
    [updateSettings],
  )

  const handleSelectOpportunity = useCallback(
    (id: number) => {
      setSelectedProductTypeId(id)
      const row = opportunities.find((o) => o.productTypeId === id)
      if (!row) return

      const focusSystemId =
        row.warSystemId ?? HUBS.find((h) => h.id === row.sellHubId)?.marketSystemId ?? null

      if (focusSystemId) {
        setSelectedSystemId(focusSystemId)
        setCenterSystemId(focusSystemId)
      }
    },
    [opportunities],
  )

  const handleRecenterSystem = useCallback((systemId: number) => {
    setCenterSystemId(systemId)
    setSelectedSystemId(systemId)
    setRecenterToken((t) => t + 1)
  }, [])

  const handleSearchSelectSystem = useCallback(
    (systemId: number) => {
      handleRecenterSystem(systemId)
    },
    [handleRecenterSystem],
  )

  const handleFocusWarTheater = useCallback((theater: WarTheater) => {
    setFocusedWarTheaterId(theater.id)
    setSelectedSystemId(theater.focalSystemId)
    setWarTheaterFocusToken((t) => t + 1)
  }, [])

  const handleClearWarTheaterFocus = useCallback(() => {
    setFocusedWarTheaterId(null)
  }, [])

  const mapSystems = useMemo(() => Array.from(graph?.systems.values() ?? []), [graph])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === mapWorkspaceRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleToggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await mapWorkspaceRef.current?.requestFullscreen()
  }, [])

  if (sdeLoading || mapLoading) {
    return <LoadingState />
  }

  if (!sde || !mapData || !graph) {
    return (
      <div className="px-3">
        <h1 className="text-2xl font-bold">Map</h1>
        <p className="text-sm opacity-80 mt-2">Map data unavailable. Run fetch-data to build map.json.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <MapOverlayContextProvider value={mapOverlayRoot}>
        <div
          ref={mapWorkspaceRef}
          className={`relative flex flex-1 min-h-0 overflow-hidden bg-base-300 ${
            isFullscreen ? 'h-screen w-screen' : ''
          } flex-col lg:flex-row`}
        >
          <div
            ref={setMapOverlayRoot}
            className="relative flex-[3] min-w-0 min-h-0 lg:flex-1"
          >
          <div className="absolute top-3 left-3 z-30 w-[min(14rem,calc(100%-5rem))]">
            <MapSystemSearch
              variant="overlay"
              systems={mapSystems}
              regions={sde.regions}
              onSelect={handleSearchSelectSystem}
            />
          </div>

          <button
            type="button"
            className="btn btn-xs btn-outline absolute top-3 right-3 z-20 bg-base-200/90 backdrop-blur"
            onClick={() => void handleToggleFullscreen()}
          >
            {isFullscreen ? 'Exit' : '⛶'}
          </button>

          <GalaxyMapCanvas
            mapData={mapData}
            graph={graph}
            layers={layers}
            centerSystemId={activeCenter}
            manufacturingSystemId={manufacturingSystemId}
            selectedSystemId={selectedSystemId}
          warResults={overlays.warResults}
          warTheaters={overlays.warTheaters}
          haulInRoute={overlays.haulInRoute}
            haulOutRoute={overlays.haulOutRoute}
            campSystemIds={overlays.campSystemIds}
            spikeHubIds={spikeHubIds}
            recenterToken={recenterToken}
            focusedWarTheaterId={focusedWarTheaterId}
            warTheaterFocusToken={warTheaterFocusToken}
            onSelectSystem={setSelectedSystemId}
            onRecenter={setCenterSystemId}
            onResetView={handleResetCenter}
            className="h-full min-h-0 rounded-none border-0"
          />

          <MapLegend
            layers={layers}
            warCount={warCount}
            campCount={overlays.campSystemIds.size}
            haulInJumps={Math.max(0, overlays.haulInRoute.length - 1)}
            haulOutJumps={Math.max(0, overlays.haulOutRoute.length - 1)}
          />
          </div>

          <MapSidebar
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          layers={layers}
          onLayersChange={setLayers}
          onRefreshWar={() => setRefreshWarToken((t) => t + 1)}
          warIntelAge={warIntelAge}
          warError={overlays.error}
          warIntelAnchor={warIntelAnchor}
          onWarIntelAnchorChange={setWarIntelAnchor}
          warIntelRadius={warIntelRadius}
          onWarIntelRadiusChange={setWarIntelRadius}
          warIntelWindow={warIntelWindow}
          onWarIntelWindowChange={setWarIntelWindow}
          factoryName={factorySystem?.name ?? null}
          buyHubName={buyHubName}
          factorySecurity={factorySystem?.security ?? null}
          opportunities={opportunities}
          selectedProductTypeId={selectedProductTypeId}
          warLoading={overlays.warLoading}
          warIntelProgress={overlays.warIntelProgress}
          noFactory={!manufacturingSystemId}
          onSelectOpportunity={handleSelectOpportunity}
          onSetSellHub={handleSetSellHub}
          selectedSystemId={selectedSystemId}
          warResults={overlays.warResults}
          warTheaters={overlays.warTheaters}
          onRecenterSystem={handleRecenterSystem}
          onFocusWarTheater={handleFocusWarTheater}
          onClearWarTheaterFocus={handleClearWarTheaterFocus}
          manufacturingSystemId={manufacturingSystemId}
        />
        </div>
      </MapOverlayContextProvider>
    </div>
  )
}
