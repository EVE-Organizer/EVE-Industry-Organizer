import type { GlobalSettings } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { getCacheStats } from '@/services/cache/cacheStore'
import { useSdeData } from '@/hooks/useSdeData'
import {
  BpoCostSettingsSection,
  CommonSettingsSection,
  ManufacturingSettingsSection,
  ReactionFacilitySection,
} from '@/components/GlobalSettingsForm'
import { SkillLevelSlider } from '@/components/SkillLevelSlider'
import { SKILL_FIELDS, enforceSkillPrerequisites, maxTrainableSkillLevel, skillLevel, skillPrerequisiteLabel, type SkillFieldDef } from '@/lib/skillFields'
import { Panel } from '@/components/Panel'
import { EveCharacterPanel } from '@/components/EveCharacterPanel'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/Layout'

const MANUFACTURING_SKILL_KEYS: SkillFieldDef['key'][] = [
  'industry',
  'advancedIndustry',
  'massProduction',
  'advancedMassProduction',
  'science',
  'laboratoryOperation',
  'advancedLaboratoryOperation',
  'reactions',
]
const MARKET_SKILL_KEYS: SkillFieldDef['key'][] = ['accounting', 'brokerRelations']

function SkillGroup({
  title,
  keys,
  settings,
  onChange,
}: {
  title: string
  keys: SkillFieldDef['key'][]
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
}) {
  const fields = SKILL_FIELDS.filter((f) => keys.includes(f.key))
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-50 mb-2">{title}</p>
      {fields.map(({ key, skillId, label, tooltip }) => {
        const maxLevel = maxTrainableSkillLevel(settings.skills, key)
        const locked = maxLevel === 0
        const current = locked ? 0 : skillLevel(settings.skills, key)
        return (
          <SkillLevelSlider
            key={key}
            skillId={skillId}
            label={label}
            tooltip={tooltip}
            value={current}
            max={maxLevel}
            disabled={locked}
            disabledReason={locked ? skillPrerequisiteLabel(key) : undefined}
            onChange={(level) => {
              const nextSkills = enforceSkillPrerequisites({
                ...settings.skills,
                [key]: Math.min(level, maxLevel),
              })
              onChange({ skills: nextSkills })
            }}
          />
        )
      })}
    </div>
  )
}

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
  const persistActiveSkillsFromSettings = useAuthStore((s) => s.persistActiveSkillsFromSettings)
  const syncSkills = useAuthStore((s) => s.syncSkills)
  const logoutCharacter = useAuthStore((s) => s.logoutCharacter)
  const logoutAll = useAuthStore((s) => s.logoutAll)
  const clearAuthError = useAuthStore((s) => s.clearError)
  const cacheStats = getCacheStats()
  const settings = userData.settings

  function handleSettingsChange(patch: Partial<GlobalSettings>) {
    updateSettings(patch)
    if (patch.skills) persistActiveSkillsFromSettings()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        subtitle="Market defaults, manufacturing, blueprint costs, and skills"
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
          <ManufacturingSettingsSection
            size="sm"
            settings={settings}
            onChange={updateSettings}
          />
        </Panel>

        <Panel title="Reaction facility">
          <p className="text-xs opacity-70 mb-3">
            Refinery for reaction formulas in plans and supply chains. Uses a separate build system
            and reaction cost index from manufacturing.
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
          Sign in with multiple characters and switch between them. Each character keeps their own
          skill levels for profit calculations.
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
          onSync={() => void syncSkills()}
          onLogoutCharacter={logoutCharacter}
          onLogoutAll={logoutAll}
          onClearError={clearAuthError}
        />
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Skills">
          <p className="text-xs opacity-70 mb-3">
            Used in profit, IPH, and ranking calculations. Does not change blueprint requirements on
            the buildable filter beyond Industry and Science.
          </p>
          <div className="flex flex-col gap-4">
            <SkillGroup
              title="Manufacturing"
              keys={MANUFACTURING_SKILL_KEYS}
              settings={settings}
              onChange={handleSettingsChange}
            />
            <SkillGroup
              title="Market"
              keys={MARKET_SKILL_KEYS}
              settings={settings}
              onChange={handleSettingsChange}
            />
          </div>
        </Panel>

        <Panel title="Other">
          <div className="flex flex-col gap-6">
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
    </div>
  )
}
