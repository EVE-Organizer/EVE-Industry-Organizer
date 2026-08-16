import { CharacterAvatar } from '@/components/EveImage'
import { KeyIcon, LogOutIcon, PlusIcon, RefreshIcon } from '@/components/EveAuthIcons'
import type { EveCharacterSession } from '@/services/auth/authStorage'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { formatSyncedAt } from '@/lib/authDisplay'
import { useAuthStore } from '@/stores/authStore'

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
      <div className="dropdown dropdown-end">
        <button
          type="button"
          tabIndex={0}
          className="btn btn-ghost btn-sm gap-2 max-w-[11rem] px-2"
          aria-label={`Signed in as ${character.characterName}`}
        >
          <CharacterAvatar
            characterId={character.characterId}
            name={character.characterName}
            size={28}
          />
          <span className="truncate hidden lg:inline">{character.characterName}</span>
          {characters.length > 1 && (
            <span className="badge badge-xs badge-primary badge-outline hidden lg:inline">
              {characters.length}
            </span>
          )}
        </button>
        <ul
          tabIndex={0}
          className="dropdown-content menu eve-nav-auth-menu bg-base-200 border border-eve-border rounded-lg z-50 mt-2 w-64 p-0 shadow-lg"
        >
          <li className="eve-nav-auth-menu__header">
            <div className="flex items-start gap-3 px-3 py-3">
              <CharacterAvatar
                characterId={character.characterId}
                name={character.characterName}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{character.characterName}</p>
                {syncedAtLabel ? (
                  <p className="text-xs opacity-50">Synced {syncedAtLabel}</p>
                ) : (
                  <p className="text-xs opacity-50">Not synced yet</p>
                )}
              </div>
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
    <button
      type="button"
      className="btn btn-primary btn-sm shrink-0"
      disabled={isBusy}
      onClick={() => void login()}
    >
      {isBusy ? <span className="loading loading-spinner loading-xs" /> : 'Sign in with EVE'}
    </button>
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
          <span className="eve-nav-auth-menu__check shrink-0" aria-hidden>✓</span>
        ) : null}
      </button>
    </li>
  )
}
