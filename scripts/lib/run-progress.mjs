import { Listr, SimpleRenderer } from 'listr2'
import { MARKET_HUB_IDS } from './market-data.mjs'

const VERBOSE =
  process.env.MARKET_PROGRESS_VERBOSE === '1' || process.env.MARKET_PROGRESS_VERBOSE === 'true'

/** @returns {boolean} */
export function isInteractive() {
  return Boolean(process.stdout.isTTY) && process.env.MARKET_PROGRESS_PLAIN !== '1'
}

/** @param {number} ms */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '?'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? `${h}h ${rm}m` : `${h}h`
}

/** @param {number} elapsedMs @param {number} current @param {number} total */
export function estimateEta(elapsedMs, current, total) {
  if (!current || !total || current >= total) return null
  return (elapsedMs / current) * (total - current)
}

/**
 * @param {string} label
 * @param {number | undefined} current
 * @param {number | undefined} total
 * @param {{ cached?: number, skipped?: number, eta?: number | null }} [extras]
 */
export function formatProgressTitle(label, current, total, extras = {}) {
  const parts = [label]
  if (total != null && current != null) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 100
    parts.push(`${current.toLocaleString()}/${total.toLocaleString()} (${pct}%)`)
  }
  if (extras.cached != null && extras.cached > 0) {
    parts.push(`${extras.cached.toLocaleString()} cached`)
  }
  if (extras.skipped != null && extras.skipped > 0) {
    parts.push(`${extras.skipped} skipped`)
  }
  if (extras.eta != null) {
    parts.push(`~${formatDuration(extras.eta)} left`)
  }
  return parts.join(' · ')
}

/** @param {number} ttlMs */
export function formatTtlLabel(ttlMs) {
  const hours = ttlMs / 3600000
  if (hours === 1) return '<1h'
  if (Number.isInteger(hours)) return `<${hours}h`
  return `<${hours.toFixed(1)}h`
}

function createThrottledUpdater(minMs = 500, minPct = 0.01) {
  let lastMs = 0
  let lastPct = 0
  return (current, total, fn) => {
    const pct = total > 0 ? current / total : 1
    const now = Date.now()
    if (current >= total || now - lastMs >= minMs || pct - lastPct >= minPct) {
      lastMs = now
      lastPct = pct
      fn()
    }
  }
}

/** @param {string | null | undefined} hubIds */
function resolveHubList(hubIds) {
  return hubIds?.length ? hubIds : MARKET_HUB_IDS
}

/**
 * @param {object} options
 * @param {string[] | null} [options.hubIds]
 * @param {boolean} [options.skipHistory]
 * @param {(event: object) => void} options.onEvent
 */
export function createProgressHandler({ hubIds, skipHistory = false, onEvent }) {
  const throttled = createThrottledUpdater()
  const historyStartedAt = new Map()

  return function handleProgress(event) {
    if (event.phase !== 'history') {
      onEvent(event)
    }

    if (VERBOSE && event.phase === 'history_error' && event.message) {
      console.warn(`  ${event.hubId} history skip ${event.productTypeId}: ${event.message}`)
    }

    if (!isInteractive()) {
      if (event.phase === 'hub_start') {
        console.log(`  hub ${event.hubId} (${event.hubIndex}/${event.hubCount})`)
      } else if (event.phase === 'prices_done') {
        console.log(`  ${event.hubId} · prices done`)
      } else if (event.phase === 'history_start') {
        console.log(
          `  ${event.hubId} · history: ${event.skippedFresh} cached (${formatTtlLabel(event.historyTtlMs)}), ${event.total} to fetch`,
        )
      } else if (event.phase === 'history') {
        if (event.current === event.total || event.current % 250 === 0) {
          console.log(`  ${event.hubId} · history ${event.current}/${event.total}`)
        }
      } else if (event.phase === 'history_done') {
        const suffix = event.errors ? ` · ${event.errors} skipped` : ''
        console.log(`  ${event.hubId} · history done${suffix}`)
      } else if (event.phase === 'courier_done') {
        console.log(`  ${event.hubId} · courier done`)
      } else if (event.phase === 'haul_rates_done') {
        console.log(`  haul rates aggregated (${event.routeCount} routes)`)
      } else if (event.phase === 'checkpoint') {
        console.log('  checkpoint saved')
      }
    }

    if (event.phase === 'history_start') {
      historyStartedAt.set(event.hubId, Date.now())
    }

    if (event.phase === 'history') {
      const started = historyStartedAt.get(event.hubId) ?? Date.now()
      event.eta = estimateEta(Date.now() - started, event.current, event.total)
      throttled(event.current, event.total, () => onEvent(event))
    }
  }
}

/**
 * @param {object} ctx
 * @param {object} options
 * @param {() => Promise<object>} options.runBuild
 * @param {string[] | null} [options.hubIds]
 * @param {boolean} [options.skipHistory]
 */
