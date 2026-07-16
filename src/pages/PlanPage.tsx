import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader, LoadingState } from '@/components/Layout'
import { Panel } from '@/components/Panel'
import { Tooltip } from '@/components/Tooltip'
import { BlueprintGraphModal } from '@/components/BlueprintGraphModal'
import { PlanTimelineChart } from '@/components/plan/PlanTimelineChart'
import { PlanGraphView } from '@/components/plan/PlanGraphView'
import { BlueprintSearchPicker } from '@/components/plan/BlueprintSearchPicker'
import { PlanChainTable } from '@/components/plan/PlanChainTable'
import { PlanRootList } from '@/components/plan/PlanRootList'
import { PlanViewTabs, type PlanViewTab } from '@/components/plan/PlanViewTabs'
import { PlanTemplateBar } from '@/components/plan/PlanTemplateBar'
import { PlanDetailHeader } from '@/components/plan/PlanDetailHeader'
import { PlanTimelineProvider } from '@/contexts/PlanTimelineContext'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import { useManufacturingPlan, usePlanSkills } from '@/hooks/useManufacturingPlan'
import {
  buildTypeMap,
  getAllBlueprints,
  getBlueprintForProduct,
  getHubMarket,
  buildPriceMap,
} from '@/services/data/sdeLoader'
import { buildWindowPriceMap } from '@/lib/ranking'
import { manufacturingSlotsFromSkills } from '@/lib/manufacturingSlots'
import { scheduledDurationHours } from '@/lib/planScheduler'
import { flattenPlanNodesExpandable } from '@/lib/planTreeLines'
import { resolveRunsFromPatch } from '@/lib/rootRunsDuration'
import { productionGraphRoute } from '@/lib/paths'
import { formatDecimal } from '@/lib/profit'
import { DEFAULT_BATCH_SIZE } from '@/types'
import type { PlanBuildMode } from '@/types'

function IconBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip text={label} placement="bottom">
      <button
        type="button"
        className={`btn btn-ghost btn-sm btn-square ${danger ? 'text-error' : ''}`}
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.436a.75.75 0 10.47 1.425c.63-.208 1.233-.32 1.895-.37v10.266c0 .993.807 1.8 1.8 1.8h4.4a1.8 1.8 0 001.8-1.8V5.684c.662.05 1.265.162 1.895.37a.75.75 0 10.47-1.425A21.06 21.06 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 6.75a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 0110 6.75zm2.75.75a.75.75 0 00-1.5 0v6.5a.75.75 0 001.5 0v-6.5zM7.75 7.5a.75.75 0 01.75-.75.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function FullscreenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="w-4 h-4"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
      />
    </svg>
  )
}

function ExitFullscreenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="w-4 h-4"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
      />
    </svg>
  )
}

