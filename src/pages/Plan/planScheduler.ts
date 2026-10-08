import type {
  PlanCharacterKey,
  PlanJobActivity,
  PlanJobPool,
  PlanNode,
  ScheduledPlanJob,
} from '@/types'
import type { PlanPipeline, PlanPipelineStage } from '@/pages/Plan/planPipeline'
import { isReactionRecipe } from '@/lib/recipes'
import { getBlueprintForProduct } from '@/services/data/sdeLoader'
import type { BlueprintInfo } from '@/types'

export interface SchedulerCharacter {
  key: PlanCharacterKey
  slots: { manufacturing: number; reactions: number; research: number }
  durationFactor: (node: PlanNode) => number
  canRun: (node: PlanNode) => boolean
}

export interface FixedPlanJob {
  stepKey: string
  startHour: number
  endHour: number
  characterKey?: PlanCharacterKey
}

export interface SchedulePlanInput {
  nodes: PlanNode[]
  slots: number
  /** Concurrent science slots for copy / invention. */
  scienceSlots?: number
  /** Concurrent reaction slots (separate from manufacturing). */
  reactionSlots?: number
  windowHours: number
  /** Optional pre-built pipeline; when present, science stages are scheduled too. */
  pipeline?: PlanPipeline
  blueprints?: BlueprintInfo[]
  /** When set, production jobs use per-character slot pools and owners. */
  characters?: SchedulerCharacter[]
  ownerByProduct?: Map<number, PlanCharacterKey | 'auto'>
  /** Max parallel copy jobs per T2 product (T1 BPO lines). Default 1. */
  copyBposByProduct?: Map<number, number>
}

interface CharacterSlotPools {
  key: PlanCharacterKey
  character: SchedulerCharacter
  mfg: number[]
  rxn: number[]
}

interface ScheduleEvent {
  productTypeId: number
  hour: number
  qty: number
}

function childDemandForJob(child: PlanNode, parent: PlanNode, parentRunsThisJob: number): number {
  const entry = child.demandByParent.find((d) => d.parentProductTypeId === parent.productTypeId)
  if (!entry) return 0
  return entry.qty * (parentRunsThisJob / Math.max(1, parent.runs))
}

/** Inventory available when a job starts at `hour` (matches planSimulator bucket semantics). */
function inventoryWhenStarting(
  productTypeId: number,
  hour: number,
  supplies: ScheduleEvent[],
  demands: ScheduleEvent[],
): number {
  let inv = 0
  let supplyAtHour = 0
  let demandAtHour = 0

  for (const event of supplies) {
    if (event.productTypeId !== productTypeId) continue
    if (event.hour < hour) inv += event.qty
    else if (event.hour === hour) supplyAtHour += event.qty
  }

  for (const event of demands) {
    if (event.productTypeId !== productTypeId) continue
    if (event.hour < hour) inv -= event.qty
    else if (event.hour === hour) demandAtHour += event.qty
  }

  return inv + supplyAtHour - demandAtHour
}

function findEarliestStartHour(
  productTypeId: number,
  needed: number,
  minHour: number,
  supplies: ScheduleEvent[],
  demands: ScheduleEvent[],
): number {
  if (needed <= 0) return minHour

  const productSupplies = supplies.filter((s) => s.productTypeId === productTypeId)
  const candidates = new Set<number>([minHour])
  for (const event of productSupplies) {
    if (event.hour >= minHour) candidates.add(event.hour)
  }

  for (const hour of [...candidates].sort((a, b) => a - b)) {
    if (inventoryWhenStarting(productTypeId, hour, supplies, demands) >= needed) {
      return hour
    }
  }

  const lastSupplyHour = productSupplies.reduce(
    (max, event) => (event.hour > max ? event.hour : max),
    minHour,
  )
  return Math.max(minHour, lastSupplyHour)
}

function earliestStartWithDependencies(
  node: PlanNode,
  runsThisJob: number,
  slotMinStart: number,
  nodesById: Map<number, PlanNode>,
  supplies: ScheduleEvent[],
  demands: ScheduleEvent[],
  scienceReadyByProduct: Map<number, number>,
): number {
  let start = slotMinStart

  const scienceReady = scienceReadyByProduct.get(node.productTypeId)
  if (scienceReady != null) start = Math.max(start, scienceReady)

  for (const childId of node.childProductTypeIds) {
    const child = nodesById.get(childId)
    if (!child || child.mode !== 'build') continue

    const needed = childDemandForJob(child, node, runsThisJob)
    if (needed <= 0) continue

    start = Math.max(
      start,
      findEarliestStartHour(child.productTypeId, needed, start, supplies, demands),
    )
  }

  return start
}

