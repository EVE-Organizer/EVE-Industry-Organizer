import type { HubId } from '@/types'
import type { MapLayers, MapOpportunityRow, WarTheater, WarIntelAnchor, WarIntelProgress, WarIntelRadius, WarIntelWindow } from '@/types/map'
import type { WarActivityResult } from '@/types/map'
import { MapLayersPanel } from '@/components/map/MapLayersPanel'
import { MapOpportunityPanel } from '@/components/map/MapOpportunityPanel'
import { MapWarPanel } from '@/components/map/MapWarPanel'

export type MapSidebarTab = 'opportunity' | 'war' | 'layers'

function sidebarTabClass(id: MapSidebarTab, active: MapSidebarTab): string {
  const base = 'map-sidebar-tabs__tab'
  if (active !== id) return base
  if (id === 'war') return `${base} map-sidebar-tabs__tab--active-war`
  if (id === 'layers') return `${base} map-sidebar-tabs__tab--active-layers`
  return `${base} map-sidebar-tabs__tab--active-opportunity`
}

interface MapSidebarProps {
  tab: MapSidebarTab
  onTabChange: (tab: MapSidebarTab) => void
  layers: MapLayers
  onLayersChange: (layers: MapLayers) => void
  onRefreshWar: () => void
  warIntelAge: string | null
  factoryName: string | null
  buyHubName: string
  factorySecurity: number | null
  opportunities: MapOpportunityRow[]
  selectedProductTypeId: number | null
  warLoading: boolean
  warIntelProgress?: WarIntelProgress | null
  warError: string | null
  warIntelAnchor: WarIntelAnchor
  onWarIntelAnchorChange: (anchor: WarIntelAnchor) => void
  warIntelRadius: WarIntelRadius
  onWarIntelRadiusChange: (radius: WarIntelRadius) => void
  warIntelWindow: WarIntelWindow
  onWarIntelWindowChange: (window: WarIntelWindow) => void
  noFactory: boolean
  onSelectOpportunity: (productTypeId: number) => void
  onSetSellHub: (hubId: HubId) => void
  selectedSystemId: number | null
  warResults: WarActivityResult[]
  warTheaters: WarTheater[]
  onRecenterSystem: (systemId: number) => void
  onFocusWarTheater: (theater: WarTheater) => void
  onClearWarTheaterFocus: () => void
  manufacturingSystemId: number
}

export function MapSidebar({
  tab,
  onTabChange,
  layers,
  onLayersChange,
  onRefreshWar,
  warIntelAge,
  factoryName,
  buyHubName,
  factorySecurity,
  opportunities,
  selectedProductTypeId,
  warLoading,
  warIntelProgress = null,
  warError,
  warIntelAnchor,
  onWarIntelAnchorChange,
  warIntelRadius,
  onWarIntelRadiusChange,
  warIntelWindow,
  onWarIntelWindowChange,
  noFactory,
  onSelectOpportunity,
  onSetSellHub,
  selectedSystemId,
  warResults,
  warTheaters,
  onRecenterSystem,
  onFocusWarTheater,
  onClearWarTheaterFocus,
  manufacturingSystemId,
}: MapSidebarProps) {
  return (
    <aside className="flex flex-col min-h-0 flex-[2] lg:flex-none lg:w-[17.5rem] xl:w-[19rem] shrink-0 border-t lg:border-t-0 lg:border-l border-eve-border bg-base-200/95 backdrop-blur overflow-hidden">
      <div className="shrink-0 p-2 border-b border-eve-border/70">
        <div className="map-sidebar-tabs" role="tablist" aria-label="Map sidebar panels">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'opportunity'}
            className={sidebarTabClass('opportunity', tab)}
            onClick={() => onTabChange('opportunity')}
          >
            Opp
            {opportunities.length > 0 ? (
              <span className="map-sidebar-tabs__count">{opportunities.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'war'}
            className={sidebarTabClass('war', tab)}
            onClick={() => onTabChange('war')}
          >
            War
            {warTheaters.length > 0 ? (
              <span className="map-sidebar-tabs__count">{warTheaters.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'layers'}
            className={sidebarTabClass('layers', tab)}
            onClick={() => onTabChange('layers')}
          >
            Layers
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2">
        {tab === 'opportunity' ? (
          <MapOpportunityPanel
            compact
            factoryName={factoryName ?? 'Not set'}
            factorySecurity={factorySecurity}
            buyHubName={buyHubName}
            rows={opportunities}
            selectedProductTypeId={selectedProductTypeId}
            warLoading={warLoading}
            noFactory={noFactory}
            onSelect={onSelectOpportunity}
            onSetSellHub={onSetSellHub}
          />
        ) : tab === 'war' ? (
          <MapWarPanel
            theaters={warTheaters}
            warResults={warResults}
            loading={warLoading}
            warIntelProgress={warIntelProgress}
            error={warError}
            selectedSystemId={selectedSystemId}
            onSelectSystem={onRecenterSystem}
            onRefresh={onRefreshWar}
            intelAge={warIntelAge}
            warIntelAnchor={warIntelAnchor}
            onWarIntelAnchorChange={onWarIntelAnchorChange}
            warIntelRadius={warIntelRadius}
            onWarIntelRadiusChange={onWarIntelRadiusChange}
            warIntelWindow={warIntelWindow}
            onWarIntelWindowChange={onWarIntelWindowChange}
            factoryName={factoryName}
            manufacturingSystemId={manufacturingSystemId}
            onFocusWarTheater={onFocusWarTheater}
            onClearWarTheaterFocus={onClearWarTheaterFocus}
          />
        ) : (
          <MapLayersPanel
            compact
            layers={layers}
            onChange={onLayersChange}
          />
        )}
      </div>
    </aside>
  )
}