export function PlanPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const addProductId = searchParams.get('add')

  const { data, isLoading } = useSdeData()
  const userData = useAppStore((s) => s.userData)
  const templates = userData.planTemplates ?? []
  const selectedId = useAppStore((s) => s.selectedPlanTemplateId)
  const setSelectedId = useAppStore((s) => s.setSelectedPlanTemplateId)
  const addPlanTemplate = useAppStore((s) => s.addPlanTemplate)
  const updatePlanTemplate = useAppStore((s) => s.updatePlanTemplate)
  const deletePlanTemplate = useAppStore((s) => s.deletePlanTemplate)
  const duplicatePlanTemplate = useAppStore((s) => s.duplicatePlanTemplate)
  const addRootToPlanTemplate = useAppStore((s) => s.addRootToPlanTemplate)
  const removeRootFromPlanTemplate = useAppStore((s) => s.removeRootFromPlanTemplate)

  const [tab, setTab] = useState<PlanViewTab>('supply')
  const [graphProductTypeId, setGraphProductTypeId] = useState<number | null>(null)
  const [chainFullscreen, setChainFullscreen] = useState(false)
  const { skills } = usePlanSkills()

  const template = templates.find((t) => t.id === selectedId) ?? null

  const blueprints = useMemo(() => (data ? getAllBlueprints(data.registry) : []), [data])
  const typeMap = useMemo(() => (data ? buildTypeMap(data.types) : new Map()), [data])
  const prices = useMemo(() => {
    if (!data) return new Map<number, number>()
    const hubMarket = getHubMarket(data.market, userData.settings.primaryHub)
    if (!hubMarket) return new Map<number, number>()
    return buildWindowPriceMap(hubMarket, '1w', buildPriceMap(hubMarket))
  }, [data, userData.settings.primaryHub])

  const hubMarket = data ? getHubMarket(data.market, userData.settings.primaryHub) : null
  const systemCostIndex = hubMarket?.costIndex ?? 0.01

  const plan = useManufacturingPlan(
    template,
    blueprints,
    typeMap,
    prices,
    userData.settings,
    systemCostIndex,
  )

  const slots = manufacturingSlotsFromSkills(skills)

  const rootIds = useMemo(
    () => new Set(template?.roots.map((r) => r.productTypeId) ?? []),
    [template],
  )

  const blueprintTypeIdByProduct = useMemo(() => {
    const map = new Map<number, number>()
    for (const bp of blueprints) {
      map.set(bp.productTypeId, bp.blueprintTypeId)
    }
    return map
  }, [blueprints])

  const buildRows = useMemo(() => {
    const buildNodes = plan.nodes.filter((n) => n.mode === 'build')
    return flattenPlanNodesExpandable(buildNodes, 'build-blueprints').map((row) => ({
      ...row,
      productTypeId: row.node.productTypeId,
      blueprintTypeId: blueprintTypeIdByProduct.get(row.node.productTypeId),
      name: row.node.name,
      runs: row.node.runs,
      jobTimeHours: scheduledDurationHours(plan.jobs, row.node.productTypeId),
      outputQty: row.node.outputQty,
      isRoot: row.node.isRoot,
    }))
  }, [plan.nodes, plan.jobs, blueprintTypeIdByProduct])

  useEffect(() => {
    if (templates.length === 0) return
    if (!selectedId || !templates.some((t) => t.id === selectedId)) {
      setSelectedId(templates[0].id)
    }
  }, [templates, selectedId, setSelectedId])

  useEffect(() => {
    if (!addProductId || !data || !template) return
    const id = Number(addProductId)
    if (!Number.isFinite(id)) return
    const bp = getBlueprintForProduct(blueprints, id)
    if (!bp) return
    if (template.roots.some((r) => r.productTypeId === id)) return
    addRootToPlanTemplate(template.id, {
      productTypeId: id,
      runs: DEFAULT_BATCH_SIZE,
      productionDurationHours: 24,
    })
  }, [addProductId, data, template, blueprints, addRootToPlanTemplate])

  useEffect(() => {
    if (!chainFullscreen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChainFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chainFullscreen])

  useEffect(() => {
    if (tab !== 'graph') setChainFullscreen(false)
  }, [tab])

  const toggleMode = useCallback(
    (productTypeId: number) => {
      if (!template) return
      const node = plan.nodes.find((n) => n.productTypeId === productTypeId)
      if (!node?.canToggle) return
      const next: PlanBuildMode = node.mode === 'build' ? 'buy' : 'build'
      updatePlanTemplate(template.id, {
        modeOverrides: { ...template.modeOverrides, [productTypeId]: next },
      })
    },
    [template, plan.nodes, updatePlanTemplate],
  )

  const openGraph = useCallback((productTypeId: number) => {
    setGraphProductTypeId(productTypeId)
  }, [])

  const graphBlueprint = useMemo(() => {
    if (graphProductTypeId == null) return null
    return getBlueprintForProduct(blueprints, graphProductTypeId) ?? null
  }, [blueprints, graphProductTypeId])

  const openGraphPage = useCallback(
    (productTypeId: number) => {
      navigate(productionGraphRoute(productTypeId))
      setGraphProductTypeId(null)
    },
    [navigate],
  )

  const getPlanRuns = useCallback(
    (productTypeId: number) => {
      const node = plan.nodes.find((n) => n.productTypeId === productTypeId)
      return node && node.runs > 0 ? node.runs : undefined
    },
    [plan.nodes],
  )

  const addRoot = (productTypeId: number) => {
    if (!template) return
    if (template.roots.some((r) => r.productTypeId === productTypeId)) return
    addRootToPlanTemplate(template.id, {
      productTypeId,
      runs: DEFAULT_BATCH_SIZE,
      productionDurationHours: 24,
    })
  }

  if (isLoading || !data) return <LoadingState />

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      <PageHeader
        title="Manufacturing plan"
        subtitle="Templates, build vs buy chain, and a timeline of supply vs demand"
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => addPlanTemplate()}>
            New plan
          </button>
        }
      />

      <PlanTemplateBar
        templates={templates}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {!template ? (
        <Panel title="Get started">
          <p className="text-sm opacity-70">
            Create a plan and add root blueprints by name, then tune runs and job time.
          </p>
          <button type="button" className="btn btn-primary btn-sm mt-4" onClick={() => addPlanTemplate()}>
            New plan
          </button>
        </Panel>
      ) : (
        <PlanTimelineProvider
          windowHours={plan.windowHours}
          nodes={plan.nodes}
          simulations={plan.simulations}
          defaultSupplierId={plan.defaultSupplierId}
          defaultConsumerId={plan.defaultConsumerId}
        >
          <div className="flex flex-col gap-5">
          <PlanDetailHeader
            name={template.name}
            stats={[
              { label: 'Roots', value: String(template.roots.length) },
              { label: 'Nodes', value: String(plan.nodes.length) },
              { label: 'Slots', value: String(slots) },
              { label: 'Timeline', value: `${formatDecimal(plan.windowHours, 1)}h` },
            ]}
            actions={
              <>
                <IconBtn
                  label="Rename"
                  onClick={() => {
                    const n = prompt('Plan name', template.name)
                    if (n?.trim()) updatePlanTemplate(template.id, { name: n.trim() })
                  }}
                >
                  <PencilIcon />
                </IconBtn>
                <IconBtn label="Duplicate" onClick={() => duplicatePlanTemplate(template.id)}>
                  <CopyIcon />
                </IconBtn>
                <IconBtn label="Delete" danger onClick={() => deletePlanTemplate(template.id)}>
                  <TrashIcon />
                </IconBtn>
              </>
            }
          />

          <section className="plan-build-card">
            <div className="plan-build-card__header">
              <h2 className="plan-build-card__title">Build blueprints</h2>
              <span className="plan-build-card__badge">
                {template.roots.length} root{template.roots.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="plan-build-card__body">
              <div className="plan-build-card__search">
                <BlueprintSearchPicker
                  blueprints={blueprints}
                  typeMap={typeMap}
                  excludeIds={rootIds}
                  onSelect={addRoot}
                />
                <p className="plan-build-card__hint">
                  Search by product name, or add from Blueprints ranking (+ Plan).
                </p>
              </div>
              <PlanRootList
                rows={buildRows}
                onChange={(productTypeId, patch) => {
                  if (!template) return
                  const node = plan.nodes.find((n) => n.productTypeId === productTypeId)
                  if (!node) return
                  const bp = getBlueprintForProduct(blueprints, productTypeId)
                  const runs = resolveRunsFromPatch(
                    node.runs,
                    patch,
                    bp,
                    userData.settings,
                    node.concurrentCopies,
                  )

                  if (node.isRoot) {
                    const root = template.roots.find((r) => r.productTypeId === productTypeId)
                    if (!root) return
                    updatePlanTemplate(template.id, {
                      roots: template.roots.map((r) =>
                        r.productTypeId === productTypeId ? { ...r, runs } : r,
                      ),
                    })
                    return
                  }

                  updatePlanTemplate(template.id, {
                    nodeOverrides: {
                      ...template.nodeOverrides,
                      [productTypeId]: {
                        ...template.nodeOverrides[productTypeId],
                        runs,
                      },
                    },
                  })
                }}
                onRemove={(productTypeId) => removeRootFromPlanTemplate(template.id, productTypeId)}
              />
            </div>
          </section>

          <PlanTimelineChart />

          <PlanViewTabs
            active={tab}
            onChange={setTab}
            graphActions={
              <IconBtn label="Full screen" onClick={() => setChainFullscreen(true)}>
                <FullscreenIcon />
              </IconBtn>
            }
          >
            {tab === 'supply' ? (
              <PlanChainTable
                nodes={plan.nodes}
                onToggleMode={toggleMode}
                onOpenGraph={openGraph}
                blueprintTypeIdByProduct={blueprintTypeIdByProduct}
                warnings={plan.warnings}
              />
            ) : null}

            {tab === 'graph' ? (
              <PlanGraphView
                nodes={plan.nodes}
                onToggleMode={toggleMode}
                blueprintTypeIdByProduct={blueprintTypeIdByProduct}
              />
            ) : null}
          </PlanViewTabs>

          {chainFullscreen ? (
            <dialog className="modal modal-open">
              <div className="modal-box w-full max-w-none h-[100dvh] max-h-[100dvh] rounded-none p-4 m-0 flex flex-col">
                <div className="flex items-center justify-between gap-2 shrink-0 mb-2">
                  <h2 className="text-base font-semibold">Production graph</h2>
                  <IconBtn label="Exit full screen" onClick={() => setChainFullscreen(false)}>
                    <ExitFullscreenIcon />
                  </IconBtn>
                </div>
                <PlanGraphView
                  layout="expanded"
                  nodes={plan.nodes}
                  onToggleMode={toggleMode}
                  blueprintTypeIdByProduct={blueprintTypeIdByProduct}
                />
              </div>
              <form
                method="dialog"
                className="modal-backdrop"
                onSubmit={() => setChainFullscreen(false)}
              >
                <button type="submit">close</button>
              </form>
            </dialog>
          ) : null}
          </div>
        </PlanTimelineProvider>
      )}

      {graphBlueprint ? (
        <BlueprintGraphModal
          variant="modal"
          blueprint={graphBlueprint}
          hub={userData.settings.primaryHub}
          settings={userData.settings}
          getPlanRuns={getPlanRuns}
          onClose={() => setGraphProductTypeId(null)}
          onOpenPage={openGraphPage}
        />
      ) : null}
    </div>
  )
}
