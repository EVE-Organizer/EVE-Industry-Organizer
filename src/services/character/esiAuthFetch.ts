import { cacheKey, getCached, setCached, TTL } from '@/services/cache/cacheStore'
import { ESI_BASE } from '@/services/auth/ssoMetadata'
import { dedupe, esiPaused, noteEsiResponse, throttle } from '@/services/market/requestQueue'

export class EsiAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'EsiAuthError'
  }
}

export interface EsiFetchOptions<T = unknown> {
  cacheKey?: string
  skipCache?: boolean
  /** Bypass localStorage and fetch from ESI (manual refresh). */
  forceRefresh?: boolean
  /** On 403, cache and return this value instead of throwing (stops error-limit burn). */
  forbiddenFallback?: T
}

function isRateLimited(status: number): boolean {
  return status === 420 || status === 429
}

async function parseEsiResponse<T>(
  res: Response,
  options?: Pick<EsiFetchOptions<T>, 'forbiddenFallback'>,
  cacheKeyForForbidden?: string,
): Promise<T> {
  noteEsiResponse(res)

  if (res.status === 401) throw new EsiAuthError('Session expired. Sign in again.', 401)
  if (res.status === 403) {
    if (options?.forbiddenFallback !== undefined && cacheKeyForForbidden) {
      setCached(
        cacheKeyForForbidden,
        options.forbiddenFallback,
        'esi-auth',
        TTL.failed.fresh,
        TTL.failed.stale,
      )
      return options.forbiddenFallback
    }
    throw new EsiAuthError('Missing permission for this data.', 403)
  }
  if (!res.ok) throw new EsiAuthError(`ESI request failed (${res.status})`, res.status)
  return (await res.json()) as T
}

async function fetchAndCache<T>(
  url: string,
  accessToken: string,
  key: string,
  options?: EsiFetchOptions<T>,
  ttl = TTL.characterData,
): Promise<T> {
  if (esiPaused()) {
    const cached = getCached<T>(key)
    if (cached) return cached.data
  }

  await throttle()
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await parseEsiResponse<T>(res, options, key)
  if (res.status !== 403) {
    setCached(key, data, 'esi-auth', ttl.fresh, ttl.stale)
  }
  return data
}

export async function esiAuthGet<T>(
  path: string,
  accessToken: string,
  options?: EsiFetchOptions<T>,
): Promise<T> {
  const url = path.startsWith('http') ? path : `${ESI_BASE}${path}`
  const key = options?.cacheKey ?? cacheKey('esi-auth', path, {})
  const cached = !options?.skipCache ? getCached<T>(key) : null

  if (!options?.skipCache && cached && !options?.forceRefresh) {
    return cached.data
  }

  if (esiPaused() && cached) {
    return cached.data
  }

  return dedupe(key, async () => {
    try {
      return await fetchAndCache<T>(url, accessToken, key, options)
    } catch (err) {
      if (cached && (options?.forceRefresh || (err instanceof EsiAuthError && isRateLimited(err.status)))) {
        return cached.data
      }
      throw err
    }
  })
}

function getCachedPages<T>(cacheSegment: string): T[][] | null {
  const pages: T[][] = []
  let page = 1
  while (true) {
    const pageKey = cacheKey('esi-auth', cacheSegment, { page })
    const cached = getCached<T[]>(pageKey)
    if (!cached) break
    pages.push(cached.data)
    if (cached.data.length === 0) break
    page += 1
  }
  return pages.length > 0 ? pages : null
}

function pageMetaKey(cacheSegment: string): string {
  return cacheKey('esi-auth', cacheSegment, { meta: 'pages' })
}

function isPageCacheComplete<T>(cacheSegment: string, pages: T[][]): boolean {
  const meta = getCached<{ totalPages: number }>(pageMetaKey(cacheSegment))
  if (meta) return pages.length >= meta.data.totalPages

  const last = pages[pages.length - 1]!
  if (last.length === 0) return pages.length > 1
  return last.length < 1000
}

