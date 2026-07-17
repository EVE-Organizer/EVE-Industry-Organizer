import { useLocation, useSearchParams } from 'react-router-dom'
import { HUBS, type HubId } from '@/types'
import { useAppStore } from '@/stores/appStore'

export function NavbarHubSelect() {
  const hub = useAppStore((s) => s.userData.settings.primaryHub)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  function setHub(nextHub: HubId) {
    const hubConfig = HUBS.find((h) => h.id === nextHub)
    updateSettings({
      primaryHub: nextHub,
      ...(hubConfig ? { manufacturingSystemId: hubConfig.buildSystemId } : {}),
    })

    if (location.pathname === '/') {
      const params = new URLSearchParams(searchParams)
      params.set('hub', nextHub)
      if (hubConfig) params.set('mfgSystem', String(hubConfig.buildSystemId))
      setSearchParams(params, { replace: true })
    }
  }

  return (
    <label className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs opacity-60 hidden lg:inline">Hub</span>
      <select
        className="select select-bordered select-xs min-w-[5.5rem]"
        value={hub}
        onChange={(e) => setHub(e.target.value as HubId)}
        aria-label="Trade hub"
      >
        {HUBS.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </label>
  )
}
