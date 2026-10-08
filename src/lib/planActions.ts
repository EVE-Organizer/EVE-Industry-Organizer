import { snapshotFromJobs } from '@/lib/planProgress'
import { settingsWithOwnerTimeSkills } from '@/lib/planCharacters'
import { allocateStartStock } from '@/lib/planStock'
import {
  applyNodeOverridePatch,
  applyRootEntryPatch,
  descendantProductIds,
  fitPlanForOverallDeadlines,
  inGameDurationHoursFromRuns,
  overallDeadlineTargets,
  resolveRunsFromPatch,
} from '@/lib/rootRunsDuration'
import { readyHoursByProductId as readyHoursByProductIdFromJobs } from '@/pages/Plan/planScheduler'
import type {
  BlueprintInfo,
  GlobalSettings,
  HubId,
  ManufacturingPlanTemplate,
  PlanBuildMode,
  PlanCharacterKey,
  PlanDurationMode,
  PlanNode,
  PlanNodeOverride,
  PlanRootEntry,
  PlanStepStatus,
  ScheduledPlanJob,
  SkillLevels,
} from '@/types'
import { getBlueprintForProduct } from '@/services/data/sdeLoader'

type TemplatePatch = Partial<ManufacturingPlanTemplate>

function withOverride(
  template: ManufacturingPlanTemplate,
  productTypeId: number,
  patch: PlanNodeOverride,
): Record<number, PlanNodeOverride> {
  return {
    ...template.nodeOverrides,
    [productTypeId]: { ...template.nodeOverrides[productTypeId], ...patch },
  }
}

/** Pin a root (and its chain) to a character, or back to Auto with `undefined`. */
export function setRootOwner(
  template: ManufacturingPlanTemplate,
  rootId: string,
  key: PlanCharacterKey | undefined,
): TemplatePatch {
  return { roots: template.roots.map((r) => (r.id === rootId ? { ...r, characterKey: key } : r)) }
}

/** Pin one component to a character. This beats the owner of the root it feeds. */
export function setNodeOwner(
  template: ManufacturingPlanTemplate,
  productTypeId: number,
  key: PlanCharacterKey | undefined,
): TemplatePatch {
  return { nodeOverrides: withOverride(template, productTypeId, { characterKey: key }) }
}

type OwnerRunSyncSkillSources = {
  sso: Array<{
    characterId: number
    characterName: string
    skills?: SkillLevels
    trainedSkills?: SkillLevels
  }>
  manual: Array<{ id: string; name: string; skills: SkillLevels }>
}

export function settingsForProductOwner(
  settings: GlobalSettings,
  productTypeId: number,
  ownerByProduct: Map<number, PlanCharacterKey | 'auto'>,
  skillSources: OwnerRunSyncSkillSources,
): GlobalSettings {
  const owner = ownerByProduct.get(productTypeId)
  if (owner && owner !== 'auto') {
    return settingsWithOwnerTimeSkills(settings, owner, skillSources)
  }
  return settings
}

/** Re-sync every stored production timer using each node's pinned owner skills. */
export function syncAllPlanRunsFromStoredDuration(
  template: ManufacturingPlanTemplate,
  planNodes: Array<Pick<PlanNode, 'productTypeId' | 'mode' | 'isRoot' | 'childProductTypeIds'>>,
  blueprints: BlueprintInfo[],
  settings: GlobalSettings,
  skillSources: OwnerRunSyncSkillSources,
  ownerByProduct: Map<number, PlanCharacterKey | 'auto'>,
): TemplatePatch {
  return syncPlanRunsAfterOwnerChange(
    template,
    planNodes,
    blueprints,
    settings,
    skillSources,
    ownerByProduct,
    { productTypeId: template.roots[0]?.productTypeId ?? 0 },
    'overall',
  )
}

