import { describe, expect, it } from 'vitest'
import type { BpcContractSummary, ContractsData } from '@/types'
import { bestBpcCostPerRun, getBpcContracts, resolveBpcCostPerRun } from '@/lib/bpcContracts'

describe('getBpcContracts', () => {
  const contracts: ContractsData = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    hubs: {
      jita: {
        byBlueprintTypeId: {
          '1234': {
            count: 1,
            minBuyout: 500_000,
            listings: [
              {
                contractId: 99,
                price: 500_000,
                buyout: 500_000,
                me: 10,
                te: 20,
                runs: 10,
                expires: '2026-07-25T00:00:00Z',
              },
            ],
          },
        },
      },
    },
  }

  it('returns listings for a known blueprint type in the hub', () => {
    const summary = getBpcContracts(contracts, 1234, 'jita')
    expect(summary?.count).toBe(1)
    expect(summary?.listings[0]?.runs).toBe(10)
  })

  it('returns null when blueprint type is missing', () => {
    expect(getBpcContracts(contracts, 9999, 'jita')).toBeNull()
  })

  it('returns null when hub slice is missing', () => {
    expect(getBpcContracts(contracts, 1234, 'amarr')).toBeNull()
  })
})

describe('bestBpcCostPerRun', () => {
  const summary: BpcContractSummary = {
    count: 3,
    minBuyout: 100_000,
    listings: [
      {
        contractId: 1,
        price: 0,
        buyout: 500_000,
        me: 10,
        te: 20,
        runs: 10,
        expires: '2026-07-25T00:00:00Z',
      },
      {
        contractId: 2,
        price: 200_000,
        buyout: 0,
        me: 5,
        te: 10,
        runs: 5,
        expires: '2026-07-25T00:00:00Z',
      },
      {
        contractId: 3,
        price: 0,
        buyout: 0,
        me: 0,
        te: 0,
        runs: 0,
        expires: '2026-07-25T00:00:00Z',
      },
    ],
  }

  it('picks the listing with lowest ISK per run', () => {
    const best = bestBpcCostPerRun(summary)
    expect(best?.contractId).toBe(2)
    expect(best?.costPerRun).toBe(40_000)
    expect(best?.buyout).toBe(200_000)
    expect(best?.runs).toBe(5)
  })

  it('returns null when no usable listings exist', () => {
    expect(bestBpcCostPerRun({ count: 0, minBuyout: 0, listings: [] })).toBeNull()
    expect(
      bestBpcCostPerRun({
        count: 1,
        minBuyout: 0,
        listings: [{ contractId: 9, price: 0, buyout: 0, me: 0, te: 0, runs: 0, expires: '' }],
      }),
    ).toBeNull()
  })
})

describe('resolveBpcCostPerRun', () => {
  const contracts: ContractsData = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    hubs: {
      amarr: {
        byBlueprintTypeId: {
          '5555': {
            count: 1,
            minBuyout: 300_000,
            listings: [
              {
                contractId: 7,
                price: 300_000,
                buyout: 300_000,
                me: 0,
                te: 0,
                runs: 3,
                expires: '2026-07-25T00:00:00Z',
              },
            ],
          },
        },
      },
    },
  }

  it('resolves per-hub BPC cost', () => {
    const resolved = resolveBpcCostPerRun(contracts, 5555, 'amarr')
    expect(resolved?.costPerRun).toBe(100_000)
  })
})
