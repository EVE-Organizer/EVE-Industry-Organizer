import { formatHubLabel, hubDisplayName } from '@/lib/hubDisplay'
import { HUBS, type HubId } from '@/types'

const NAVBAR_VALUE = ''

interface PlanMarketHubSelectsProps {
  buyHub?: HubId
  sellHub?: HubId
  navbarBuyHub: HubId
  navbarSellHub: HubId
  disabled?: boolean
  onBuyHubChange: (hub: HubId | undefined) => void
  onSellHubChange: (hub: HubId | undefined) => void
}

function hubFromSelect(value: string): HubId | undefined {
  if (value === NAVBAR_VALUE) return undefined
  return HUBS.some((h) => h.id === value) ? (value as HubId) : undefined
}

export function PlanMarketHubSelects({
  buyHub,
  sellHub,
  navbarBuyHub,
  navbarSellHub,
  disabled = false,
  onBuyHubChange,
  onSellHubChange,
}: PlanMarketHubSelectsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide opacity-50">Hubs</span>
        <label className="navbar-hub-select">
          <span className="navbar-hub-select__label">Buy</span>
          <select
            className="navbar-hub-select__input select select-xs"
            value={buyHub ?? NAVBAR_VALUE}
            disabled={disabled}
            aria-label="Plan buy hub"
            onChange={(e) => onBuyHubChange(hubFromSelect(e.target.value))}
          >
            <option value={NAVBAR_VALUE}>Navbar ({hubDisplayName(navbarBuyHub)})</option>
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
            value={sellHub ?? NAVBAR_VALUE}
            disabled={disabled}
            aria-label="Plan sell hub"
            onChange={(e) => onSellHubChange(hubFromSelect(e.target.value))}
          >
            <option value={NAVBAR_VALUE}>Navbar ({hubDisplayName(navbarSellHub)})</option>
            {HUBS.map((h) => (
              <option key={h.id} value={h.id}>
                {formatHubLabel(h)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs opacity-60">
        Until you pick a hub, this plan follows the navbar. A stored hub stays on this plan if the
        navbar changes.
      </p>
    </div>
  )
}
