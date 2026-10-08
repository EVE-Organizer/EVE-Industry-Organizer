import { ESI_BASE } from '@/services/auth/ssoMetadata'

const nameCache = new Map<number, string>()

/** Public ESI names for character ids that are no longer in the signed-in list. */
export async function fetchUniverseCharacterNames(ids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))]
  const result = new Map<number, string>()
  const missing: number[] = []
  for (const id of unique) {
    const cached = nameCache.get(id)
    if (cached) result.set(id, cached)
    else missing.push(id)
  }
  if (missing.length === 0) return result

  const res = await fetch(`${ESI_BASE}/universe/names/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(missing.slice(0, 1000)),
  })
  if (!res.ok) return result

  const rows = (await res.json()) as Array<{ category?: string; id?: number; name?: string }>
  for (const row of rows) {
    if (row.category !== 'character' || row.id == null || !row.name) continue
    nameCache.set(row.id, row.name)
    result.set(row.id, row.name)
  }
  return result
}