/** Keep stored job timers; re-derive runs when the owner's time skills change. */
export function syncPlanRunsAfterOwnerChange(
  template: ManufacturingPlanTemplate,
  planNodes: Array<Pick<PlanNode, 'productTypeId' | 'mode' | 'isRoot' | 'childProductTypeIds'>>,
  blueprints: BlueprintInfo[],
  settings: GlobalSettings,
  skillSources: OwnerRunSyncSkillSources,
  ownerByProduct: Map<number, PlanCharacterKey | 'auto'>,
  scope: { rootId?: string; productTypeId: number },
  durationMode?: PlanDurationMode,
): TemplatePatch {
  const getBlueprint = (productTypeId: number) => getBlueprintForProduct(blueprints, productTypeId)

  const nodeOverrides = { ...template.nodeOverrides }

  const resyncNodeDuration = (productTypeId: number) => {
    const override = nodeOverrides[productTypeId]
    const hours = override?.productionDurationHours
    if (hours == null || hours <= 0) return
    const bp = getBlueprint(productTypeId)
    nodeOverrides[productTypeId] = applyNodeOverridePatch(
      override,
      { productionDurationHours: hours },
      bp,
      settingsForProductOwner(settings, productTypeId, ownerByProduct, skillSources),
    )
  }

  // Overall only shrinks to the deadline, so restore duration-derived runs first
  // (same as switching Production then Overall). Production only touches the edited job.
  const resyncRootFromDuration = (root: PlanRootEntry): PlanRootEntry => {
    if (root.productionDurationHours <= 0) return root
    return applyRootEntryPatch(
      root,
      { productionDurationHours: root.productionDurationHours },
      getBlueprint(root.productTypeId),
      settingsForProductOwner(settings, root.productTypeId, ownerByProduct, skillSources),
      nodeOverrides[root.productTypeId],
    )
  }

  let roots = template.roots
  if (durationMode === 'overall') {
    roots = roots.map(resyncRootFromDuration)
    for (const node of planNodes) {
      if (node.isRoot || node.mode !== 'build') continue
      resyncNodeDuration(node.productTypeId)
    }
  } else if (scope.rootId) {
    roots = roots.map((r) => (r.id === scope.rootId ? resyncRootFromDuration(r) : r))
    const rootEntry = template.roots.find((r) => r.id === scope.rootId)
    if (rootEntry) {
      for (const productTypeId of descendantProductIds(rootEntry.productTypeId, planNodes)) {
        resyncNodeDuration(productTypeId)
      }
    }
  } else {
    resyncNodeDuration(scope.productTypeId)
  }

  return { roots, nodeOverrides }
}

/** Refit Overall runs against a schedule built with the updated owner assignment. */
export function fitOverallPlanToProductionSchedule(
  template: ManufacturingPlanTemplate,
  productionJobs: ScheduledPlanJob[],
  planNodes: Array<Pick<PlanNode, 'productTypeId' | 'childProductTypeIds' | 'isRoot' | 'mode'>>,
  blueprints: BlueprintInfo[],
  settings: GlobalSettings,
): TemplatePatch {
  const targets = overallDeadlineTargets(template.roots)
  if (targets.length === 0) return {}
  return fitPlanForOverallDeadlines({
    roots: template.roots,
    nodeOverrides: template.nodeOverrides,
    targets,
    readyHoursByProductId: readyHoursByProductIdFromJobs(productionJobs),
    nodes: planNodes,
    settings,
    getBlueprint: (productTypeId) => getBlueprintForProduct(blueprints, productTypeId),
  })
}

export function setSellerCharacterKey(
  template: ManufacturingPlanTemplate,
  key: PlanCharacterKey | undefined,
): TemplatePatch {
  return { sellerCharacterKey: key }
}

/** Buy/sell hubs for this plan. Missing fields follow navbar settings. */
export function resolvePlanMarketHubs(
  template: Pick<ManufacturingPlanTemplate, 'buyHub' | 'sellHub'> | null | undefined,
  settings: Pick<GlobalSettings, 'primaryHub' | 'sellHubId'>,
): { buyHub: HubId; sellHub: HubId } {
  const buyHub = template?.buyHub ?? settings.primaryHub
  const sellHub = template?.sellHub ?? settings.sellHubId ?? buyHub
  return { buyHub, sellHub }
}