function scheduleScienceStages(
  stages: PlanPipelineStage[],
  scienceSlots: number,
  copyBposByProduct?: Map<number, number>,
): {
  jobs: ScheduledPlanJob[]
  readyByProduct: Map<number, number>
  stageEnd: Map<string, number>
} {
  const scienceStages = stages.filter((s) => s.pool === 'science')
  const slotFreeAt = Array.from({ length: Math.max(1, scienceSlots) }, () => 0)
  const jobs: ScheduledPlanJob[] = []
  const stageEnd = new Map<string, number>()
  const attemptEndsByStage = new Map<string, number[]>()
  const readyByProduct = new Map<number, number>()
  const copyLaneFreeAt = new Map<number, number[]>()

  // Copy then invent in pipeline order. Each attempt is its own job (invention cannot batch).
  for (const stage of scienceStages) {
    const attempts = Math.max(1, Math.ceil(stage.runs))
    const copyDepId = stage.dependsOn.find((id) => id.startsWith('copy-'))
    const copyAttemptEnds = copyDepId ? attemptEndsByStage.get(copyDepId) : undefined
    const attemptEnds: number[] = []

    for (let i = 0; i < attempts; i++) {
      let depEnd = 0
      if (copyAttemptEnds?.[i] != null) {
        depEnd = copyAttemptEnds[i]!
      } else {
        for (const dep of stage.dependsOn) {
          depEnd = Math.max(depEnd, stageEnd.get(dep) ?? 0)
        }
      }
      let slot = slotFreeAt.indexOf(Math.min(...slotFreeAt))
      let startHour = Math.max(slotFreeAt[slot] ?? 0, depEnd)
      let laneEnds: number[] | undefined
      let lane = 0
      if (stage.activity === 'copy') {
        const lanes = Math.max(1, copyBposByProduct?.get(stage.productTypeId) ?? 1)
        laneEnds = copyLaneFreeAt.get(stage.productTypeId)
        if (!laneEnds) {
          laneEnds = Array.from({ length: lanes }, () => 0)
          copyLaneFreeAt.set(stage.productTypeId, laneEnds)
        }
        lane = laneEnds.indexOf(Math.min(...laneEnds))
        // Hold the BPO lane, then the science slot that is free by then — don't pin an idle slot.
        const laneReady = Math.max(depEnd, laneEnds[lane] ?? 0)
        startHour = Infinity
        for (let s = 0; s < slotFreeAt.length; s++) {
          const start = Math.max(slotFreeAt[s] ?? 0, laneReady)
          if (start < startHour) {
            startHour = start
            slot = s
          }
        }
      }
      const endHour = startHour + stage.durationHours
      if (laneEnds) laneEnds[lane] = endHour
      slotFreeAt[slot] = endHour
      jobs.push({
        productTypeId: stage.productTypeId,
        name: stage.name,
        slot,
        startHour,
        endHour,
        runs: 1,
        outputQty: 1,
        activity: stage.activity,
        pool: 'science',
      })
      attemptEnds.push(endHour)
    }

    const lastEnd = attemptEnds[attemptEnds.length - 1] ?? 0
    stageEnd.set(stage.id, lastEnd)
    attemptEndsByStage.set(stage.id, attemptEnds)
    const prev = readyByProduct.get(stage.productTypeId) ?? 0
    readyByProduct.set(stage.productTypeId, Math.max(prev, lastEnd))
  }

  return { jobs, readyByProduct, stageEnd }
}

function activityForNode(node: PlanNode, blueprints?: BlueprintInfo[]): PlanJobActivity {
  if (node.recipeKind === 'reaction') return 'reaction'
  if (blueprints) {
    const bp = getBlueprintForProduct(blueprints, node.productTypeId)
    if (bp && isReactionRecipe(bp)) return 'reaction'
  }
  return 'manufacture'
}

function buildCharacterSlotPools(characters: SchedulerCharacter[]): CharacterSlotPools[] {
  return characters.map((character) => ({
    key: character.key,
    character,
    mfg: Array.from({ length: Math.max(1, character.slots.manufacturing) }, () => 0),
    rxn: Array.from({ length: Math.max(1, character.slots.reactions) }, () => 0),
  }))
}

function slotFreeAtForPool(state: CharacterSlotPools, pool: PlanJobPool): number[] {
  return pool === 'reaction' ? state.rxn : state.mfg
}

