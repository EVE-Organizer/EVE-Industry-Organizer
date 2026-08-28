import {
  advancedIndustryTimeFactor,
  industryTimeFactor,
  reactionsTimeFactor,
  scienceCopyTimeFactor,
} from '@/lib/cost'
import {
  manufacturingSlotsFromSkills,
  reactionSlotsFromSkills,
  researchSlotsFromSkills,
} from '@/lib/manufacturingSlots'
import { skillLevel } from '@/lib/skillFields'
import {
  DEFAULT_INVENTION_BASE_CHANCE,
  inventionSuccessChance,
} from '@/pages/Skills/skillTraining'
import { brokerFeePercent, relistDiscountPercent, salesTaxPercent } from '@/lib/tradingFees'
import type { SkillLevels } from '@/types'

export interface SkillImpactSummary {
  manufacturingSlots: number
  scienceSlots: number
  reactionSlots: number
  manufacturingTimeCutPercent: number
  copyTimeCutPercent: number
  reactionTimeCutPercent: number
  salesTaxPercent: number
  brokerFeePercent: number
  relistDiscountPercent: number
  inventionChancePercent: number
}

function timeCutPercent(factor: number): number {
  return Math.round((1 - factor) * 1000) / 10
}

export function computeSkillImpact(
  skills: Partial<SkillLevels> | undefined,
  inventionSkillLevel: number,
): SkillImpactSummary {
  const industry = skillLevel(skills, 'industry')
  const advancedIndustry = skillLevel(skills, 'advancedIndustry')
  const science = skillLevel(skills, 'science')
  const reactions = skillLevel(skills, 'reactions')
  const accounting = skillLevel(skills, 'accounting')
  const broker = skillLevel(skills, 'brokerRelations')
  const advancedBroker = skillLevel(skills, 'advancedBrokerRelations')

  const mfgFactor = industryTimeFactor(industry) * advancedIndustryTimeFactor(advancedIndustry)
  const copyFactor = scienceCopyTimeFactor(science) * advancedIndustryTimeFactor(advancedIndustry)

  return {
    manufacturingSlots: manufacturingSlotsFromSkills(skills),
    scienceSlots: researchSlotsFromSkills(skills),
    reactionSlots: reactionSlotsFromSkills(skills),
    manufacturingTimeCutPercent: timeCutPercent(mfgFactor),
    copyTimeCutPercent: timeCutPercent(copyFactor),
    reactionTimeCutPercent: timeCutPercent(reactionsTimeFactor(reactions)),
    salesTaxPercent: salesTaxPercent(accounting),
    brokerFeePercent: brokerFeePercent(broker),
    relistDiscountPercent: relistDiscountPercent(advancedBroker),
    inventionChancePercent:
      inventionSuccessChance(DEFAULT_INVENTION_BASE_CHANCE, inventionSkillLevel) * 100,
  }
}
