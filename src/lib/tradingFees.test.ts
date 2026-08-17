import { describe, expect, it } from 'vitest'
import { brokerFeePercent, relistDiscountPercent, salesTaxPercent, tradingFeeRates } from '@/lib/tradingFees'

describe('tradingFeeRates', () => {
  it('uses NPC base rates at skill 0', () => {
    expect(tradingFeeRates(0, 0)).toEqual({
      brokerFeePercent: 3,
      salesTaxPercent: 7.5,
    })
  })

  it('reduces broker fee by 0.3% per Broker Relations level', () => {
    expect(brokerFeePercent(5)).toBe(1.5)
  })

  it('reduces sales tax multiplicatively per Accounting level', () => {
    expect(salesTaxPercent(5)).toBeCloseTo(3.375, 3)
  })

  it('increases relist discount by 5 percentage points per Advanced Broker Relations level', () => {
    expect(relistDiscountPercent(0)).toBe(50)
    expect(relistDiscountPercent(5)).toBe(75)
  })

  it('clamps skill levels to 0–5', () => {
    expect(tradingFeeRates(99, -2)).toEqual(tradingFeeRates(5, 0))
  })
})