export function setPlanBuyHub(
  _template: ManufacturingPlanTemplate,
  hub: HubId | undefined,
): TemplatePatch {
  return { buyHub: hub }
}

export function setPlanSellHub(
  _template: ManufacturingPlanTemplate,
  hub: HubId | undefined,
): TemplatePatch {
  return { sellHub: hub }
}

export function setNodeCopies(
  template: ManufacturingPlanTemplate,
  productTypeId: number,
  copies: number,
): TemplatePatch {
  return { nodeOverrides: withOverride(template, productTypeId, { copies: Math.max(1, copies) }) }
}

/** T2 options for one product: skip research when BPCs are owned, or copy with several T1 BPOs. */
export function setT2Options(
  template: ManufacturingPlanTemplate,
  productTypeId: number,
  patch: { haveBpcs?: boolean; copyBpos?: number },
): TemplatePatch {
  const copyBpos = patch.copyBpos == null ? undefined : Math.max(1, Math.round(patch.copyBpos))
  return {
    nodeOverrides: withOverride(template, productTypeId, {
      ...patch,
      ...(copyBpos == null ? {} : { copyBpos }),
    }),
  }
}

/** Flip build/buy for one chain item. Uses the mode shown in the table, not stale overrides. */
export function togglePlanBuildMode(
  template: ManufacturingPlanTemplate,
  node: Pick<PlanNode, 'productTypeId' | 'mode'>,
): TemplatePatch {
  const next: PlanBuildMode = node.mode === 'build' ? 'buy' : 'build'
  return {
    modeOverrides: {
      ...template.modeOverrides,
      [node.productTypeId]: next,
    },
  }
}

export function setReadyBy(
  template: ManufacturingPlanTemplate,
  rootId: string,
  hours: number | undefined,
): TemplatePatch {
  const target = template.roots.find((r) => r.id === rootId)
  if (!target) return {}
  return {
    roots: template.roots.map((r) =>
      r.productTypeId === target.productTypeId ? { ...r, readyByHours: hours } : r,
    ),
  }
}

/** Same deadline on every root. Used by Set all when the jobs table is in Ready by mode. */
export function setAllReadyBy(
  template: ManufacturingPlanTemplate,
  hours: number | undefined,
): TemplatePatch {
  return { roots: template.roots.map((r) => ({ ...r, readyByHours: hours })) }
}

/**
 * Set every job's timer to `hours` and recompute runs. Does not change Ready by deadlines.
 * A manual duration edit clears the Ready-by runs highlight.
 */
export function syncPlanRunsFromProductionHours(
  template: ManufacturingPlanTemplate,
  planNodes: PlanNode[],
  hours: number,
  blueprints: BlueprintInfo[],
  settings: GlobalSettings,
): TemplatePatch {
  const patch = { productionDurationHours: hours }
  const roots = template.roots.map((r) => {
    const bp = getBlueprintForProduct(blueprints, r.productTypeId)
    const updated = applyRootEntryPatch(
      r,
      patch,
      bp,
      settings,
      template.nodeOverrides[r.productTypeId],
    )
    const { runsFromReadyBy: _drop, ...withoutFlag } = updated
    return withoutFlag
  })

  const nodeOverrides = { ...template.nodeOverrides }
  for (const node of planNodes) {
    if (node.mode !== 'build' || node.isRoot) continue
    const bp = getBlueprintForProduct(blueprints, node.productTypeId)
    const runs = resolveRunsFromPatch(
      node.runs,
      patch,
      bp,
      settings,
      nodeOverrides[node.productTypeId],
    )
    const prev = nodeOverrides[node.productTypeId] ?? {}
    const { runsFromReadyBy: _drop, ...rest } = { ...prev, runs }
    nodeOverrides[node.productTypeId] = rest
  }

  return { roots, nodeOverrides }
}

