import { CharacterAvatar } from '@/components/EveImage'
import type { EveCharacterSession } from '@/services/auth/authStorage'
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
  const syncSkills = useAuthStore((s) => s.syncSkills)
  const logoutCharacter = useAuthStore((s) => s.logoutCharacter)
  const logoutAll = useAuthStore((s) => s.logoutAll)

  if (!configured) return null

  if (isAuthenticated && character) {
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
          className="dropdown-content menu bg-base-200 border border-eve-border rounded-box z-50 mt-2 w-52 p-1 shadow-lg"
        >
          {characters.length > 1 && (
            <>
              <li className="menu-title px-2 py-1 text-[10px] uppercase tracking-wide">
                Characters
              </li>
              {characters.map((c) => (
                <CharacterMenuItem
                  key={c.characterId}
                  character={c}
                  active={c.characterId === activeCharacterId}
                  disabled={isBusy}
                  onSelect={() => switchCharacter(c.characterId)}
                />
              ))}
              <div className="divider my-0 h-px" />
            </>
          )}
          <li>
            <button type="button" disabled={isBusy} onClick={() => void login()}>
              Add character
            </button>
          </li>
          <li>
            <button type="button" disabled={isBusy} onClick={() => void syncSkills()}>
              {isBusy ? 'Syncing…' : 'Sync skills'}
            </button>
          </li>
          <li>
            <button type="button" disabled={isBusy} onClick={() => logoutCharacter()}>
              Sign out {characters.length > 1 ? character.characterName : ''}
            </button>
          </li>
          {characters.length > 1 && (
            <li>
              <button type="button" disabled={isBusy} onClick={logoutAll}>
                Sign out all
              </button>
            </li>
          )}
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
        className={`flex items-center gap-2 ${active ? 'active font-medium' : ''}`}
        onClick={onSelect}
      >
        <CharacterAvatar
          characterId={character.characterId}
          name={character.characterName}
          size={24}
        />
        <span className="truncate flex-1">{character.characterName}</span>
        {active && <span className="text-[10px] opacity-60 shrink-0">active</span>}
      </button>
    </li>
  )
}
