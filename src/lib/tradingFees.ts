/** NPC station base broker fee before Broker Relations (CCP support article). */
export const NPC_BASE_BROKER_FEE_PERCENT = 3

/** Base sales tax before Accounting (Tranquility). */
export const NPC_BASE_SALES_TAX_PERCENT = 7.5

/** Broker Relations: −0.3 percentage points per level. */
export const BROKER_RELATIONS_REDUCTION_PER_LEVEL = 0.3

/** Accounting: multiplicative −11% of base tax per level. */
export const ACCOUNTING_REDUCTION_FACTOR_PER_LEVEL = 0.11

export interface TradingFeeRates {
  brokerFeePercent: number
  salesTaxPercent: number
}

function clampSkillLevel(level: number): number {
  return Math.min(5, Math.max(0, level))
}

export function brokerFeePercent(brokerRelations: number): number {
  const level = clampSkillLevel(brokerRelations)
  return Math.max(0, NPC_BASE_BROKER_FEE_PERCENT - BROKER_RELATIONS_REDUCTION_PER_LEVEL * level)
}

export function salesTaxPercent(accounting: number): number {
  const level = clampSkillLevel(accounting)
  return NPC_BASE_SALES_TAX_PERCENT * (1 - ACCOUNTING_REDUCTION_FACTOR_PER_LEVEL * level)
}

export function tradingFeeRates(accounting: number, brokerRelations: number): TradingFeeRates {
  return {
    brokerFeePercent: brokerFeePercent(brokerRelations),
    salesTaxPercent: salesTaxPercent(accounting),
  }
}