/** Apply the BPO counts the deadline search settled on. */
export function applyDeadlineCopies(
  template: ManufacturingPlanTemplate,
  copiesByProduct: Map<number, number>,
): TemplatePatch {
  const nodeOverrides = { ...template.nodeOverrides }
  for (const [productTypeId, copies] of copiesByProduct) {
    nodeOverrides[productTypeId] = { ...nodeOverrides[productTypeId], copies: Math.max(1, copies) }
  }
  return { nodeOverrides }
}

/** Remove stored component run counts so expansion follows root demand (after manual root edits or before Fix). */
export function clearChainComponentRunOverrides(
  template: ManufacturingPlanTemplate,
  chainProductTypeIds: Iterable<number>,
  rootProductTypeId: number,
): TemplatePatch {
  const nodeOverrides = { ...template.nodeOverrides }
  for (const productTypeId of chainProductTypeIds) {
    if (productTypeId === rootProductTypeId) continue
    const override = nodeOverrides[productTypeId]
    if (!override?.runs && !override?.runsFromReadyBy) continue
    const { runs: _runs, runsFromReadyBy: _flag, ...rest } = override
    if (Object.keys(rest).length === 0) delete nodeOverrides[productTypeId]
    else nodeOverrides[productTypeId] = rest
  }
  return { nodeOverrides }
}

/** Lower root runs for Ready-by Fix; drop stored component run overrides so demand re-expands. */
export function applyDeadlineRootRuns(
  template: ManufacturingPlanTemplate,
  rootId: string,
  runs: number,
  productionDurationHours: number,
  chainProductTypeIds: Iterable<number>,
): TemplatePatch {
  const rootEntry = template.roots.find((r) => r.id === rootId)
  const productTypeId = rootEntry?.productTypeId
  const roots = template.roots.map((r) =>
    productTypeId != null && r.productTypeId === productTypeId
      ? { ...r, runs, productionDurationHours, runsFromReadyBy: true }
      : r,
  )
  const nodeOverrides = { ...template.nodeOverrides }
  for (const productTypeId of chainProductTypeIds) {
    if (rootEntry?.productTypeId === productTypeId) continue
    const override = nodeOverrides[productTypeId]
    const { runs: _removed, ...rest } = override ?? {}
    nodeOverrides[productTypeId] = { ...rest, runsFromReadyBy: true }
  }
  return { roots, nodeOverrides }
}

/** Parallel root rows for one product should show the same runs after Ready-by Fix. */
export function alignDuplicateRootRuns(
  template: ManufacturingPlanTemplate,
  productTypeId: number,
  blueprint: BlueprintInfo | undefined,
  settings: GlobalSettings,
  meTeOverride?: PlanNodeOverride,
): TemplatePatch {
  const siblings = template.roots.filter((r) => r.productTypeId === productTypeId)
  if (siblings.length < 2 || !blueprint) return {}
  const runsValues = siblings.map((r) => r.runs)
  if (new Set(runsValues).size <= 1) return {}

  const unifiedRuns = Math.min(...runsValues)
  const productionDurationHours = inGameDurationHoursFromRuns(
    blueprint,
    settings,
    unifiedRuns,
    meTeOverride,
  )
  return {
    roots: template.roots.map((r) =>
      r.productTypeId === productTypeId
        ? { ...r, runs: unifiedRuns, productionDurationHours, runsFromReadyBy: true }
        : r,
    ),
  }
}

export function addPlanCharacter(
  template: ManufacturingPlanTemplate,
  key: PlanCharacterKey,
): TemplatePatch {
  const current = template.characters ?? []
  return current.includes(key) ? {} : { characters: [...current, key] }
}

