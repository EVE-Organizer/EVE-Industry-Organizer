const inFlight = new Map<string, Promise<unknown>>()
const timestamps: number[] = []
const MAX_PER_MINUTE = 30

function throttle(): Promise<void> {
  const now = Date.now()
  while (timestamps.length && timestamps[0]! < now - 60_000) timestamps.shift()
  if (timestamps.length < MAX_PER_MINUTE) {
    timestamps.push(now)
    return Promise.resolve()
  }
  const wait = 60_000 - (now - timestamps[0]!) + 50
  return new Promise((r) => setTimeout(r, wait)).then(() => throttle())
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
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await throttle()
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return results
}

export { throttle }
