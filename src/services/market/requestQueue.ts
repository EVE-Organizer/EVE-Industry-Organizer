const inFlight = new Map<string, Promise<unknown>>()
const esiTimestamps: number[] = []
const zkillTimestamps: number[] = []
const MAX_ESI_PER_MINUTE = 20
const MAX_ZKILL_PER_MINUTE = 40

let pauseUntil = 0

export function pauseEsiRequests(ms: number): void {
  if (ms <= 0) return
  pauseUntil = Math.max(pauseUntil, Date.now() + ms)
}

export function esiPaused(): boolean {
  return Date.now() < pauseUntil
}

/** Honor ESI rate-limit and error-limit response headers. */
export function noteEsiResponse(res: Response): void {
  if (res.status === 420 || res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '60')
    pauseEsiRequests(Number.isFinite(retryAfter) ? retryAfter * 1000 : 60_000)
    return
  }

  const remain = res.headers.get('X-ESI-Error-Limit-Remain')
  if (remain === null) return
  const remaining = Number(remain)
  if (!Number.isFinite(remaining) || remaining > 10) return

  const reset = Number(res.headers.get('X-ESI-Error-Limit-Reset') ?? '60')
  pauseEsiRequests(Number.isFinite(reset) ? reset * 1000 : 60_000)
}

function throttleBucket(timestamps: number[], maxPerMinute: number): Promise<void> {
  const now = Date.now()
  if (now < pauseUntil) {
    return new Promise((r) => setTimeout(r, pauseUntil - now + 50)).then(() =>
      throttleBucket(timestamps, maxPerMinute),
    )
  }
  while (timestamps.length && timestamps[0]! < now - 60_000) timestamps.shift()
  if (timestamps.length < maxPerMinute) {
    timestamps.push(now)
    return Promise.resolve()
  }
  const wait = 60_000 - (now - timestamps[0]!) + 50
  return new Promise((r) => setTimeout(r, wait)).then(() =>
    throttleBucket(timestamps, maxPerMinute),
  )
}

function throttle(): Promise<void> {
  return throttleBucket(esiTimestamps, MAX_ESI_PER_MINUTE)
}

function throttleZkill(): Promise<void> {
  return throttleBucket(zkillTimestamps, MAX_ZKILL_PER_MINUTE)
}

export async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key)
  if (existing) return existing as Promise<T>
  const promise = fn().finally(() => inFlight.delete(key))
  inFlight.set(key, promise)
  return promise
}

export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  processor: (item: T) => Promise<R>,
  throttleFn: () => Promise<void> = throttle,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await throttleFn()
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return results
}

export { throttle, throttleZkill }
