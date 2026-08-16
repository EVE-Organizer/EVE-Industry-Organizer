import { NavLink } from 'react-router-dom'
import { CharacterAvatar } from '@/components/EveImage'
import { KeyIcon, LogOutIcon, PlusIcon, RefreshIcon } from '@/components/EveAuthIcons'
import { Tooltip, useAnchorTooltip } from '@/components/Tooltip'
import type { EveCharacterSession } from '@/services/auth/authStorage'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { formatSyncedAt } from '@/lib/authDisplay'
import { useAuthStore } from '@/stores/authStore'

/** Shown when hovering the profile block that opens /skills. */
export const SKILLS_AVATAR_TOOLTIP = 'Open skills page (plans, jobs, and training)'

function SkillsProfileSectionLink({
  characterId,
  name,
  syncedAtLabel,
}: {
  characterId: number
  name: string
  syncedAtLabel: string | null
}) {
  const { ref, triggerProps, TooltipPortal } = useAnchorTooltip('bottom')

  return (
    <>
      <NavLink
        ref={ref}
        {...triggerProps}
        to="/skills"
        className="eve-nav-auth-menu__skills-link"
        aria-label={`Open skills for ${name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <CharacterAvatar characterId={characterId} name={name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="eve-nav-auth-menu__skills-name truncate text-sm font-medium">{name}</p>
          {syncedAtLabel ? (
            <p className="text-xs opacity-50">Synced {syncedAtLabel}</p>
          ) : (
            <p className="text-xs opacity-50">Not synced yet</p>
          )}
        </div>
      </NavLink>
      <TooltipPortal content={SKILLS_AVATAR_TOOLTIP} />
    </>
  )
}

function ManualSkillsLink({ className = '' }: { className?: string }) {
  return (
    <Tooltip text={SKILLS_AVATAR_TOOLTIP} placement="bottom">
      <NavLink
        to="/skills"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-base-200/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
        aria-label="Open skills page"
      >
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-base-300 text-base-content/50 shrink-0">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              fill="currentColor"
              d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
            />
          </svg>
        </span>
        <span className="hidden sm:inline text-xs">Skills</span>
      </NavLink>
    </Tooltip>
  )
}

export function EveNavAuth() {
  const configured = useAuthStore((s) => s.configured)
  const characters = useAuthStore((s) => s.characters)
  const character = useAuthStore((s) => s.character)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isBusy = useAuthStore((s) => s.isBusy)
  const login = useAuthStore((s) => s.login)
  const switchCharacter = useAuthStore((s) => s.switchCharacter)
  const refreshCharacter = useAuthStore((s) => s.refreshCharacter)
  const logoutCharacter = useAuthStore((s) => s.logoutCharacter)
  const { missing, hasAll } = useAuthScopes()

  if (!configured) return null

  if (isAuthenticated && character) {
    const syncedAtLabel = formatSyncedAt(character.lastSyncedAt)

    return (
      <div className="dropdown dropdown-end min-w-0">
        <button
          type="button"
          tabIndex={0}
          className="btn btn-ghost btn-sm px-1.5 gap-1.5 max-w-[11rem]"
          aria-label={`Account menu for ${character.characterName}`}
        >
          <CharacterAvatar
            characterId={character.characterId}
            name={character.characterName}
            size={28}
          />
          <span className="truncate hidden lg:inline text-sm">{character.characterName}</span>
          {characters.length > 1 && (
            <span className="badge badge-xs badge-primary badge-outline hidden lg:inline">
              {characters.length}
            </span>
          )}
          <svg viewBox="0 0 20 20" className="size-3.5 opacity-60 shrink-0" aria-hidden>
            <path fill="currentColor" d="M5.5 7.5 10 12l4.5-4.5H5.5z" />
          </svg>
        </button>
        <ul
          tabIndex={0}
          className="dropdown-content menu eve-nav-auth-menu bg-base-200 border border-eve-border rounded-lg z-50 mt-2 w-64 p-0 shadow-lg"
        >
          <li className="eve-nav-auth-menu__header">
            <div className="flex items-start gap-2 px-3 py-3">
              <SkillsProfileSectionLink
                characterId={character.characterId}
                name={character.characterName}
                syncedAtLabel={syncedAtLabel}
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square shrink-0 eve-nav-auth-menu__refresh"
                disabled={isBusy}
                aria-label="Refresh character data"
                onClick={() => void refreshCharacter()}
              >
                {isBusy ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <RefreshIcon className="size-3.5" />
                )}
              </button>
            </div>
          </li>

            {characters.length > 1 ? (
              <>
                <li className="menu-title eve-nav-auth-menu__section-label">Switch character</li>
                {characters.map((c) => (
                  <CharacterMenuItem
                    key={c.characterId}
                    character={c}
                    active={c.characterId === activeCharacterId}
                    disabled={isBusy}
                    onSelect={() => switchCharacter(c.characterId)}
                  />
                ))}
                <li>
                  <button
                    type="button"
                    className="eve-nav-auth-menu__add"
                    disabled={isBusy}
                    onClick={() => void login()}
                  >
                    <PlusIcon className="size-3.5 shrink-0 opacity-60" />
                    Add character
                  </button>
                </li>
              </>
            ) : null}

            <li className="menu-title eve-nav-auth-menu__section-label">Account</li>
            {characters.length === 1 ? (
              <li>
                <button type="button" disabled={isBusy} onClick={() => void login()}>
                  <PlusIcon className="size-3.5 shrink-0 opacity-60" />
                  Add character
                </button>
              </li>
            ) : null}
            {!hasAll ? (
              <li>
                <button
                  type="button"
                  className="text-warning"
                  disabled={isBusy}
                  onClick={() => void login()}
                >
                  <KeyIcon className="size-3.5 shrink-0" />
                  Re-authorize ({missing.length} scopes)
                </button>
              </li>
            ) : null}
            <li>
              <button
                type="button"
                className="eve-nav-auth-menu__danger"
                disabled={isBusy}
                onClick={() => logoutCharacter()}
              >
                <LogOutIcon className="size-3.5 shrink-0" />
                {characters.length > 1 ? `Sign out ${character.characterName}` : 'Sign out'}
              </button>
            </li>
          </ul>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <ManualSkillsLink />
      <button
        type="button"
        className="btn btn-primary btn-sm shrink-0"
        disabled={isBusy}
        onClick={() => void login()}
      >
        {isBusy ? <span className="loading loading-spinner loading-xs" /> : 'Sign in with EVE'}
      </button>
    </div>
  )
}

function CharacterMenuItem({
  character,
  active,
  disabled,
  onSelect,
}: {
  character: EveCharacterSession
  active: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled || active}
        className={`eve-nav-auth-menu__character ${active ? 'eve-nav-auth-menu__character--active' : ''}`}
        aria-current={active ? 'true' : undefined}
        onClick={onSelect}
      >
        <CharacterAvatar
          characterId={character.characterId}
          name={character.characterName}
          size={28}
        />
        <span className="truncate flex-1">{character.characterName}</span>
        {active ? (
          <span className="eve-nav-auth-menu__check shrink-0" aria-hidden>
            ✓
          </span>
        ) : null}
      </button>
    </li>
  )
}
