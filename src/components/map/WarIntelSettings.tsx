import type { WarIntelAnchor, WarIntelProgress, WarIntelRadius, WarIntelWindow } from '@/types/map'
import { WAR_INTEL_RADIUS_OPTIONS, WAR_INTEL_WINDOW_OPTIONS, warIntelWindowLabel } from '@/types/map'
import { WarIntelLoading } from '@/components/map/WarIntelLoading'

const WINDOW_SHORT: Record<WarIntelWindow, string> = {
  '12h': '12h',
  '1d': '1d',
  '3d': '3d',
  '7d': '7d',
}

export interface WarIntelSettingsProps {
  warLoading?: boolean
  warRefreshing?: boolean
  warIntelProgress?: WarIntelProgress | null
  warIntelAge: string | null
  warError?: string | null
  warIntelAnchor: WarIntelAnchor
  onWarIntelAnchorChange: (anchor: WarIntelAnchor) => void
  warIntelRadius: WarIntelRadius
  onWarIntelRadiusChange: (radius: WarIntelRadius) => void
  warIntelWindow: WarIntelWindow
  onWarIntelWindowChange: (window: WarIntelWindow) => void
  factoryName: string | null
  onRefreshWar: () => void
}

export function WarIntelSettings({
  warLoading = false,
  warRefreshing = false,
  warIntelProgress = null,
  warIntelAge,
  warError = null,
  warIntelAnchor,
  onWarIntelAnchorChange,
  warIntelRadius,
  onWarIntelRadiusChange,
  warIntelWindow,
  onWarIntelWindowChange,
  factoryName,
  onRefreshWar,
}: WarIntelSettingsProps) {
  const settingsLocked = warLoading || warRefreshing
  const scanTarget =
    warIntelAnchor === 'factory' && factoryName
      ? factoryName
      : warIntelAnchor === 'factory'
        ? 'factory'
        : 'map center'

  return (
    <div className="flex flex-col gap-2.5 border-t border-eve-border/50 px-2.5 py-2.5">
      {warRefreshing ? (
        <WarIntelLoading
          active
          label="Updating war intel…"
          progress={warIntelProgress}
          compact
        />
      ) : warLoading ? (
        <WarIntelLoading
          active
          label="Fetching war intel…"
          progress={warIntelProgress}
          compact
        />
      ) : null}
      <div className={`map-settings-fields${settingsLocked ? ' pointer-events-none opacity-50' : ''}`}>
        <div className="map-settings-field">
          <span className="map-settings-field__label">Time window</span>
          <div className="map-settings-segmented map-settings-segmented--4" role="group" aria-label="Time window">
            {WAR_INTEL_WINDOW_OPTIONS.map((window) => (
              <button
                key={window}
                type="button"
                className={`map-settings-segmented__btn${
                  warIntelWindow === window ? ' map-settings-segmented__btn--active' : ''
                }`}
                onClick={() => onWarIntelWindowChange(window)}
                disabled={settingsLocked}
                title={warIntelWindowLabel(window)}
              >
                {WINDOW_SHORT[window]}
              </button>
            ))}
          </div>
        </div>

        <div className="map-settings-field">
          <span className="map-settings-field__label">Scan from</span>
          <div className="map-settings-segmented" role="group" aria-label="War scan anchor">
            <button
              type="button"
              className={`map-settings-segmented__btn${
                warIntelAnchor === 'factory' ? ' map-settings-segmented__btn--active' : ''
              }`}
              onClick={() => onWarIntelAnchorChange('factory')}
              disabled={settingsLocked || !factoryName}
              title={factoryName ? factoryName : 'Set a factory in app settings'}
            >
              Factory
            </button>
            <button
              type="button"
              className={`map-settings-segmented__btn${
                warIntelAnchor === 'mapCenter' ? ' map-settings-segmented__btn--active' : ''
              }`}
              onClick={() => onWarIntelAnchorChange('mapCenter')}
              disabled={settingsLocked}
              title="Map center (double-click a system to move)"
            >
              Map center
            </button>
          </div>
          {factoryName && warIntelAnchor === 'factory' ? (
            <p className="map-settings-field__hint truncate">{factoryName}</p>
          ) : null}
        </div>

        <label className="map-settings-field">
          <span className="map-settings-field__label">Radius</span>
          <select
            className="select select-xs select-bordered w-full bg-base-300/50"
            value={warIntelRadius}
            onChange={(e) => onWarIntelRadiusChange(Number(e.target.value) as WarIntelRadius)}
            disabled={settingsLocked}
          >
            {WAR_INTEL_RADIUS_OPTIONS.map((radius) => (
              <option key={radius} value={radius}>
                {radius} jumps
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        className="btn btn-xs btn-outline btn-primary w-full"
        onClick={onRefreshWar}
        disabled={settingsLocked}
      >
        {settingsLocked ? (
          <>
            <span className="loading loading-spinner loading-xs" />
            Fetching…
          </>
        ) : (
          'Refresh war intel'
        )}
      </button>
      <p className="text-center text-[10px] leading-snug text-base-content/50">
        {warError ? (
          <span className="text-error">{warError}</span>
        ) : (
          <>
            {warIntelWindowLabel(warIntelWindow)} lookback · {warIntelRadius}j from {scanTarget}
            {warIntelAge ? ` · updated ${warIntelAge}` : ''}
          </>
        )}
      </p>
    </div>
  )
}
