export const GLOBAL_SETTING_TOOLTIPS = {
  primaryHub:
    'Main trade hub for market prices and sell-side calculations. Material buys and sell orders are priced against this hub unless overridden per blueprint.',
  meDefault:
    'Assumed Material Efficiency (0-10) for blueprints you have not configured yet. Each BPO has its own ME in-game. Set per-blueprint ME on the blueprint detail page or in your character’s owned BPO list.',
  teDefault:
    'Assumed Time Efficiency (0-20) for job time estimates when a blueprint’s TE is unknown. Each TE point cuts job time by 1% (TE 20 = −20%). Each BPO has its own TE in-game. This global value is a starting default only.',
  priceMethod:
    'How manufactured output is priced at the hub. Sell orders use window average or current sell listings (includes broker fee). Buy orders use the best buy order for an instant sale (no broker fee, lower price). Material costs always use sell-side prices.',
  includeBlueprintCost:
    'Include the blueprint cost in profit and budget. T1 spreads the BPO purchase plus research over a category-specific lifetime; T2 charges the full invention cost (datacores divided by success chance) every batch. Charges (ammo, scripts) are excluded. Turn off to compare operating profit only.',
  blueprintLifetimeRunsByCategory:
    'Assumed manufacturing runs per BPO over its useful life, by product type. Purchase price and research are divided by this number. Charges are excluded entirely. Does not affect T2.',
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
