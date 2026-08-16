import type { EveCharacterSession } from '@/services/auth/authStorage'
import { CharacterAvatar } from '@/components/EveImage'
import { KeyIcon, LogOutIcon, PlusIcon, RefreshIcon } from '@/components/EveAuthIcons'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { formatSyncedAt } from '@/lib/authDisplay'

export function EveCharacterPanel({
  configured,
  characters,
  character,
  activeCharacterId,
  isAuthenticated,
  isBusy,
  error,
  onLogin,
  onSwitch,
  onSync,
  onLogoutCharacter,
  onClearError,
}: {
  configured: boolean
  characters: EveCharacterSession[]
  character: EveCharacterSession | null
  activeCharacterId: number | null
  isAuthenticated: boolean
  isBusy: boolean
  error: string | null
  onLogin: () => void
  onSwitch: (characterId: number) => void
  onSync: () => void
  onLogoutCharacter: (characterId?: number) => void
  onClearError: () => void
}) {
  const { missing, hasAll } = useAuthScopes()

  if (!configured) {
    return (
      <div className="text-xs opacity-70 space-y-2">
        <p>
          EVE SSO is not configured for this deployment. Set{' '}
          <code className="font-mono text-[11px]">VITE_EVE_CLIENT_ID</code> and register the
          callback URL with your EVE developer application.
        </p>
        <p className="opacity-80">
          Callback: <code className="font-mono text-[11px] break-all">{callbackHint()}</code>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <div className="alert alert-error text-xs py-2">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={onClearError}>
            Dismiss
          </button>
        </div>
      ) : null}

      {isAuthenticated && characters.length > 0 && character ? (
        <div className="eve-character-panel">
          <div className="eve-character-panel__header">
            <CharacterAvatar
              characterId={character.characterId}
              name={character.characterName}
              size={48}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{character.characterName}</p>
              {formatSyncedAt(character.lastSyncedAt) ? (
                <p className="text-xs opacity-50">Synced {formatSyncedAt(character.lastSyncedAt)}</p>
              ) : (
                <p className="text-xs opacity-50">Not synced yet</p>
              )}
              {characters.length > 1 ? (
                <p className="mt-1 text-xs opacity-50">
                  {characters.length} characters signed in. Switching applies that character&apos;s
                  skills to profit calculations.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square eve-character-panel__refresh shrink-0"
              disabled={isBusy}
              aria-label="Refresh character data"
              onClick={onSync}
            >
              {isBusy ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <RefreshIcon className="size-4" />
              )}
            </button>
          </div>

          {characters.length > 1 ? (
            <div className="eve-character-panel__section">
              <p className="eve-character-panel__label">Switch character</p>
              <ul className="eve-character-panel__list">
                {characters.map((c) => {
                  const active = c.characterId === activeCharacterId
                  return (
                    <li key={c.characterId}>
                      <button
                        type="button"
                        disabled={isBusy || active}
                        className={`eve-character-panel__character${active ? ' eve-character-panel__character--active' : ''}`}
                        aria-current={active ? 'true' : undefined}
                        onClick={() => onSwitch(c.characterId)}
                      >
                        <CharacterAvatar
                          characterId={c.characterId}
                          name={c.characterName}
                          size={32}
                        />
                        <span className="truncate flex-1">{c.characterName}</span>
                        {active ? (
                          <span className="eve-character-panel__check shrink-0" aria-hidden>✓</span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                className="eve-character-panel__add"
                disabled={isBusy}
                onClick={onLogin}
              >
                <PlusIcon className="size-3.5 shrink-0 opacity-60" />
                Add character
              </button>
            </div>
          ) : null}

          <div className="eve-character-panel__section eve-character-panel__section--actions">
            <p className="eve-character-panel__label">Account</p>
            <ul className="eve-character-panel__list">
              {characters.length === 1 ? (
                <li>
                  <button type="button" disabled={isBusy} onClick={onLogin}>
                    <PlusIcon className="size-3.5 shrink-0 opacity-60" />
                    Add character
                  </button>
                </li>
              ) : null}
              {!hasAll ? (
                <li>
                  <button
                    type="button"
                    className="eve-character-panel__warning"
                    disabled={isBusy}
                    onClick={onLogin}
                  >
                    <KeyIcon className="size-3.5 shrink-0" />
                    Re-authorize ({missing.length} scopes)
                  </button>
                </li>
              ) : null}
              <li>
                <button
                  type="button"
                  className="eve-character-panel__danger"
                  disabled={isBusy}
                  onClick={() => onLogoutCharacter()}
                >
                  <LogOutIcon className="size-3.5 shrink-0" />
                  {characters.length > 1 ? `Sign out ${character.characterName}` : 'Sign out'}
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-xs opacity-70 flex-1">
            Sign in with one or more EVE characters to import Industry, Advanced Industry, Science,
            Accounting, and Broker Relations levels into profit calculations.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm shrink-0"
            disabled={isBusy}
            onClick={onLogin}
          >
            {isBusy ? <span className="loading loading-spinner loading-xs" /> : 'Sign in with EVE'}
          </button>
        </div>
      )}
    </div>
  )
}

function callbackHint(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  if (base === './' || base === '/') {
    if (typeof window !== 'undefined') return `${window.location.origin}/auth/callback`
    return '/auth/callback'
  }
  const path = base.endsWith('/') ? base.slice(0, -1) : base
  if (typeof window !== 'undefined') return `${window.location.origin}${path}/auth/callback`
  return `${path}/auth/callback`
}
