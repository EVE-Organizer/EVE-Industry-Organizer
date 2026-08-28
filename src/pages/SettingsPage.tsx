import { useAppStore } from '@/stores/appStore'
import { getCacheStats } from '@/services/cache/cacheStore'
import { useSdeData } from '@/hooks/useSdeData'
import {
  BpoCostSettingsSection,
  CommonSettingsSection,
  ManufacturingSettingsSection,
  ReactionFacilitySection,
  ScienceFacilitySection,
} from '@/components/GlobalSettingsForm'
import { Panel } from '@/components/Panel'
import { EveCharacterPanel } from '@/components/EveCharacterPanel'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/Layout'

export function SettingsPage() {
  const userData = useAppStore((s) => s.userData)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const resetAll = useAppStore((s) => s.resetAll)
  const clearPriceCache = useAppStore((s) => s.clearPriceCache)
  const { data: sde } = useSdeData()
  const configured = useAuthStore((s) => s.configured)
  const characters = useAuthStore((s) => s.characters)
  const character = useAuthStore((s) => s.character)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const authBusy = useAuthStore((s) => s.isBusy)
  const authError = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const switchCharacter = useAuthStore((s) => s.switchCharacter)
  const refreshCharacter = useAuthStore((s) => s.refreshCharacter)
  const logoutCharacter = useAuthStore((s) => s.logoutCharacter)
  const clearAuthError = useAuthStore((s) => s.clearError)
  const cacheStats = getCacheStats()
  const settings = userData.settings

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        subtitle="Market defaults, manufacturing, and blueprint costs"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Common settings">
          <p className="text-xs opacity-70 mb-3">
            Trade hub, how output is priced, and default blueprint ME/TE for items you have not
            configured yet.
          </p>
          <CommonSettingsSection
            size="sm"
            settings={settings}
            onChange={updateSettings}
          />
        </Panel>

        <Panel title="Manufacturing">
          <p className="text-xs opacity-70 mb-3">
            Engineering complex for manufacturing jobs. Hull role bonuses come from the structure
            type; enter fitted M-Set rig values separately.
          </p>
          {sde ? (
            <ManufacturingSettingsSection
              size="sm"
              settings={settings}
              onChange={updateSettings}
              systems={sde.systems}
            />
          ) : (
            <p className="text-sm opacity-60">Loading systems…</p>
          )}
        </Panel>

        <Panel title="Reaction">
          <p className="text-xs opacity-70 mb-3">
            Refinery for reaction jobs. Hull role bonuses come from the structure type; enter
            fitted rig values separately.
          </p>
          {sde ? (
            <ReactionFacilitySection
              size="sm"
              settings={settings}
              onChange={updateSettings}
              systems={sde.systems}
              regions={sde.regions}
            />
          ) : (
            <p className="text-sm opacity-60">Loading systems…</p>
          )}
        </Panel>

        <Panel title="Copy">
          <p className="text-xs opacity-70 mb-3">
            Engineering complex for copy jobs. Hull role bonuses come from the structure type;
            enter fitted rig values separately.
          </p>
          {sde ? (
            <ScienceFacilitySection
              activity="copy"
              size="sm"
              settings={settings}
              onChange={updateSettings}
              systems={sde.systems}
              regions={sde.regions}
            />
          ) : (
            <p className="text-sm opacity-60">Loading systems…</p>
          )}
        </Panel>

        <Panel title="Invention">
          <p className="text-xs opacity-70 mb-3">
            Engineering complex for invention jobs. Hull role bonuses come from the structure type;
            enter fitted rig values separately.
          </p>
          {sde ? (
            <ScienceFacilitySection
              activity="invention"
              size="sm"
              settings={settings}
              onChange={updateSettings}
              systems={sde.systems}
              regions={sde.regions}
            />
          ) : (
            <p className="text-sm opacity-60">Loading systems…</p>
          )}
        </Panel>
      </div>

      <Panel title="BPO cost">
        <p className="text-xs opacity-70 mb-3">
          T1 BPOs count as upfront capital (reusable forever). Missing hub listings fall back to
          BPC contracts or Jita. T2 invention is charged per batch.
        </p>
        <BpoCostSettingsSection
          size="sm"
          settings={settings}
          onChange={updateSettings}
        />
      </Panel>

      <Panel title="EVE characters">
        <p className="text-xs opacity-70 mb-3">
          Sign in with multiple characters and switch between them. Open the avatar menu to edit
          skills per character.
        </p>
        <EveCharacterPanel
          configured={configured}
          characters={characters}
          character={character}
          activeCharacterId={activeCharacterId}
          isAuthenticated={isAuthenticated}
          isBusy={authBusy}
          error={authError}
          onLogin={() => void login()}
          onSwitch={switchCharacter}
          onSync={() => void refreshCharacter()}
          onLogoutCharacter={logoutCharacter}
          onClearError={clearAuthError}
        />
      </Panel>

      <Panel title="Other">
        <div className="flex flex-col gap-6 max-w-md">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide opacity-50 mb-2">
              Price cache
            </p>
            <p className="text-xs opacity-70">
              {cacheStats.count} entries, about {cacheStats.sizeKb} KB stored locally.
            </p>
            <button className="btn btn-outline btn-sm mt-2" onClick={clearPriceCache}>
              Clear price cache
            </button>
          </div>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-error/80 mb-2">
              Danger zone
            </p>
            <p className="text-xs opacity-70 mb-2">
              Reset all settings and skill levels to defaults. Does not clear cached market prices.
            </p>
            <button className="btn btn-outline btn-sm btn-error" onClick={resetAll}>
              Reset to defaults
            </button>
          </div>
        </div>
      </Panel>
    </div>
  )
}