function ownerCandidates(
  owner: PlanCharacterKey | 'auto' | undefined,
  pools: CharacterSlotPools[],
  node: PlanNode,
): CharacterSlotPools[] {
  if (owner && owner !== 'auto') {
    const pinned = pools.find((pool) => pool.key === owner)
    return pinned ? [pinned] : pools
  }
  const eligible = pools.filter((pool) => pool.character.canRun(node))
  return eligible.length > 0 ? eligible : pools
}

function scheduleProductionNodes(
  nodes: PlanNode[],
  nodesById: Map<number, PlanNode>,
  mfgSlotFreeAt: number[],
  rxnSlotFreeAt: number[],
  scienceReadyByProduct: Map<number, number>,
  windowHours: number,
  blueprints?: BlueprintInfo[],
  multi?: {
    characters: SchedulerCharacter[]
    ownerByProduct: Map<number, PlanCharacterKey | 'auto'>
  },
): { jobs: ScheduledPlanJob[]; supplies: ScheduleEvent[]; demands: ScheduleEvent[] } {
  const buildNodes = nodes.filter((n) => n.mode === 'build' && n.runs > 0)
  const byDepth = [...buildNodes].sort((a, b) => b.depth - a.depth)
  const jobs: ScheduledPlanJob[] = []
  const supplies: ScheduleEvent[] = []
  const demands: ScheduleEvent[] = []
  const characterPools = multi ? buildCharacterSlotPools(multi.characters) : null

  for (const node of byDepth) {
    const activity = activityForNode(node, blueprints)
    const pool: PlanJobPool = activity === 'reaction' ? 'reaction' : 'manufacturing'
    const aggregateSlotFreeAt = pool === 'reaction' ? rxnSlotFreeAt : mfgSlotFreeAt

    let remainingRuns = node.runs
    const runsPerJob = Math.max(1, Math.ceil(node.runs / Math.max(1, node.concurrentCopies)))

    while (remainingRuns > 0) {
      const runsThisJob = Math.min(remainingRuns, runsPerJob)
      const baseJobDurationHours =
        runsPerJob > 0 ? (node.jobTimeSeconds * runsThisJob) / runsPerJob / 3600 : 0

      let slot: number
      let startHour: number
      let endHour: number
      let characterKey: PlanCharacterKey | undefined

      if (characterPools && characterPools.length > 0) {
        const owner = multi!.ownerByProduct.get(node.productTypeId)
        const candidates = ownerCandidates(owner, characterPools, node)
        let best: {
          state: CharacterSlotPools
          slot: number
          startHour: number
          endHour: number
        } | null = null

        for (const state of candidates) {
          const slotFreeAt = slotFreeAtForPool(state, pool)
          const candidateSlot = slotFreeAt.indexOf(Math.min(...slotFreeAt))
          const slotMinStart = slotFreeAt[candidateSlot] ?? 0
          const candidateStart = earliestStartWithDependencies(
            node,
            runsThisJob,
            slotMinStart,
            nodesById,
            supplies,
            demands,
            scienceReadyByProduct,
          )
          const candidateEnd =
            candidateStart + baseJobDurationHours * state.character.durationFactor(node)
          if (
            !best ||
            candidateStart < best.startHour - 1e-9 ||
            (Math.abs(candidateStart - best.startHour) < 1e-9 && candidateEnd < best.endHour)
          ) {
            best = {
              state,
              slot: candidateSlot,
              startHour: candidateStart,
              endHour: candidateEnd,
            }
          }
        }

        // ponytail: ownerCandidates always returns ≥1 pool
        const picked = best!
        slot = picked.slot
        startHour = picked.startHour
        endHour = picked.endHour
        characterKey = picked.state.key
        const slotFreeAt = slotFreeAtForPool(picked.state, pool)
        slotFreeAt[slot] = endHour
      } else {
        slot = aggregateSlotFreeAt.indexOf(Math.min(...aggregateSlotFreeAt))
        const slotMinStart = aggregateSlotFreeAt[slot] ?? 0
        startHour = earliestStartWithDependencies(
          node,
          runsThisJob,
          slotMinStart,
          nodesById,
          supplies,
          demands,
          scienceReadyByProduct,
        )
        endHour = startHour + baseJobDurationHours
        aggregateSlotFreeAt[slot] = endHour
      }

      const outputQty = runsThisJob * (node.outputQty / Math.max(1, node.runs))

      jobs.push({
        productTypeId: node.productTypeId,
        name: node.name,
        slot,
        startHour,
        endHour,
        runs: runsThisJob,
        outputQty,
        activity,
        pool,
        characterKey,
      })

      supplies.push({ productTypeId: node.productTypeId, hour: endHour, qty: outputQty })

      for (const childId of node.childProductTypeIds) {
        const child = nodesById.get(childId)
        if (!child || child.mode !== 'build') continue
        const qty = childDemandForJob(child, node, runsThisJob)
        if (qty > 0) {
          demands.push({ productTypeId: child.productTypeId, hour: startHour, qty })
        }
      }

      remainingRuns -= runsThisJob
    }
  }

  return { jobs: jobs.filter((j) => j.startHour < windowHours), supplies, demands }
}

