import type { BlueprintInfo, ManufacturingPlanTemplate, PlanNode, PlanRootEntry } from '@/types'

export function isPlanRootEnabled(root: PlanRootEntry): boolean {
  return root.enabled !== false
}

export function activePlanRoots(roots: PlanRootEntry[]): PlanRootEntry[] {
  return roots.filter(isPlanRootEnabled)
}

export function templateWithActiveRoots(
  template: ManufacturingPlanTemplate,
): ManufacturingPlanTemplate {
  const roots = activePlanRoots(template.roots)
  return roots.length === template.roots.length ? template : { ...template, roots }
}

/** Placeholder node so a disabled root still renders when it is not in the expanded plan. */
export function displayNodeForRoot(
  root: PlanRootEntry,
  name: string,
  blueprint: BlueprintInfo,
  existing?: PlanNode,
): PlanNode {
  if (existing) return existing
  const outputQty = root.runs * blueprint.productQuantity
  return {
    productTypeId: root.productTypeId,
    name,
    tier: blueprint.tier,
    recipeKind: blueprint.kind,
    mode: 'build',
    totalDemandQty: outputQty,
    demandByParent: [],
    parentProductTypeIds: [],
    childProductTypeIds: [],
    runs: root.runs,
    bpcCount: 1,
    concurrentCopies: 1,
    jobTimeSeconds: 0,
    outputQty,
    isRoot: true,
    isLeaf: true,
    depth: 0,
    canToggle: false,
  }
}