export function createMarketBuildTask(ctx, { runBuild, hubIds, skipHistory = false }) {
  const hubs = resolveHubList(hubIds)
  const phaseGates = new Map()
  const taskRefs = new Map()

  function gateKey(hubId, phase) {
    return `${hubId}:${phase}`
  }

  function getGate(key) {
    if (!phaseGates.has(key)) {
      let resolve
      const promise = new Promise((r) => {
        resolve = r
      })
      phaseGates.set(key, { promise, resolve })
    }
    return phaseGates.get(key)
  }

  function waitForPhase(hubId, phase) {
    return getGate(gateKey(hubId, phase)).promise
  }

  function completePhase(hubId, phase) {
    getGate(gateKey(hubId, phase)).resolve?.()
  }

  for (const hubId of hubs) {
    getGate(gateKey(hubId, 'prices'))
    if (!skipHistory) getGate(gateKey(hubId, 'history'))
    getGate(gateKey(hubId, 'courier'))
  }
  getGate(gateKey('_', 'haul_rates'))

  let haulRatesRef = null

  const hubSubtasks = hubs.flatMap((hubId) => {
    const refs = {}
    taskRefs.set(hubId, refs)

    const phases = [
      {
        phase: 'prices',
        title: `${hubId} · prices`,
        task: async (_, task) => {
          refs.prices = task
          await waitForPhase(hubId, 'prices')
        },
      },
    ]

    if (!skipHistory) {
      phases.push({
        phase: 'history',
        title: `${hubId} · history`,
        task: async (_, task) => {
          refs.history = task
          await waitForPhase(hubId, 'history')
        },
      })
    }

    phases.push({
      phase: 'courier',
      title: `${hubId} · courier contracts`,
      task: async (_, task) => {
        refs.courier = task
        await waitForPhase(hubId, 'courier')
      },
    })

    return phases.map(({ title, task }) => ({ title, task }))
  })

  const onEvent = (event) => {
    const refs = event.hubId ? taskRefs.get(event.hubId) : null

    if (event.phase === 'prices' && refs?.prices) {
      refs.prices.title = formatProgressTitle(`${event.hubId} · prices`, event.current, event.total)
    }
    if (event.phase === 'prices_done' && refs?.prices) {
      refs.prices.title = `${event.hubId} · prices · done`
      completePhase(event.hubId, 'prices')
    }
    if (event.phase === 'history_start' && refs?.history) {
      refs.history.title = formatProgressTitle(`${event.hubId} · history`, 0, event.total, {
        cached: event.skippedFresh,
      })
    }
    if (event.phase === 'history' && refs?.history) {
      refs.history.title = formatProgressTitle(`${event.hubId} · history`, event.current, event.total, {
        cached: event.skippedFresh,
        skipped: event.errors || undefined,
        eta: event.eta,
      })
    }
    if (event.phase === 'history_done' && refs?.history) {
      if (event.total === 0) {
        refs.history.title = `${event.hubId} · history · ${event.skippedFresh.toLocaleString()} cached`
      } else {
        refs.history.title = formatProgressTitle(`${event.hubId} · history`, event.total, event.total, {
          cached: event.skippedFresh,
          skipped: event.errors || undefined,
        })
      }
      completePhase(event.hubId, 'history')
    }
    if (event.phase === 'courier' && refs?.courier) {
      refs.courier.title = `${event.hubId} · courier contracts`
    }
    if (event.phase === 'courier_done' && refs?.courier) {
      refs.courier.title = `${event.hubId} · courier contracts · done`
      completePhase(event.hubId, 'courier')
    }
    if (event.phase === 'haul_rates' && haulRatesRef) {
      haulRatesRef.title = 'Aggregate haul rates'
    }
    if (event.phase === 'haul_rates_done' && haulRatesRef) {
      haulRatesRef.title = `Aggregate haul rates · ${event.routeCount} routes`
      completePhase('_', 'haul_rates')
    }
  }

  const handleProgress = createProgressHandler({ hubIds: hubs, skipHistory, onEvent })

  return {
    title: skipHistory ? 'Build market data (history skipped)' : 'Build market data',
    task: (_, task) =>
      task.newListr(
        [
          ...hubSubtasks,
          {
            title: 'Aggregate haul rates',
            task: async (_, subTask) => {
              haulRatesRef = subTask
              await waitForPhase('_', 'haul_rates')
            },
          },
          {
            title: 'Fetch market data',
            task: async () => {
              ctx.market = await runBuild(handleProgress)
            },
          },
        ],
        { concurrent: true },
      ),
  }
}

/**
 * @param {import('listr2').ListrTask[]} tasks
 * @param {{ header?: string, ctx?: object }} [options]
 */
export async function runListr(tasks, options = {}) {
  if (options.header) {
    console.log(options.header)
  }

  const ctx = options.ctx ?? {}
  const listr = new Listr(tasks, {
    concurrent: false,
    exitOnError: true,
    renderer: isInteractive() ? 'default' : SimpleRenderer,
    rendererOptions: isInteractive() ? { collapse: false } : undefined,
  })

  await listr.run(ctx)
  return ctx
}

/** @param {object} config */
export function formatMarketConfigSummary(config) {
  const lines = []
  if (config.hubIds) {
    lines.push(`hubs: ${config.hubIds.join(', ')}`)
  } else {
    lines.push(`hubs: all (${MARKET_HUB_IDS.join(', ')})`)
  }
  if (config.existingGeneratedAt) {
    lines.push(`cache: ${config.existingGeneratedAt}`)
  }
  if (config.skipHistory) {
    lines.push('history: skipped (prices + haul rates only)')
  } else if (Number.isFinite(config.historyLimit)) {
    lines.push(`history: capped at ${config.historyLimit} products per hub`)
  } else {
    lines.push(
      `history: concurrency ${config.historyConcurrency}, TTL ${config.historyTtlMs / 3600000}h`,
    )
  }
  return lines.join(' · ')
}
