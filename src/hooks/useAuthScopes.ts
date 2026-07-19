import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { missingScopes, hasAllScopes } from '@/services/auth/ssoMetadata'

export function useAuthScopes(characterId?: number | null) {
  const characters = useAuthStore((s) => s.characters)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)

  return useMemo(() => {
    const id = characterId ?? activeCharacterId
    const character = characters.find((c) => c.characterId === id)
    const granted = character?.scopes ?? []
    return {
      granted,
      missing: missingScopes(granted),
      hasAll: hasAllScopes(granted),
    }
  }, [characters, activeCharacterId, characterId])
}