/** Greedy slot packing with build dependencies: parents wait for child supply + science. */
export function schedulePlanJobs(input: SchedulePlanInput): ScheduledPlanJob[] {
  const { nodes, slots, windowHours, pipeline, blueprints, characters, ownerByProduct } = input
  const scienceSlots = input.scienceSlots ?? 1
  const reactionSlots = input.reactionSlots ?? 1

  const scienceResult = pipeline
    ? scheduleScienceStages(pipeline.stages, scienceSlots, input.copyBposByProduct)
    : {
        jobs: [] as ScheduledPlanJob[],
        readyByProduct: new Map<number, number>(),
        stageEnd: new Map(),
      }

  const nodesById = new Map(nodes.map((node) => [node.productTypeId, node]))
  const mfgSlotFreeAt = Array.from({ length: Math.max(1, slots) }, () => 0)
  const rxnSlotFreeAt = Array.from({ length: Math.max(1, reactionSlots) }, () => 0)

  const multi =
    characters && characters.length > 0 && ownerByProduct
      ? { characters, ownerByProduct }
      : undefined

  const production = scheduleProductionNodes(
    nodes,
    nodesById,
    mfgSlotFreeAt,
    rxnSlotFreeAt,
    scienceResult.readyByProduct,
    windowHours,
    blueprints,
    multi,
  )

  return [...scienceResult.jobs, ...production.jobs]
}

export function isSciencePlanJob(job: ScheduledPlanJob): boolean {
  return job.pool === 'science' || job.activity === 'copy' || job.activity === 'invention'
}

/** Clock time from plan start until this product's last production job finishes. */
export function productReadyHours(jobs: ScheduledPlanJob[], productTypeId: number): number | null {
  let end = -1
  for (const job of jobs) {
    if (job.productTypeId !== productTypeId) continue
    if (isSciencePlanJob(job)) continue
    if (job.endHour > end) end = job.endHour
  }
  return end >= 0 ? end : null
}

export function readyHoursByProductId(jobs: ScheduledPlanJob[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const job of jobs) {
    if (isSciencePlanJob(job)) continue
    const prev = map.get(job.productTypeId) ?? 0
    if (job.endHour > prev) map.set(job.productTypeId, job.endHour)
  }
  return map
}

export function scheduledDurationHours(jobs: ScheduledPlanJob[], productTypeId: number): number {
  const productJobs = jobs.filter((j) => j.productTypeId === productTypeId)
  if (productJobs.length === 0) return 0
  const start = Math.min(...productJobs.map((j) => j.startHour))
  const end = Math.max(...productJobs.map((j) => j.endHour))
  return end - start
}

export function windowHoursFromJobs(jobs: ScheduledPlanJob[]): number {
  if (jobs.length === 0) return 1
  const end = Math.max(...jobs.map((j) => j.endHour))
  if (!Number.isFinite(end) || end <= 0) return 1
  return Math.max(1, end)
}

export function detectOverUnder(nodes: PlanNode[]): { productTypeId: number; message: string }[] {
  const warnings: { productTypeId: number; message: string }[] = []
  for (const node of nodes) {
    if (node.mode !== 'build' || node.isRoot) continue
    const produced = node.outputQty
    const demand = node.totalDemandQty
    if (produced > demand * 1.001) {
      warnings.push({
        productTypeId: node.productTypeId,
        message: `${node.name}: produced ${Math.round(produced)} vs demand ${Math.round(demand)} (over +${Math.round(produced - demand)})`,
      })
    } else if (produced < demand * 0.999) {
      warnings.push({
        productTypeId: node.productTypeId,
        message: `${node.name}: produced ${Math.round(produced)} vs demand ${Math.round(demand)} (under -${Math.round(demand - produced)})`,
      })
    }
  }
  return warnings
}
