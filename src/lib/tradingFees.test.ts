import { describe, expect, it } from 'vitest'
import { brokerFeePercent, salesTaxPercent, tradingFeeRates } from '@/lib/tradingFees'

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

  it('clamps skill levels to 0–5', () => {
    expect(tradingFeeRates(99, -2)).toEqual(tradingFeeRates(5, 0))
  })
})
