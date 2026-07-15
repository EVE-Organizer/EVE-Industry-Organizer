import type { EveCharacterSession } from '@/services/auth/authStorage'
import { CharacterAvatar } from '@/components/EveImage'

function formatSyncedAt(iso?: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

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
  onLogoutAll,
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
  onLogoutAll: () => void
  onClearError: () => void
}) {
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
    <div className="flex flex-col gap-4">
      {error && (
        <div className="alert alert-error text-xs py-2">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={onClearError}>
            Dismiss
          </button>
        </div>
      )}

      {isAuthenticated && characters.length > 0 ? (
        <>
          {characters.length > 1 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-medium uppercase tracking-wide opacity-50">
                Switch character
              </p>
              <div className="flex flex-col gap-1">
                {characters.map((c) => (
                  <button
                    key={c.characterId}
                    type="button"
                    disabled={isBusy || c.characterId === activeCharacterId}
                    className={`btn btn-sm justify-start gap-3 h-auto py-2 ${
                      c.characterId === activeCharacterId ? 'btn-primary' : 'btn-ghost'
                    }`}
                    onClick={() => onSwitch(c.characterId)}
                  >
                    <CharacterAvatar
                      characterId={c.characterId}
                      name={c.characterName}
                      size={32}
                    />
                    <span className="flex-1 text-left truncate">{c.characterName}</span>
                    {c.characterId === activeCharacterId && (
                      <span className="text-[10px] opacity-80 shrink-0">Active</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {character && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <CharacterAvatar
                characterId={character.characterId}
                name={character.characterName}
                size={56}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{character.characterName}</p>
                {formatSyncedAt(character.lastSyncedAt) && (
                  <p className="text-xs opacity-60">
                    Skills synced {formatSyncedAt(character.lastSyncedAt)}
                  </p>
                )}
                {characters.length > 1 && (
                  <p className="text-xs opacity-50 mt-1">
                    {characters.length} characters signed in. Switching applies that character&apos;s
                    skills to profit calculations.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={isBusy}
                  onClick={onLogin}
                >
                  Add character
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={isBusy}
                  onClick={onSync}
                >
                  {isBusy ? <span className="loading loading-spinner loading-xs" /> : 'Sync skills'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={isBusy}
                  onClick={() => onLogoutCharacter()}
                >
                  Sign out
                </button>
                {characters.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-error"
                    disabled={isBusy}
                    onClick={onLogoutAll}
                  >
                    Sign out all
                  </button>
                )}
              </div>
            </div>
          )}
        </>
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
