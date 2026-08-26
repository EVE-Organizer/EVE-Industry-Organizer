export const GLOBAL_SETTING_TOOLTIPS = {
  primaryHub:
    'Trade hub where you buy materials and price setup costs. Haul-in runs from this hub to your manufacturing system.',
  sellHubId:
    'Trade hub where you sell finished products. Product revenue and haul-out use prices and routes to this hub.',
  meDefault:
    'Assumed Material Efficiency (0-10) for blueprints you have not configured yet. Each BPO has its own ME in-game. Set per-blueprint ME on the blueprint detail page or in your character’s owned BPO list.',
  teDefault:
    'Assumed Time Efficiency (0-20) for job time estimates when a blueprint’s TE is unknown. Each TE point cuts job time by 1% (TE 20 = −20%). Each BPO has its own TE in-game. This global value is a starting default only.',
  priceMethod:
    'How manufactured output is priced at the sell hub. Sell orders use window average or current sell listings (includes broker fee). Buy orders use the best buy order for an instant sale (no broker fee, lower price). Material costs always use sell-side prices at the buy hub.',
  priceWindow:
    'Market history window for material costs at the buy hub and (when selling via sell orders) product revenue at the sell hub. All uses current sell listings; 1d–1y use history averages. Spot fills gaps when history is missing.',
  includeHaulCost:
    'Haul in (materials from buy hub to build system) is added to setup cost; haul out (products to sell hub) is subtracted from profit. Turn off if you build and sell locally or haul on your own.',
  includeBlueprintCost:
    'Include blueprint cost in profit and budget. T1 BPOs count as upfront capital only (reusable forever). When no BPO is listed at your hub, BPC contract prices are used (Jita fallback). T2 charges full invention per batch. Charges (ammo, scripts) are excluded. Turn off to compare operating profit only.',
  inventionSkillLevel:
    'Assumed level (0-5) for your invention encryption and datacore skills. Higher levels raise the T2 success chance, which lowers the invention cost charged per run.',
  structureType:
    'Where you run manufacturing jobs. NPC stations use only the system cost index. Raitaru, Azbel, and Sotiyo add hull bonuses and fit M-Set, L-Set, or XL-Set rigs.',
  structureHullMeBonusPercent:
    'Hull role bonus for material reduction (Raitaru 1%, Azbel 2%, Sotiyo 3%). Presets are fixed; custom structures can override.',
  structureHullTeBonusPercent:
    'Hull role bonus for job time (Raitaru 15%, Azbel 20%, Sotiyo 25%). Stacks multiplicatively with rig TE.',
  structureHullJobCostBonusPercent:
    'Hull role bonus on installation fees (Raitaru 3%, Azbel 4%, Sotiyo 5%).',
  structureMeBonusPercent:
    'Custom hull material reduction when using Custom structure type.',
  structureTeBonusPercent:
    'Custom hull job time reduction when using Custom structure type.',
  structureJobCostBonusPercent:
    'Custom hull installation fee reduction when using Custom structure type.',
  manufacturingRigMeBonusPercent:
    'M-Set rig material bonus fitted on your engineering complex. Stacks multiplicatively with hull ME.',
  manufacturingRigTeBonusPercent:
    'M-Set rig time bonus on your engineering complex. Stacks multiplicatively with hull TE.',
  manufacturingRigJobCostBonusPercent:
    'Rig bonus on installation fees, if any.',
  structureTaxPercent:
    'Manufacturing tax set by the structure owner. Default NPC stations have no owner tax.',
  reactionSystemId:
    'Solar system where reaction jobs run. Drives the reaction cost index (separate from manufacturing).',
  refineryType:
    'Refinery hull for reaction jobs. Tatara gives −25% reaction time; Athanor has no hull time bonus. Rigs are entered per reaction type below.',
  refineryHullTeBonusPercent:
    'Custom refinery hull time bonus when using Custom refinery.',
  reactionRigMeBonusPercent:
    'L-Set reaction rig material bonus for this reaction type (from in-game Reaction tooltip).',
  reactionRigTeBonusPercent:
    'L-Set reaction rig time bonus for this reaction type.',
  reactionTaxPercent:
    'Owner tax for this reaction type shown in the in-game Reaction tooltip.',
} as const