async function fetchPage<T>(
  path: string,
  accessToken: string,
  key: string,
  cacheSegment?: string,
  options?: EsiFetchOptions<T[]>,
): Promise<{ data: T[]; totalPages: number }> {
  if (esiPaused()) {
    const cached = getCached<T[]>(key)
    if (cached) return { data: cached.data, totalPages: 1 }
  }

  await throttle()
  const url = `${ESI_BASE}${path}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  noteEsiResponse(res)
  const total = Number(res.headers.get('X-Pages') ?? '1')
  const totalPages = Number.isFinite(total) && total > 0 ? total : 1
  const data = await parseEsiResponse<T[]>(res, options, key)
  if (res.status !== 403) {
    setCached(key, data, 'esi-auth', TTL.characterData.fresh, TTL.characterData.stale)
    if (cacheSegment) {
      setCached(
        pageMetaKey(cacheSegment),
        { totalPages },
        'esi-auth',
        TTL.characterData.fresh,
        TTL.characterData.stale,
      )
    }
  }
  return { data, totalPages }
}

export async function esiAuthGetAllPages<T>(
  basePath: string,
  accessToken: string,
  cacheSegment: string,
  options?: EsiFetchOptions<T[]>,
): Promise<T[]> {
  if (!options?.skipCache && !options?.forceRefresh) {
    const cachedPages = getCachedPages<T>(cacheSegment)
    if (cachedPages && isPageCacheComplete(cacheSegment, cachedPages)) {
      return cachedPages.flat()
    }
  }

  if (esiPaused()) {
    const cachedPages = getCachedPages<T>(cacheSegment)
    if (cachedPages) return cachedPages.flat()
  }

  const results: T[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const separator = basePath.includes('?') ? '&' : '?'
    const path = `${basePath}${separator}page=${page}`
    const key = cacheKey('esi-auth', cacheSegment, { page })

    const cached = !options?.skipCache && !options?.forceRefresh ? getCached<T[]>(key) : null
    let pageData: T[]

    if (cached && !options?.forceRefresh) {
      pageData = cached.data
      const meta = getCached<{ totalPages: number }>(pageMetaKey(cacheSegment))
      if (meta) totalPages = meta.data.totalPages
    } else {
      try {
        pageData = await dedupe(key, async () => {
          const result = await fetchPage<T>(path, accessToken, key, cacheSegment, options)
          totalPages = result.totalPages
          return result.data
        })
      } catch (err) {
        if (cached) {
          pageData = cached.data
        } else if (err instanceof EsiAuthError && isRateLimited(err.status)) {
          const fallback = getCachedPages<T>(cacheSegment)
          if (fallback) return fallback.flat()
          throw err
        } else {
          throw err
        }
      }
    }

    results.push(...pageData)
    page += 1
    if (pageData.length === 0) break
  }

  return results
}

export async function esiPublicGet<T>(
  path: string,
  options?: { cacheKey?: string; forceRefresh?: boolean; notFoundValue?: T | null },
): Promise<T | null> {
  const url = path.startsWith('http') ? path : `${ESI_BASE}${path}`
  const key = options?.cacheKey ?? cacheKey('esi-public', path, {})
  const notFound = options?.notFoundValue ?? null
  const cached = getCached<T>(key)

  if (cached && !options?.forceRefresh) {
    return cached.data
  }

  if (esiPaused() && cached) {
    return cached.data
  }

  return dedupe(key, async () => {
    try {
      await throttle()
      const res = await fetch(url)
      noteEsiResponse(res)
      if (res.status === 404) return notFound
      if (!res.ok) {
        if (cached) return cached.data
        return notFound
      }
      const data = (await res.json()) as T
      setCached(key, data, 'esi-public', TTL.universeLocation.fresh, TTL.universeLocation.stale)
      return data
    } catch {
      return cached?.data ?? notFound
    }
  })
}
