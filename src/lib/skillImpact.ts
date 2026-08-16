import {
  advancedIndustryTimeFactor,
  industryTimeFactor,
  reactionsTimeFactor,
} from '@/lib/cost'
import {
  manufacturingSlotsFromSkills,
  researchSlotsFromSkills,
} from '@/lib/manufacturingSlots'
import { skillLevel } from '@/lib/skillFields'
import {
  DEFAULT_INVENTION_BASE_CHANCE,
  inventionSuccessChance,
} from '@/lib/skillTraining'
import { brokerFeePercent, salesTaxPercent } from '@/lib/tradingFees'
import type { SkillLevels } from '@/types'

export interface SkillImpactSummary {
  manufacturingSlots: number
  scienceSlots: number
  manufacturingTimeCutPercent: number
  reactionTimeCutPercent: number
  salesTaxPercent: number
  brokerFeePercent: number
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
  const reactions = skillLevel(skills, 'reactions')
  const accounting = skillLevel(skills, 'accounting')
  const broker = skillLevel(skills, 'brokerRelations')

  const mfgFactor = industryTimeFactor(industry) * advancedIndustryTimeFactor(advancedIndustry)

  return {
    manufacturingSlots: manufacturingSlotsFromSkills(skills),
    scienceSlots: researchSlotsFromSkills(skills),
    manufacturingTimeCutPercent: timeCutPercent(mfgFactor),
    reactionTimeCutPercent: timeCutPercent(reactionsTimeFactor(reactions)),
    salesTaxPercent: salesTaxPercent(accounting),
    brokerFeePercent: brokerFeePercent(broker),
    inventionChancePercent:
      inventionSuccessChance(DEFAULT_INVENTION_BASE_CHANCE, inventionSkillLevel) * 100,
  }
}
