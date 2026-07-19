import { describe, expect, it } from 'vitest'
import type { ContractsData } from '@/types'
import { getBpcContracts } from '@/lib/bpcContracts'

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
