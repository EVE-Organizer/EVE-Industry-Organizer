import { useLocation, useSearchParams } from 'react-router-dom'
import { formatHubLabel } from '@/lib/hubDisplay'
import { HUBS, type HubId } from '@/types'
import { useAppStore } from '@/stores/appStore'

export function NavbarHubSelect() {
  const buyHub = useAppStore((s) => s.userData.settings.primaryHub)
  const sellHub = useAppStore((s) => s.userData.settings.sellHubId ?? s.userData.settings.primaryHub)
  const productionLocationId = useAppStore((s) => s.userData.settings.productionLocationId)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  function setBuyHub(nextHub: HubId) {
    const hubConfig = HUBS.find((h) => h.id === nextHub)
    updateSettings({
      primaryHub: nextHub,
      ...(hubConfig && productionLocationId == null
        ? { manufacturingSystemId: hubConfig.buildSystemId }
        : {}),
    })

    if (location.pathname === '/') {
      const params = new URLSearchParams(searchParams)
      params.set('hub', nextHub)
      if (hubConfig) params.set('mfgSystem', String(hubConfig.buildSystemId))
      setSearchParams(params, { replace: true })
    }
  }

  function setSellHub(nextHub: HubId) {
    updateSettings({ sellHubId: nextHub })
  }

  return (
    <div className="navbar-hub-select-group">
      <label className="navbar-hub-select">
        <span className="navbar-hub-select__label">Buy</span>
        <select
          className="navbar-hub-select__input select select-xs"
          value={buyHub}
          onChange={(e) => setBuyHub(e.target.value as HubId)}
          aria-label="Buy from hub"
        >
          {HUBS.map((h) => (
            <option key={h.id} value={h.id}>
              {formatHubLabel(h)}
            </option>
          ))}
        </select>
      </label>
      <label className="navbar-hub-select">
        <span className="navbar-hub-select__label">Sell</span>
        <select
          className="navbar-hub-select__input select select-xs"
          value={sellHub}
          onChange={(e) => setSellHub(e.target.value as HubId)}
          aria-label="Sell to hub"
        >
          {HUBS.map((h) => (
            <option key={h.id} value={h.id}>
              {formatHubLabel(h)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