/** Keep a real character name on the plan so a missing session does not fall back to "Character {id}". */
export function mergePlanCharacterNames(
  template: Pick<ManufacturingPlanTemplate, 'characterNames'>,
  updates: Record<string, string>,
): TemplatePatch {
  const next = { ...template.characterNames }
  let changed = false
  for (const [key, name] of Object.entries(updates)) {
    const trimmed = name.trim()
    if (!trimmed || /^Character \d+$/.test(trimmed)) continue
    if (next[key] === trimmed) continue
    next[key] = trimmed
    changed = true
  }
  return changed ? { characterNames: next } : {}
}

/**
 * Drop crew members who no longer own a root or component.
 * Characters are added when an owner is picked, so an unpinned entry is a previous owner.
 */
export function pruneUnpinnedPlanCharacters(template: ManufacturingPlanTemplate): TemplatePatch {
  const pinned = new Set<PlanCharacterKey>()
  for (const root of template.roots) {
    if (root.characterKey) pinned.add(root.characterKey)
  }
  for (const override of Object.values(template.nodeOverrides)) {
    if (override?.characterKey) pinned.add(override.characterKey)
  }
  const current = template.characters ?? []
  const next = current.filter((key) => pinned.has(key))
  if (next.length === current.length) return {}
  return { characters: next }
}

/**
 * Remove a character from the manufacturing crew once nothing is pinned to them.
 * Seller selection is separate and stays put.
 */
export function dropUnpinnedPlanCharacter(
  template: ManufacturingPlanTemplate,
  key: PlanCharacterKey,
): TemplatePatch {
  const stillPinned =
    template.roots.some((root) => root.characterKey === key) ||
    Object.values(template.nodeOverrides).some((override) => override?.characterKey === key)
  if (stillPinned) return {}
  if (!(template.characters ?? []).includes(key)) return {}
  return { characters: (template.characters ?? []).filter((k) => k !== key) }
}

/** Drop a character and release every pin that pointed at them, so no job is orphaned. */
export function removePlanCharacter(
  template: ManufacturingPlanTemplate,
  key: PlanCharacterKey,
): TemplatePatch {
  const nodeOverrides: Record<number, PlanNodeOverride> = {}
  for (const [id, override] of Object.entries(template.nodeOverrides)) {
    nodeOverrides[Number(id)] =
      override.characterKey === key ? { ...override, characterKey: undefined } : override
  }
  return {
    characters: (template.characters ?? []).filter((k) => k !== key),
    roots: template.roots.map((r) =>
      r.characterKey === key ? { ...r, characterKey: undefined } : r,
    ),
    nodeOverrides,
    sellerCharacterKey:
      template.sellerCharacterKey === key ? undefined : template.sellerCharacterKey,
  }
}

/** Mark a step by hand. Manual beats ESI and stock; `undefined` hands the step back to them. */
export function setStepStatus(
  template: ManufacturingPlanTemplate,
  stepKey: string,
  status: PlanStepStatus | undefined,
  characterKey?: PlanCharacterKey,
): TemplatePatch {
  const stepProgress = { ...template.stepProgress }
  if (status) stepProgress[stepKey] = { status, source: 'manual', characterKey }
  else delete stepProgress[stepKey]
  return { stepProgress }
}

/** Freeze the job split and the stock at this moment. Progress starts empty. */
export function startPlanPatch(input: {
  jobs: ScheduledPlanJob[]
  nodes: PlanNode[]
  pooledStock: Map<number, number>
  now?: Date
}): TemplatePatch {
  return {
    startedAt: (input.now ?? new Date()).toISOString(),
    stepSnapshot: snapshotFromJobs(input.jobs),
    stepProgress: {},
    startStock: Object.fromEntries(input.pooledStock),
    stockAllocated: allocateStartStock(input.nodes, input.pooledStock),
  }
}

export function resetPlanPatch(): TemplatePatch {
  return {
    startedAt: undefined,
    stepSnapshot: undefined,
    stepProgress: undefined,
    startStock: undefined,
    stockAllocated: undefined,
  }
}
