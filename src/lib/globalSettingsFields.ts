export const GLOBAL_SETTING_TOOLTIPS = {
  primaryHub:
    'Main trade hub for market prices and sell-side calculations. Material buys and sell orders are priced against this hub unless overridden per blueprint.',
  meDefault:
    'Assumed Material Efficiency (0-10) for blueprints you have not configured yet. Each BPO has its own ME in-game. Set per-blueprint ME on the blueprint detail page or in your character’s owned BPO list.',
  teDefault:
    'Assumed Time Efficiency (0-20) for job time estimates when a blueprint’s TE is unknown. Each BPO has its own TE in-game. This global value is a starting default only.',
  batchSize:
    'Default number of manufacturing runs per job used in profit and cost calculations across the app.',
  brokerFeePercent:
    'Broker fee charged when listing sell orders (before Accounting skill reductions). Default NPC rate is 1%.',
  salesTaxPercent:
    'Sales tax applied when sell orders complete (before Accounting skill reductions). Default NPC rate is 3.6%.',
  priceMethod:
    'How manufactured output is priced at the hub. Sell orders use window average or current sell listings (includes broker fee). Buy orders use the best buy order for an instant sale (no broker fee, lower price). Material costs always use sell-side prices.',
  includeBlueprintCost:
    'Include the blueprint cost in profit and budget. T1 and Faction spread the BPO purchase plus research over its lifetime; T2 charges the full invention cost (datacores divided by success chance) every batch. Turn off to compare operating profit only.',
  blueprintLifetimeRuns:
    'How many runs a T1 or Faction BPO is assumed to produce over its life. The purchase price and research fee are divided by this number, so a larger value lowers the per-batch blueprint cost. Does not affect T2.',
  inventionSkillLevel:
    'Assumed level (0-5) for your invention encryption and datacore skills. Higher levels raise the T2 success chance, which lowers the invention cost charged per run.',
  structureType:
    'Where you run manufacturing jobs. NPC stations use only the system cost index. Player structures add role bonuses for materials, job time, and installation cost, plus an owner tax.',
  structureMeBonusPercent:
    'Extra material reduction from the structure role bonus, on top of BPO ME. Raitaru is 1%, Azbel 2%, Sotiyo 3%. Match the in-game Manufacturing tooltip.',
  structureTeBonusPercent:
    'Extra job time reduction from the structure role bonus, on top of BPO TE. Raitaru is 15%, Azbel 20%, Sotiyo 25%.',
  structureJobCostBonusPercent:
    'Reduction on the industry installation fee from the structure role bonus. Raitaru is 3%, Azbel 4%, Sotiyo 5%.',
  structureTaxPercent:
    'Manufacturing tax set by the structure owner, shown in the in-game job cost modifiers. Default NPC stations have no owner tax.',
} as const
