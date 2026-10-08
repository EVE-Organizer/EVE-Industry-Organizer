import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader, LoadingState } from '@/components/layout/Layout'
import { Panel } from '@/components/Panel'
import { Tooltip } from '@/components/Tooltip'
import { BlueprintGraphModal } from '@/components/BlueprintGraphModal'
import { PlanTimelinePanel } from '@/pages/Plan/PlanTimelineChart'
import { PlanGraphView } from '@/pages/Plan/PlanGraphView'
import { BlueprintSearchPicker } from '@/pages/Plan/BlueprintSearchPicker'
import { PlanChainTable } from '@/pages/Plan/PlanChainTable'
import { PlanMeTeModal } from '@/pages/Plan/PlanMeTeModal'
import { PlanRootList } from '@/pages/Plan/PlanRootList'
import { PlanFacilityControls } from '@/components/plan/PlanFacilityControls'
import { PlanViewTabs, type PlanViewTab } from '@/pages/Plan/PlanViewTabs'
import { PlanTemplateBar } from '@/pages/Plan/PlanTemplateBar'
import { PlanDetailHeader } from '@/pages/Plan/PlanDetailHeader'
import { PlanProfitSummaryPanel } from '@/pages/Plan/PlanProfitSummaryPanel'
import { PlanRootSetupModal } from '@/pages/Plan/PlanRootSetupModal'
import { PlanRootProfitModal } from '@/pages/Plan/PlanRootProfitModal'
import { useAppStore } from '@/stores/appStore'
import { refreshData } from '@/lib/refreshCharacterData'
import { useAuthStore } from '@/stores/authStore'
import { useDataStatusStore } from '@/stores/dataStatusStore'
import { useSdeData } from '@/hooks/useSdeData'
import { buildManufacturingPlanSchedule } from '@/pages/Plan/buildManufacturingPlanSchedule'
import { useManufacturingPlan } from '@/pages/Plan/useManufacturingPlan'
import { useCharactersLocationInventory } from '@/hooks/useCharacterIndustryData'
import {
  buildTypeMap,
  getAllBlueprints,
  getBlueprintForProduct,
  getHubMarket,
  buildPriceMap,
  buildBuyPriceMap,
  resolveBuildSystem,
} from '@/services/data/sdeLoader'
import { buildHubWindowMaps, buildWindowPriceMap } from '@/lib/ranking'
import { mergePlanBuyPrices, applyPlanBuyPriceSource } from '@/pages/Plan/planBuyPrices'
import { pickHubMaps, sanitizeBuyPriceMap } from '@/lib/hubPriceSanity'
import type { PlanBuyPriceSource } from '@/pages/Plan/planBuyPrices'
import {
  bumpCharacterSlotBonus,
  bumpPlanWideSlotBonus,
  effectivePlanSlots,
  planSlotBonusesFromManufacturingTemplate,
} from '@/lib/manufacturingSlots'
import { flattenPlanNodesExpandable, withTreeLineMeta } from '@/pages/Plan/planTreeLines'
import { readyHoursByProductId as readyHoursByProductIdFromJobs } from '@/pages/Plan/planScheduler'
import { buildManufactureDisplayRows } from '@/pages/Plan/planManufactureDisplay'
import {
  applyNodeOverridePatch,
  applyRootEntryPatch,
  createSyncedPlanRootEntry,
  fitPlanForOverallDeadlines,
  overallDeadlineTargets,
  overallFitInputKey,
  overallFitPassState,
  overallPlanFitChanged,
  planRootsKey,
  resetPlanRootsFromDuration,
  rootJobTimeHours,
  syncRootEntry,
} from '@/lib/rootRunsDuration'
import { createPlanRootId } from '@/services/sync/types'
import { duplicatePlanRootAfter, movePlanRootById } from '@/lib/planRootOrder'
import { activePlanRoots, displayNodeForRoot } from '@/lib/planRootEnabled'
import {
  addPlanCharacter,
  dropUnpinnedPlanCharacter,
  mergePlanCharacterNames,
  pruneUnpinnedPlanCharacters,
  setNodeCopies,
  setNodeOwner,
  setRootOwner,
  setSellerCharacterKey,
  setT2Options,
  fitOverallPlanToProductionSchedule,
  settingsForProductOwner,
  syncAllPlanRunsFromStoredDuration,
  syncPlanRunsAfterOwnerChange,
} from '@/lib/planActions'
import {
  buildOwnerByProduct,
  displayOwnerForProduct,
  planOwnerValidKeys,
  settingsWithPlanSellerFees,
  sumPlanCrewSlots,
} from '@/lib/planCharacters'
import { PlanOwnerPicker } from '@/components/plan/PlanOwnerPicker'
import { usePlanCharacters, useRememberPlanCharacterNames } from '@/pages/Plan/usePlanCharacters'
import type { PlanGanttCrewMember } from '@/pages/Plan/planGanttAdapter'
import { suggestBlueprintLines } from '@/lib/blueprintLineSuggestion'
import {
  computePlanProfitSummary,
  computeRootProfitBreakdown,
  computeRootSetupBreakdown,
} from '@/pages/Plan/planProfit'
import { productionGraphRoute } from '@/lib/paths'
import {
  buildPlanSharePayload,
  normalizeSharedSettings,
  parsePlanShareHash,
  planShareUrl,
  sharedPayloadToTemplate,
} from '@/lib/planShare'
import { hubDisplayName } from '@/lib/hubDisplay'
import { formatDecimal } from '@/lib/profit'
import { buildManufacturingSettings } from '@/lib/structureSettings'
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_SETTINGS,
  HUBS,
  type HubId,
  type PlanDurationMode,
} from '@/types'
import type {
  GlobalSettings,
  ManufacturingPlanTemplate,
  ManufacturingSettings,
  PlanBuildMode,
  PlanCharacterKey,
  PlanNodeOverride,
} from '@/types'
import { PlanPipelineChecklist } from '@/pages/Plan/PlanPipelineChecklist'
import {
  EconomicsFilterSection,
  type EconomicsFilterValues,
} from '@/components/EconomicsFilterSection'

function parsePlanViewTab(raw: string | null): PlanViewTab {
  if (raw === 'graph' || raw === 'pipeline') return raw
  return 'supply'
}

function selectedPlanTemplateFromStore(): ManufacturingPlanTemplate | null {
  const { selectedPlanTemplateId, userData } = useAppStore.getState()
  if (!selectedPlanTemplateId) return null
  return userData.planTemplates?.find((t) => t.id === selectedPlanTemplateId) ?? null
}

function IconBtn({
  label,
  onClick,
  danger,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip text={label} placement="bottom">
      <button
        type="button"
        className={`btn btn-ghost btn-sm btn-square ${danger ? 'text-error' : ''}`}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
    >
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  )
}

function ShareLinkIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M6.25 5.75h5.5a1.25 1.25 0 0 1 1.25 1.25v5.5a1.25 1.25 0 0 1-1.25 1.25h-5.5A1.25 1.25 0 0 1 5 12.5v-5.5a1.25 1.25 0 0 1 1.25-1.25Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3.75 10.25V4.75A1.25 1.25 0 0 1 5 3.5h5.5"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
    >
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
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const addProductId = searchParams.get('add')
  const tab = parsePlanViewTab(searchParams.get('view'))

  const setTab = useCallback(
    (next: PlanViewTab) => {
      setSearchParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev)
          if (next === 'supply') nextParams.delete('view')
          else nextParams.set('view', next)
          return nextParams
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const { data, isLoading } = useSdeData()
  const templates = useAppStore((s) => s.userData.planTemplates ?? [])
  const storeSettings = useAppStore((s) => s.userData.settings)
  const watchlist = useAppStore((s) => s.userData.watchlist)
  const selectedId = useAppStore((s) => s.selectedPlanTemplateId)
  const setSelectedId = useAppStore((s) => s.setSelectedPlanTemplateId)
  const addPlanTemplate = useAppStore((s) => s.addPlanTemplate)
  const updatePlanTemplate = useAppStore((s) => s.updatePlanTemplate)
  const deletePlanTemplate = useAppStore((s) => s.deletePlanTemplate)
  const reorderPlanTemplates = useAppStore((s) => s.reorderPlanTemplates)
  const duplicatePlanTemplate = useAppStore((s) => s.duplicatePlanTemplate)
  const importSharedPlan = useAppStore((s) => s.importSharedPlan)
  const addRootToPlanTemplate = useAppStore((s) => s.addRootToPlanTemplate)
  const removeRootFromPlanTemplate = useAppStore((s) => s.removeRootFromPlanTemplate)
  const updateSettings = useAppStore((s) => s.updateSettings)

  const [graphProductTypeId, setGraphProductTypeId] = useState<number | null>(null)
  const [meTeProductTypeId, setMeTeProductTypeId] = useState<number | null>(null)
  const [setupDetailRootId, setSetupDetailRootId] = useState<string | null>(null)
  const [profitDetailRootId, setProfitDetailRootId] = useState<string | null>(null)
  const [chainFullscreen, setChainFullscreen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [sharedView, setSharedView] = useState<{
    template: import('@/types').ManufacturingPlanTemplate
    settings: GlobalSettings
  } | null>(null)
  const [sharedHashLoading, setSharedHashLoading] = useState(() =>
    window.location.hash.includes('plan='),
  )
  const [shareLinkError, setShareLinkError] = useState(false)
  const handledAddRef = useRef<string | null>(null)
  const overallRootsKeyRef = useRef<string>('')
  const overallFitPassRef = useRef({ key: '', passes: 0 })

  const storeTemplate = templates.find((t) => t.id === selectedId) ?? null
  const isSharedView = sharedView != null
  const blockStoreMutations = isSharedView || sharedHashLoading || shareLinkError
  const activeTemplate = sharedView?.template ?? storeTemplate
  const activeSettings = sharedView?.settings ?? storeSettings

  const blueprints = useMemo(() => (data ? getAllBlueprints(data.registry) : []), [data])
  const typeMap = useMemo(() => (data ? buildTypeMap(data.types) : new Map()), [data])
  const buyHubId = activeSettings.primaryHub
  const sellHubId = activeSettings.sellHubId ?? buyHubId
  const hubWindowMaps = useMemo(() => {
    if (!data) {
      return {
        prices: new Map<HubId, Map<number, number>>(),
        volumes: new Map<HubId, Map<number, number>>(),
      }
    }
    const window = activeSettings.priceWindow ?? DEFAULT_SETTINGS.priceWindow
    return buildHubWindowMaps(
      data.market,
      window,
      HUBS.map((hub) => hub.id),
    )
  }, [data, activeSettings.priceWindow])
  const hubPricesByHub = hubWindowMaps.prices
  const hubVolumesByHub = hubWindowMaps.volumes

  const prices = useMemo(() => {
    const rawDefault = hubPricesByHub.get(buyHubId) ?? new Map<number, number>()
    const sanitizedDefault = sanitizeBuyPriceMap(rawDefault, pickHubMaps(hubPricesByHub))
    if (!activeTemplate) return sanitizedDefault
    const mapsForMerge = new Map(hubPricesByHub)
    mapsForMerge.set(buyHubId, sanitizedDefault)
    return mergePlanBuyPrices(mapsForMerge, activeTemplate.nodeOverrides, buyHubId)
  }, [hubPricesByHub, activeTemplate, buyHubId])

  const sellPrices = useMemo(() => {
    if (!data) return new Map<number, number>()
    const hubMarket = getHubMarket(data.market, sellHubId)
    if (!hubMarket) return new Map<number, number>()
    const window = activeSettings.priceWindow ?? DEFAULT_SETTINGS.priceWindow
    return buildWindowPriceMap(hubMarket, window, buildPriceMap(hubMarket))
  }, [data, sellHubId, activeSettings.priceWindow])

  const buyPrices = useMemo(() => {
    if (!data) return new Map<number, number>()
    const hubMarket = getHubMarket(data.market, sellHubId)
    if (!hubMarket) return new Map<number, number>()
    return buildBuyPriceMap(hubMarket)
  }, [data, sellHubId])

  const buyHubMarket = data ? getHubMarket(data.market, buyHubId) : null
  const mfgSystemId = activeSettings.manufacturingSystemId
  const reactionSystemId = activeSettings.reactionFacility?.reactionSystemId ?? mfgSystemId
  const systemCostIndex = useMemo(() => {
    if (!data || !buyHubMarket) return 0.01
    return resolveBuildSystem(data.systems, data.regions, buyHubMarket, mfgSystemId).costIndex
  }, [data, buyHubMarket, mfgSystemId])
  const reactionCostIndex = useMemo(() => {
    if (!data || !buyHubMarket) return systemCostIndex
    return resolveBuildSystem(data.systems, data.regions, buyHubMarket, reactionSystemId)
      .reactionCostIndex
  }, [data, buyHubMarket, reactionSystemId, systemCostIndex])
  const buyHubName = hubDisplayName(buyHubId)
  const sellHubName = hubDisplayName(sellHubId)

  const expandInput = useMemo(
    () =>
      activeTemplate && data
        ? {
            template: activeTemplate,
            blueprints,
            typeMap,
            prices,
            settings: activeSettings,
            systemCostIndex,
            reactionCostIndex,
            systems: data.systems,
          }
        : null,
    [
      activeTemplate,
      data,
      blueprints,
      typeMap,
      prices,
      activeSettings,
      systemCostIndex,
      reactionCostIndex,
    ],
  )

  const authCharacters = useAuthStore((s) => s.characters)
  const manualCharacters = useAppStore((s) => s.userData.manualCharacters)
  const { everyone: planCharacterOptions, resolved: planResolvedCrew } = usePlanCharacters(
    activeTemplate,
    activeSettings,
  )

  const knownCharacterNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const option of planCharacterOptions) names[option.key] = option.name
    return names
  }, [planCharacterOptions])

  const saveCharacterNames = useCallback(
    (names: Record<string, string>) => {
      const template = selectedPlanTemplateFromStore()
      if (!template) return
      const patch = mergePlanCharacterNames(template, names)
      if (!patch.characterNames) return
      updatePlanTemplate(template.id, patch)
    },
    [updatePlanTemplate],
  )

  useRememberPlanCharacterNames({
    enabled: !isSharedView && activeTemplate != null,
    keys: activeTemplate?.characters ?? [],
    knownNames: knownCharacterNames,
    storedNames: activeTemplate?.characterNames,
    onSave: saveCharacterNames,
  })

  useEffect(() => {
    if (isSharedView || !storeTemplate) return
    const patch = pruneUnpinnedPlanCharacters(storeTemplate)
    if (!patch.characters) return
    updatePlanTemplate(storeTemplate.id, patch)
  }, [isSharedView, storeTemplate, updatePlanTemplate])

  const planGanttCrew = useMemo((): PlanGanttCrewMember[] => {
    return planResolvedCrew.map((character) => ({
      key: character.key,
      name: character.name,
      characterId: character.isSso ? Number(character.key.slice(4)) : undefined,
      manufacturing: character.slots.manufacturing,
      reactions: character.slots.reactions,
      research: character.slots.research,
    }))
  }, [planResolvedCrew])

  const planSkillSources = useMemo(
    () => ({
      sso: authCharacters.map((c) => ({
        characterId: c.characterId,
        characterName: c.characterName,
        skills: c.skills ?? c.trainedSkills,
      })),
      manual: manualCharacters ?? [],
    }),
    [authCharacters, manualCharacters],
  )

  const planFeeSkills = useMemo(
    () =>
      settingsWithPlanSellerFees(
        activeSettings,
        activeTemplate?.sellerCharacterKey,
        authCharacters.map((c) => ({
          characterId: c.characterId,
          characterName: c.characterName,
          skills: c.skills ?? c.trainedSkills,
        })),
        manualCharacters ?? [],
      ).skills,
    [activeSettings, activeTemplate?.sellerCharacterKey, authCharacters, manualCharacters],
  )

  const manufacturingSettings = useMemo(
    (): ManufacturingSettings =>
      buildManufacturingSettings(activeSettings, data?.systems, { batchSize: DEFAULT_BATCH_SIZE }),
    [activeSettings, data?.systems],
  )

  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)

  const planSsoCharacterIds = useMemo(() => {
    const fromPlan = (activeTemplate?.characters ?? [])
      .filter((key): key is `sso:${number}` => key.startsWith('sso:'))
      .map((key) => Number(key.slice(4)))
    if (fromPlan.length > 0) return fromPlan
    if (activeCharacterId != null) return [activeCharacterId]
    return []
  }, [activeTemplate?.characters, activeCharacterId])

  const productionLocationId = activeSettings.productionLocationId ?? null
  const planLocationInventory = useCharactersLocationInventory(
    planSsoCharacterIds,
    productionLocationId,
  )
  const locationInventory = planLocationInventory.pooled
  const inventoryLoaded = productionLocationId != null && planSsoCharacterIds.length > 0

  const plan = useManufacturingPlan(
    activeTemplate,
    blueprints,
    typeMap,
    prices,
    activeSettings,
    systemCostIndex,
    reactionCostIndex,
    data?.systems,
    activeSettings.includeInventory ? locationInventory : undefined,
    { includeSimulation: tab === 'graph' },
  )

  const ownerByProduct = useMemo(() => {
    if (!activeTemplate) return new Map<number, PlanCharacterKey | 'auto'>()
    const validKeys = planOwnerValidKeys(
      activeTemplate,
      planCharacterOptions.map((option) => option.key),
    )
    return buildOwnerByProduct(
      plan.nodes,
      activeTemplate.roots,
      activeTemplate.nodeOverrides,
      validKeys,
    )
  }, [activeTemplate, plan.nodes, planCharacterOptions])

  const profitExpandInput = useMemo(() => {
    if (!expandInput) return null
    const feeOverlay = (settings: GlobalSettings) =>
      settingsWithPlanSellerFees(
        settings,
        activeTemplate?.sellerCharacterKey,
        planSkillSources.sso,
        planSkillSources.manual,
      )
    const slotBonuses = planSlotBonusesFromManufacturingTemplate(activeTemplate ?? undefined)
    const slotTotals =
      planResolvedCrew.length > 0
        ? sumPlanCrewSlots(planResolvedCrew)
        : effectivePlanSlots(activeSettings.skills, slotBonuses)
    return {
      ...expandInput,
      settings: feeOverlay(expandInput.settings),
      settingsForProductTime: (productTypeId: number) =>
        feeOverlay(
          settingsForProductOwner(
            expandInput.settings,
            productTypeId,
            ownerByProduct,
            planSkillSources,
          ),
        ),
      slotTotals,
      ...(activeSettings.includeInventory ? { pooledStock: locationInventory } : {}),
    }
  }, [
    expandInput,
    activeTemplate,
    activeSettings.skills,
    activeSettings.includeInventory,
    locationInventory,
    ownerByProduct,
    planSkillSources,
    planResolvedCrew,
  ])

  const settingsForRootJobTime = useCallback(
    (productTypeId: number) =>
      settingsForProductOwner(activeSettings, productTypeId, ownerByProduct, planSkillSources),
    [activeSettings, ownerByProduct, planSkillSources],
  )

  const overallRootsKey = useMemo(
    () => (storeTemplate ? planRootsKey(storeTemplate.roots) : ''),
    [storeTemplate],
  )

  const planProfitOptions = useMemo(
    () => ({
      hasReliablePrices: plan.hasReliablePrices,
      scheduledWindowHours:
        activeTemplate?.durationMode === 'overall' ? plan.productionWindowHours : undefined,
      priceMethod: activeSettings.priceMethod ?? DEFAULT_SETTINGS.priceMethod,
    }),
    [
      plan.hasReliablePrices,
      plan.productionWindowHours,
      activeTemplate?.durationMode,
      activeSettings.priceMethod,
    ],
  )

  const slotBonuses = useMemo(
    () => planSlotBonusesFromManufacturingTemplate(activeTemplate ?? undefined),
    [activeTemplate],
  )

  const handleAddPlanSlot = useCallback(
    (pool: 'manufacturing' | 'reactions' | 'research', characterKey?: string) => {
      if (isSharedView || !storeTemplate) return
      if (characterKey) {
        updatePlanTemplate(storeTemplate.id, {
          characterSlotBonus: bumpCharacterSlotBonus(
            storeTemplate.characterSlotBonus,
            characterKey,
            pool,
            1,
          ),
        })
        return
      }
      updatePlanTemplate(storeTemplate.id, bumpPlanWideSlotBonus(storeTemplate, pool, 1))
    },
    [isSharedView, storeTemplate, updatePlanTemplate],
  )

  const handleRemovePlanSlot = useCallback(
    (pool: 'manufacturing' | 'reactions' | 'research', characterKey?: string) => {
      if (isSharedView || !storeTemplate) return
      if (characterKey) {
        updatePlanTemplate(storeTemplate.id, {
          characterSlotBonus: bumpCharacterSlotBonus(
            storeTemplate.characterSlotBonus,
            characterKey,
            pool,
            -1,
          ),
        })
        return
      }
      updatePlanTemplate(storeTemplate.id, bumpPlanWideSlotBonus(storeTemplate, pool, -1))
    },
    [isSharedView, storeTemplate, updatePlanTemplate],
  )

  const onPlanEconomicsChange = useCallback(
    (patch: Partial<EconomicsFilterValues>) => {
      updateSettings(patch)
    },
    [updateSettings],
  )

  const slots = plan.slots

  const planRefreshing = useDataStatusStore((s) => s.refreshing.plan || s.refreshing.characters)

  const handlePlanRefresh = useCallback(async () => {
    if (planSsoCharacterIds.length === 0) return
    await refreshData('plan', planSsoCharacterIds, {
      productionLocationId,
    })
  }, [planSsoCharacterIds, productionLocationId])

  const profitSummary = useMemo(() => {
    if (!activeTemplate || !profitExpandInput) {
      return {
        setupCost: 0,
        netRevenue: 0,
        netProfit: 0,
        margin: 0,
        iph: 0,
        jobHours: 0,
        rootRows: [],
        hasPrices: false,
      }
    }

    const jobTimeHoursByRootId = new Map(
      activeTemplate.roots.map((root) => {
        const bp = getBlueprintForProduct(blueprints, root.productTypeId)
        const hours = bp
          ? rootJobTimeHours(
              root,
              bp,
              settingsForRootJobTime(root.productTypeId),
              activeTemplate.nodeOverrides[root.productTypeId],
            )
          : root.productionDurationHours
        return [root.id, hours] as const
      }),
    )

    return computePlanProfitSummary(
      activeTemplate,
      profitExpandInput,
      sellPrices,
      buyPrices,
      jobTimeHoursByRootId,
      planProfitOptions,
    )
  }, [
    activeTemplate,
    profitExpandInput,
    sellPrices,
    buyPrices,
    blueprints,
    settingsForRootJobTime,
    planProfitOptions,
  ])

  const profitByRootId = useMemo(
    () => new Map(profitSummary.rootRows.map((row) => [row.rootId, row])),
    [profitSummary.rootRows],
  )

  const setupDetailBreakdown = useMemo(() => {
    if (!setupDetailRootId || !activeTemplate || !profitExpandInput) return null
    const root = activeTemplate.roots.find((r) => r.id === setupDetailRootId)
    if (!root) return null
    const blueprint = getBlueprintForProduct(blueprints, root.productTypeId)
    if (!blueprint) return null
    const productName = typeMap.get(root.productTypeId)?.name ?? `Type ${root.productTypeId}`
    return computeRootSetupBreakdown(
      root,
      blueprint,
      profitExpandInput,
      productName,
      planProfitOptions,
    )
  }, [setupDetailRootId, activeTemplate, profitExpandInput, blueprints, typeMap, planProfitOptions])

  const profitDetailBreakdown = useMemo(() => {
    if (!profitDetailRootId || !activeTemplate || !profitExpandInput) return null
    const root = activeTemplate.roots.find((r) => r.id === profitDetailRootId)
    if (!root) return null
    const blueprint = getBlueprintForProduct(blueprints, root.productTypeId)
    if (!blueprint) return null
    const productName = typeMap.get(root.productTypeId)?.name ?? `Type ${root.productTypeId}`
    const jobHours = rootJobTimeHours(
      root,
      blueprint,
      settingsForRootJobTime(root.productTypeId),
      activeTemplate.nodeOverrides[root.productTypeId],
    )
    return computeRootProfitBreakdown(
      root,
      blueprint,
      profitExpandInput,
      sellPrices,
      buyPrices,
      jobHours,
      productName,
      planProfitOptions,
    )
  }, [
    profitDetailRootId,
    activeTemplate,
    profitExpandInput,
    blueprints,
    typeMap,
    sellPrices,
    buyPrices,
    settingsForRootJobTime,
    planProfitOptions,
  ])

  const favoriteProductIds = useMemo(() => watchlist.map((w) => w.productTypeId), [watchlist])

  const planNodesByProductId = useMemo(
    () => new Map(plan.nodes.map((n) => [n.productTypeId, n])),
    [plan.nodes],
  )

  const blueprintTypeIdByProduct = useMemo(() => {
    const map = new Map<number, number>()
    for (const bp of blueprints) {
      map.set(bp.productTypeId, bp.blueprintTypeId)
    }
    return map
  }, [blueprints])

  const buildRows = useMemo(() => {
    if (!activeTemplate) return []

    const slotCounts = {
      manufacturing: plan.slots,
      reactions: plan.reactionSlots,
      research: plan.scienceSlots,
    }
    const nodeOverrides = activeTemplate.nodeOverrides
    const enabledRoots = activePlanRoots(activeTemplate.roots)

    const nonRootBuild = plan.nodes.filter((n) => n.mode === 'build' && !n.isRoot)
    const subExpandable = flattenPlanNodesExpandable(nonRootBuild, 'build-blueprints')

    const rootCounts = new Map<number, number>()
    for (const root of activeTemplate.roots) {
      rootCounts.set(root.productTypeId, (rootCounts.get(root.productTypeId) ?? 0) + 1)
    }
    const rootSeen = new Map<number, number>()

    const stockRowFields = (productTypeId: number, grossDemandQty: number) => ({
      grossDemandQty,
      haveQty: inventoryLoaded ? (locationInventory.get(productTypeId) ?? 0) : undefined,
    })

    const rootRows = activeTemplate.roots.flatMap((root) => {
      const bp = getBlueprintForProduct(blueprints, root.productTypeId)
      if (!bp) return []
      const name = typeMap.get(root.productTypeId)?.name ?? `Type ${root.productTypeId}`
      const node = displayNodeForRoot(root, name, bp, planNodesByProductId.get(root.productTypeId))
      const override = nodeOverrides[root.productTypeId]
      const rootOutput = root.runs * bp.productQuantity

      const instance = (rootSeen.get(root.productTypeId) ?? 0) + 1
      rootSeen.set(root.productTypeId, instance)
      const instanceTotal = rootCounts.get(root.productTypeId) ?? 1

      const rootOwner = displayOwnerForProduct(
        root.productTypeId,
        true,
        root,
        override,
        ownerByProduct,
      )

      return [
        {
          kind: 'leaf' as const,
          rootId: root.id,
          rootInstance: instance,
          rootInstanceTotal: instanceTotal,
          node,
          depth: 0,
          ancestorCollapseKeys: [] as string[],
          productTypeId: root.productTypeId,
          blueprintTypeId: blueprintTypeIdByProduct.get(root.productTypeId),
          name,
          runs: root.runs,
          durationHours: root.productionDurationHours,
          jobTimeHours: bp
            ? rootJobTimeHours(root, bp, settingsForRootJobTime(root.productTypeId), override)
            : root.productionDurationHours,
          outputQty: rootOutput,
          ...stockRowFields(root.productTypeId, rootOutput),
          isRoot: true,
          enabled: root.enabled !== false,
          bpos: 1,
          runsFromDuration: root.runsFromDuration,
          runsFromReadyBy: root.runsFromReadyBy,
          haveBpcs: override?.haveBpcs,
          characterKey: rootOwner.characterKey,
          ownerInherited: rootOwner.inherited,
        },
      ]
    })

    const subRows = subExpandable.map((row) => {
      const productTypeId = row.node.productTypeId
      const override = nodeOverrides[productTypeId]
      const bp = getBlueprintForProduct(blueprints, productTypeId)
      const bpos = override?.copies ?? row.node.concurrentCopies
      const suggestion =
        bp &&
        suggestBlueprintLines({
          node: row.node,
          blueprint: bp,
          settings: activeSettings,
          roots: enabledRoots,
          nodes: plan.nodes,
          blueprints,
          nodeOverrides,
          slots: slotCounts,
          prices: buyPrices,
        })

      const childOwner = displayOwnerForProduct(
        productTypeId,
        false,
        undefined,
        override,
        ownerByProduct,
      )

      return {
        ...row,
        rootId: undefined as string | undefined,
        productTypeId,
        blueprintTypeId: blueprintTypeIdByProduct.get(productTypeId),
        name: row.node.name,
        runs: row.node.runs,
        jobTimeHours: row.node.jobTimeSeconds / 3600,
        outputQty: row.node.outputQty,
        ...stockRowFields(productTypeId, row.node.grossDemandQty ?? row.node.outputQty),
        isRoot: false,
        depth: row.depth + 1,
        bpos,
        suggestedBpos: suggestion?.copies,
        suggestedCopyBpos: suggestion?.copyBpos,
        copyBpos: override?.copyBpos,
        haveBpcs: override?.haveBpcs,
        characterKey: childOwner.characterKey,
        ownerInherited: childOwner.inherited,
        bposHint: suggestion?.inventionBottleneck
          ? 'Invention still exceeds root job time; add science slots or lower runs.'
          : undefined,
      }
    })

    return withTreeLineMeta([...rootRows, ...subRows])
  }, [
    activeTemplate,
    planNodesByProductId,
    plan.nodes,
    plan.slots,
    plan.reactionSlots,
    plan.scienceSlots,
    blueprints,
    typeMap,
    blueprintTypeIdByProduct,
    activeSettings,
    buyPrices,
    ownerByProduct,
    settingsForRootJobTime,
    inventoryLoaded,
    locationInventory,
  ])

  const handleSetPlanOwner = useCallback(
    (target: { rootId?: string; productTypeId: number }, key?: PlanCharacterKey) => {
      const template = selectedPlanTemplateFromStore()
      if (!template) return

      const previousKey = target.rootId
        ? template.roots.find((root) => root.id === target.rootId)?.characterKey
        : template.nodeOverrides[target.productTypeId]?.characterKey

      let draft = template
      const patch: Partial<ManufacturingPlanTemplate> = {}
      if (key) {
        Object.assign(patch, addPlanCharacter(draft, key))
        draft = { ...draft, ...patch }
        const name = planCharacterOptions.find((option) => option.key === key)?.name
        if (name) {
          Object.assign(patch, mergePlanCharacterNames(draft, { [key]: name }))
          draft = { ...draft, ...patch }
        }
      }
      if (target.rootId) {
        Object.assign(patch, setRootOwner(draft, target.rootId, key))
      } else {
        const inherited = ownerByProduct.get(target.productTypeId)
        const pinKey = key && inherited !== 'auto' && key === inherited ? undefined : key
        Object.assign(patch, setNodeOwner(draft, target.productTypeId, pinKey))
      }
      draft = { ...draft, ...patch }

      // A previous owner with no remaining pins should leave the timeline
      if (previousKey && previousKey !== key) {
        Object.assign(patch, dropUnpinnedPlanCharacter(draft, previousKey))
        draft = { ...draft, ...patch }
      }

      const validKeys = planOwnerValidKeys(
        draft,
        planCharacterOptions.map((option) => option.key),
      )
      const nextOwnerByProduct = buildOwnerByProduct(
        plan.nodes,
        draft.roots,
        draft.nodeOverrides,
        validKeys,
      )
      const skillSources = {
        sso: authCharacters.map((c) => ({
          characterId: c.characterId,
          characterName: c.characterName,
          skills: c.skills ?? c.trainedSkills,
        })),
        manual: manualCharacters ?? [],
      }
      Object.assign(
        patch,
        syncPlanRunsAfterOwnerChange(
          draft,
          plan.nodes,
          blueprints,
          storeSettings,
          skillSources,
          nextOwnerByProduct,
          target,
          draft.durationMode,
        ),
      )
      draft = { ...draft, ...patch }

      if (draft.durationMode === 'overall' && data) {
        overallFitPassRef.current = { key: '', passes: 0 }
        const scheduled = buildManufacturingPlanSchedule({
          template: draft,
          blueprints,
          typeMap,
          prices,
          settings: storeSettings,
          systemCostIndex,
          reactionCostIndex,
          systems: data.systems,
          skillSources,
          ...(storeSettings.includeInventory ? { pooledStock: locationInventory } : {}),
        })
        Object.assign(
          patch,
          fitOverallPlanToProductionSchedule(
            draft,
            scheduled.productionJobs,
            scheduled.nodes,
            blueprints,
            storeSettings,
          ),
        )
      }

      updatePlanTemplate(template.id, patch)
    },
    [
      ownerByProduct,
      updatePlanTemplate,
      plan.nodes,
      planCharacterOptions,
      authCharacters,
      manualCharacters,
      blueprints,
      storeSettings,
      data,
      typeMap,
      prices,
      systemCostIndex,
      reactionCostIndex,
      locationInventory,
    ],
  )

  const manufactureRows = useMemo(() => {
    if (!activeTemplate) return []
    return buildManufactureDisplayRows(
      plan.nodes,
      activePlanRoots(activeTemplate.roots),
      (id) => getBlueprintForProduct(blueprints, id),
      activeSettings,
      slots,
      activeTemplate.defaultRunsPerBpc,
      activeTemplate.nodeOverrides,
    )
  }, [activeTemplate, plan.nodes, blueprints, activeSettings, slots])

  useEffect(() => {
    if (isSharedView) return
    if (templates.length === 0) return
    if (!selectedId || !templates.some((t) => t.id === selectedId)) {
      setSelectedId(templates[0].id)
    }
  }, [templates, selectedId, setSelectedId, isSharedView])

  useEffect(() => {
    let cancelled = false

    async function loadSharedHash() {
      const hash = window.location.hash
      if (!hash.includes('plan=')) {
        setSharedView(null)
        setShareLinkError(false)
        setSharedHashLoading(false)
        return
      }

      setSharedHashLoading(true)
      const payload = await parsePlanShareHash(hash)
      if (cancelled) return

      if (payload) {
        setSharedView({
          template: sharedPayloadToTemplate(payload),
          settings: normalizeSharedSettings(payload.settings),
        })
        setShareLinkError(false)
      } else {
        setSharedView(null)
        setShareLinkError(true)
      }
      setSharedHashLoading(false)
    }

    void loadSharedHash()
    window.addEventListener('hashchange', loadSharedHash)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', loadSharedHash)
    }
  }, [])

  const exitSharedView = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    params.delete('add')
    const search = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (search ? `?${search}` : ''))
    setSharedView(null)
    setShareLinkError(false)
  }, [])

  const saveSharedToMyPlans = useCallback(() => {
    if (!sharedView) return
    importSharedPlan(sharedView.template, sharedView.settings)
    exitSharedView()
  }, [sharedView, importSharedPlan, exitSharedView])

  const copyShareLink = useCallback(async () => {
    if (!storeTemplate || isSharedView) return
    try {
      const payload = buildPlanSharePayload(storeTemplate, storeSettings)
      const url = await planShareUrl(payload, searchParams)
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2000)
    } catch {
      setShareCopied(false)
    }
  }, [storeTemplate, isSharedView, storeSettings, searchParams])

  useEffect(() => {
    if (blockStoreMutations || !data || !selectedId) return
    const template = useAppStore.getState().userData.planTemplates?.find((t) => t.id === selectedId)
    if (!template) return

    let needsUpdate = false
    const nextRoots = template.roots.map((root) => {
      const bp = getBlueprintForProduct(blueprints, root.productTypeId)
      const synced = syncRootEntry(
        root,
        bp,
        storeSettings,
        template.nodeOverrides[root.productTypeId],
      )
      if (synced !== root) needsUpdate = true
      return synced
    })
    if (needsUpdate) {
      updatePlanTemplate(template.id, { roots: nextRoots })
    }
  }, [selectedId, data, blueprints, storeSettings, updatePlanTemplate, blockStoreMutations])

  /* ----- Keep Overall runs fitted to the live production schedule ----- */
  useEffect(() => {
    if (blockStoreMutations || !storeTemplate) return
    if (storeTemplate.durationMode !== 'overall') {
      overallRootsKeyRef.current = overallRootsKey
      overallFitPassRef.current = { key: '', passes: 0 }
      return
    }
    if (activePlanRoots(storeTemplate.roots).length === 0) {
      overallRootsKeyRef.current = overallRootsKey
      return
    }

    const getBlueprint = (id: number) => getBlueprintForProduct(blueprints, id)
    const rootsKeyChanged = overallRootsKeyRef.current !== overallRootsKey
    overallRootsKeyRef.current = overallRootsKey

    // Root add/remove/enable changed membership — reset runs from duration before refit
    if (rootsKeyChanged) {
      overallFitPassRef.current = { key: '', passes: 0 }
      const resetRoots = resetPlanRootsFromDuration(
        storeTemplate.roots,
        storeSettings,
        storeTemplate.nodeOverrides,
        getBlueprint,
      )
      const runsChanged = resetRoots.some(
        (root, index) => root.runs !== storeTemplate.roots[index]?.runs,
      )
      if (runsChanged) {
        updatePlanTemplate(storeTemplate.id, { roots: resetRoots })
        return
      }
    }

    // Cap writes: a barely-late chain can shrink 1 run per commit and freeze the tab
    const fitKey = overallFitInputKey(storeTemplate, storeSettings)
    const pass = overallFitPassState(overallFitPassRef.current, fitKey)
    overallFitPassRef.current = { key: pass.key, passes: pass.passes }
    if (!pass.allow) return

    const targets = overallDeadlineTargets(storeTemplate.roots)
    if (targets.length === 0) return

    const { roots, nodeOverrides } = fitPlanForOverallDeadlines({
      roots: storeTemplate.roots,
      nodeOverrides: storeTemplate.nodeOverrides,
      targets,
      readyHoursByProductId: readyHoursByProductIdFromJobs(plan.productionJobs),
      nodes: plan.nodes,
      settings: storeSettings,
      getBlueprint,
    })

    if (
      !overallPlanFitChanged(
        { roots: storeTemplate.roots, nodeOverrides: storeTemplate.nodeOverrides },
        { roots, nodeOverrides },
      )
    ) {
      return
    }

    overallFitPassRef.current = { key: pass.key, passes: pass.passes + 1 }
    updatePlanTemplate(storeTemplate.id, { roots, nodeOverrides })
  }, [
    blockStoreMutations,
    storeTemplate,
    overallRootsKey,
    plan.productionJobs,
    plan.nodes,
    blueprints,
    storeSettings,
    updatePlanTemplate,
  ])

  useEffect(() => {
    if (blockStoreMutations || !addProductId || !data || !storeTemplate) return
    const key = `${storeTemplate.id}:${addProductId}`
    if (handledAddRef.current === key) return

    const id = Number(addProductId)
    if (!Number.isFinite(id)) return
    const bp = getBlueprintForProduct(blueprints, id)
    if (!bp) return

    handledAddRef.current = key
    addRootToPlanTemplate(storeTemplate.id, {
      id: createPlanRootId(),
      ...createSyncedPlanRootEntry(id, bp, storeSettings),
    })
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('add')
        return next
      },
      { replace: true },
    )
  }, [
    addProductId,
    data,
    storeTemplate,
    blueprints,
    addRootToPlanTemplate,
    storeSettings,
    setSearchParams,
    blockStoreMutations,
  ])

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
      if (isSharedView) return
      const { userData, selectedPlanTemplateId } = useAppStore.getState()
      const template = userData.planTemplates?.find((t) => t.id === selectedPlanTemplateId)
      if (!template) return
      const node = plan.nodes.find((n) => n.productTypeId === productTypeId)
      if (!node?.canToggle || node.isRoot) return
      const currentMode = template.modeOverrides[productTypeId] ?? node.mode
      const next: PlanBuildMode = currentMode === 'build' ? 'buy' : 'build'
      updatePlanTemplate(template.id, {
        modeOverrides: { ...template.modeOverrides, [productTypeId]: next },
      })
    },
    [isSharedView, plan.nodes, updatePlanTemplate],
  )

  const openGraph = useCallback((productTypeId: number) => {
    setGraphProductTypeId(productTypeId)
  }, [])

  const openMeTe = useCallback((productTypeId: number) => {
    setMeTeProductTypeId(productTypeId)
  }, [])

  const saveMeTe = useCallback(
    (productTypeId: number, patch: { me?: number; te?: number } | null) => {
      if (isSharedView) return
      const template = selectedPlanTemplateFromStore()
      if (!template) return

      const current = template.nodeOverrides[productTypeId] ?? {}
      let nextEntry: PlanNodeOverride
      if (patch == null) {
        const { me: _me, te: _te, ...rest } = current
        nextEntry = rest
      } else {
        nextEntry = { ...current, ...patch }
      }

      const nextOverrides = { ...template.nodeOverrides }
      if (Object.keys(nextEntry).length === 0) {
        delete nextOverrides[productTypeId]
      } else {
        nextOverrides[productTypeId] = nextEntry
      }

      const nextRoots = template.roots.map((root) => {
        if (root.productTypeId !== productTypeId) return root
        const bp = getBlueprintForProduct(blueprints, root.productTypeId)
        return syncRootEntry(root, bp, storeSettings, nextOverrides[productTypeId])
      })

      updatePlanTemplate(template.id, {
        nodeOverrides: nextOverrides,
        roots: nextRoots,
      })
    },
    [isSharedView, blueprints, storeSettings, updatePlanTemplate],
  )

  const saveBuyPriceSource = useCallback(
    (productTypeId: number, source: PlanBuyPriceSource | null) => {
      if (isSharedView) return
      const template = selectedPlanTemplateFromStore()
      if (!template) return

      const current = template.nodeOverrides[productTypeId] ?? {}
      const nextEntry = applyPlanBuyPriceSource(current, source, buyHubId)

      const nextOverrides = { ...template.nodeOverrides }
      if (Object.keys(nextEntry).length === 0) {
        delete nextOverrides[productTypeId]
      } else {
        nextOverrides[productTypeId] = nextEntry
      }

      updatePlanTemplate(template.id, {
        nodeOverrides: nextOverrides,
      })
    },
    [isSharedView, updatePlanTemplate, buyHubId],
  )

  const graphBlueprint = useMemo(() => {
    if (graphProductTypeId == null) return null
    return getBlueprintForProduct(blueprints, graphProductTypeId) ?? null
  }, [blueprints, graphProductTypeId])

  const meTeBlueprint = useMemo(() => {
    if (meTeProductTypeId == null) return null
    return getBlueprintForProduct(blueprints, meTeProductTypeId) ?? null
  }, [blueprints, meTeProductTypeId])

  const meTeNodeName = useMemo(() => {
    if (meTeProductTypeId == null) return ''
    return (
      plan.nodes.find((n) => n.productTypeId === meTeProductTypeId)?.name ??
      typeMap.get(meTeProductTypeId)?.name ??
      `Type ${meTeProductTypeId}`
    )
  }, [meTeProductTypeId, plan.nodes, typeMap])

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

  const applyStoredDurationMode = useCallback(
    (mode: PlanDurationMode) => {
      const template = selectedPlanTemplateFromStore()
      if (!template) return

      if (mode === 'overall') {
        const targets = overallDeadlineTargets(template.roots)
        if (targets.length === 0) {
          updatePlanTemplate(template.id, { durationMode: mode })
          return
        }
        const { roots, nodeOverrides } = fitPlanForOverallDeadlines({
          roots: template.roots,
          nodeOverrides: template.nodeOverrides,
          targets,
          readyHoursByProductId: readyHoursByProductIdFromJobs(plan.productionJobs),
          nodes: plan.nodes,
          settings: storeSettings,
          getBlueprint: (id) => getBlueprintForProduct(blueprints, id),
        })
        updatePlanTemplate(template.id, { roots, nodeOverrides, durationMode: mode })
        return
      }

      const validKeys = planOwnerValidKeys(
        template,
        planCharacterOptions.map((option) => option.key),
      )
      const ownerMap = buildOwnerByProduct(
        plan.nodes,
        template.roots,
        template.nodeOverrides,
        validKeys,
      )
      const { roots, nodeOverrides } = syncAllPlanRunsFromStoredDuration(
        template,
        plan.nodes,
        blueprints,
        storeSettings,
        planSkillSources,
        ownerMap,
      )
      updatePlanTemplate(template.id, { roots, nodeOverrides, durationMode: mode })
    },
    [
      plan.productionJobs,
      plan.nodes,
      blueprints,
      storeSettings,
      updatePlanTemplate,
      planCharacterOptions,
      planSkillSources,
    ],
  )

  const fitRootsToReadyDeadlines = useCallback(
    (targets: Array<{ rootId: string; deadlineHours: number }>) => {
      const template = selectedPlanTemplateFromStore()
      if (!template || targets.length === 0) return
      const hoursByRootId = new Map(targets.map((t) => [t.rootId, t.deadlineHours]))
      const stamped = template.roots.map((r) => {
        const hours = hoursByRootId.get(r.id)
        return hours == null ? r : { ...r, productionDurationHours: hours }
      })
      const { roots, nodeOverrides } = fitPlanForOverallDeadlines({
        roots: stamped,
        nodeOverrides: template.nodeOverrides,
        targets,
        readyHoursByProductId: readyHoursByProductIdFromJobs(plan.productionJobs),
        nodes: plan.nodes,
        settings: storeSettings,
        getBlueprint: (id) => getBlueprintForProduct(blueprints, id),
      })
      updatePlanTemplate(template.id, { roots, nodeOverrides })
    },
    [plan.productionJobs, plan.nodes, blueprints, storeSettings, updatePlanTemplate],
  )

  const addRoot = (productTypeId: number) => {
    if (isSharedView) return
    const templateId = useAppStore.getState().selectedPlanTemplateId
    if (!templateId) return
    const bp = getBlueprintForProduct(blueprints, productTypeId)
    if (!bp) return
    addRootToPlanTemplate(templateId, {
      id: createPlanRootId(),
      ...createSyncedPlanRootEntry(productTypeId, bp, storeSettings),
    })
  }

  if (isLoading || !data || sharedHashLoading) return <LoadingState />

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      <PageHeader
        title="Manufacturing plan"
        subtitle={
          isSharedView
            ? 'Viewing a shared plan. Save it to your plans to customize.'
            : 'Templates, build vs buy chain, and when the plan finishes'
        }
        action={
          isSharedView ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={saveSharedToMyPlans}
              >
                Save to my plans
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={exitSharedView}>
                Exit shared view
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => addPlanTemplate()}
            >
              New plan
            </button>
          )
        }
      />

      {!isSharedView ? (
        <PlanTemplateBar
          templates={templates}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReorder={reorderPlanTemplates}
        />
      ) : null}

      {shareLinkError ? (
        <Panel title="Could not open shared plan">
          <p className="text-sm opacity-70">
            The link may be incomplete or corrupted. Ask the sender to copy it again.
          </p>
          <button type="button" className="btn btn-primary btn-sm mt-4" onClick={exitSharedView}>
            Back to my plans
          </button>
        </Panel>
      ) : !activeTemplate ? (
        <Panel title="Get started">
          <p className="text-sm opacity-70">
            Create a plan and add root blueprints by name, then tune runs and job time.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-4"
            onClick={() => addPlanTemplate()}
          >
            New plan
          </button>
        </Panel>
      ) : (
        <div className="flex flex-col gap-5">
          {isSharedView ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-outline border-eve-border">Shared view</span>
              <span className="text-sm opacity-70">
                Read-only until you save it. Hub and facility settings import with the plan; your
                skills stay as-is.
              </span>
            </div>
          ) : null}

          <PlanDetailHeader
            name={activeTemplate.name}
            onRename={
              isSharedView
                ? undefined
                : () => {
                    if (!storeTemplate) return
                    const n = prompt('Plan name', storeTemplate.name)
                    if (n?.trim()) updatePlanTemplate(storeTemplate.id, { name: n.trim() })
                  }
            }
            stats={[
              { label: 'Roots', value: String(activeTemplate.roots.length) },
              { label: 'Nodes', value: String(plan.nodes.length) },
              { label: 'Slots', value: String(slots) },
              { label: 'Timeline', value: `${formatDecimal(plan.productionWindowHours, 1)}h` },
            ]}
            actions={
              isSharedView ? null : (
                <>
                  <IconBtn
                    label={shareCopied ? 'Copied' : 'Copy share link'}
                    onClick={() => void copyShareLink()}
                  >
                    <ShareLinkIcon />
                  </IconBtn>
                  <IconBtn
                    label="Duplicate"
                    onClick={() => storeTemplate && duplicatePlanTemplate(storeTemplate.id)}
                  >
                    <CopyIcon />
                  </IconBtn>
                  <IconBtn
                    label="Delete"
                    danger
                    onClick={() => storeTemplate && deletePlanTemplate(storeTemplate.id)}
                  >
                    <TrashIcon />
                  </IconBtn>
                </>
              )
            }
          />

          <PlanProfitSummaryPanel
            summary={profitSummary}
            buyHubName={buyHubName}
            sellHubName={sellHubName}
            priceMethod={activeSettings.priceMethod ?? DEFAULT_SETTINGS.priceMethod}
            skills={planFeeSkills ?? DEFAULT_SETTINGS.skills}
          />

          <section className="plan-build-card">
            <details className="plan-build-card__details">
              <summary className="plan-build-card__header plan-build-card__summary">
                <h2 className="plan-build-card__title">Settings</h2>
                <span className="plan-build-card__badge">
                  {activePlanRoots(activeTemplate.roots).length} root
                  {activePlanRoots(activeTemplate.roots).length === 1 ? '' : 's'}
                </span>
              </summary>
              <div className="plan-build-card__body">
                {data ? (
                  <div className={isSharedView ? 'pointer-events-none opacity-80' : undefined}>
                    <PlanFacilityControls
                      settings={activeSettings}
                      onChange={isSharedView ? () => {} : updateSettings}
                      systems={data.systems}
                      regions={data.regions}
                      onRefresh={isSharedView ? undefined : () => void handlePlanRefresh()}
                      isRefreshing={planRefreshing}
                    />
                  </div>
                ) : null}
                {!isSharedView ? (
                  <div className="mt-4 flex flex-col gap-2 border-t border-eve-border/40 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wide opacity-50">Seller</span>
                      {planCharacterOptions.length === 0 ? (
                        <p className="text-xs opacity-60">
                          Sign in with EVE or add a manual character in Settings to pick who pays
                          sales tax and broker fees.
                        </p>
                      ) : (
                        <PlanOwnerPicker
                          options={planCharacterOptions}
                          value={activeTemplate.sellerCharacterKey}
                          emptyLabel="Settings"
                          label="Seller for trading fees"
                          onChange={(key) => {
                            const template = selectedPlanTemplateFromStore()
                            if (!template) return
                            updatePlanTemplate(template.id, setSellerCharacterKey(template, key))
                          }}
                        />
                      )}
                    </div>
                    {planCharacterOptions.length > 0 ? (
                      <p className="text-xs opacity-60">
                        Uses this character&apos;s Accounting and Broker Relations for plan profit
                        only. Job owners still use their Industry skills for scheduling.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </details>
          </section>

          <PlanRootList
            compose={
              !isSharedView ? (
                <div className="plan-jobs-compose">
                  <div className="plan-jobs-compose__search">
                    <BlueprintSearchPicker
                      blueprints={blueprints}
                      typeMap={typeMap}
                      favoriteIds={favoriteProductIds}
                      onSelect={addRoot}
                      autoFocus
                      prominent
                      placeholder="Add a blueprint by product name…"
                    />
                  </div>
                  <EconomicsFilterSection
                    layout="bar"
                    barVariant="plan"
                    showPlanRefresh
                    planRefreshCharacterIds={planSsoCharacterIds}
                    planProductionLocationId={productionLocationId}
                    values={{
                      priceMethod: activeSettings.priceMethod ?? DEFAULT_SETTINGS.priceMethod,
                      priceWindow: activeSettings.priceWindow ?? DEFAULT_SETTINGS.priceWindow,
                      includeInventory:
                        activeSettings.includeInventory ?? DEFAULT_SETTINGS.includeInventory,
                    }}
                    onChange={onPlanEconomicsChange}
                  />
                </div>
              ) : undefined
            }
            rows={buildRows}
            typeMap={typeMap}
            profitByRootId={profitByRootId}
            readOnly={isSharedView}
            durationMode={activeTemplate.durationMode === 'overall' ? 'overall' : 'production'}
            onDurationModeChange={isSharedView ? undefined : applyStoredDurationMode}
            planWindowHours={plan.productionWindowHours}
            onOpenSetup={setSetupDetailRootId}
            onOpenProfit={setProfitDetailRootId}
            onOpenGraph={openGraph}
            onOpenMeTe={isSharedView ? undefined : openMeTe}
            onChange={
              isSharedView
                ? undefined
                : (rootId, productTypeId, patch) => {
                    const template = selectedPlanTemplateFromStore()
                    if (!template) return

                    if (
                      patch.productionDurationHours != null &&
                      rootId &&
                      template.durationMode === 'overall'
                    ) {
                      fitRootsToReadyDeadlines([
                        { rootId, deadlineHours: patch.productionDurationHours },
                      ])
                      return
                    }

                    if (rootId) {
                      if (
                        template.durationMode === 'overall' &&
                        patch.runs != null &&
                        patch.productionDurationHours == null
                      ) {
                        return
                      }
                      updatePlanTemplate(template.id, {
                        roots: template.roots.map((r) => {
                          if (r.id !== rootId) return r
                          const bp = getBlueprintForProduct(blueprints, r.productTypeId)
                          const override = template.nodeOverrides[r.productTypeId]
                          return applyRootEntryPatch(r, patch, bp, storeSettings, override, {
                            syncDurationFromRuns:
                              patch.runs != null && patch.productionDurationHours == null,
                            durationMode:
                              template.durationMode === 'overall' ? 'overall' : 'production',
                            readyHours: readyHoursByProductIdFromJobs(plan.productionJobs).get(
                              r.productTypeId,
                            ),
                          })
                        }),
                      })
                      return
                    }

                    const node = plan.nodes.find((n) => n.productTypeId === productTypeId)
                    if (!node) return
                    const bp = getBlueprintForProduct(blueprints, productTypeId)
                    const override = template.nodeOverrides[productTypeId]
                    const nextOverride = applyNodeOverridePatch(override, patch, bp, storeSettings)

                    updatePlanTemplate(template.id, {
                      nodeOverrides: {
                        ...template.nodeOverrides,
                        [productTypeId]: nextOverride,
                      },
                    })
                  }
            }
            onSetBpos={
              isSharedView
                ? undefined
                : (productTypeId, copies) => {
                    const template = selectedPlanTemplateFromStore()
                    if (!template) return
                    updatePlanTemplate(template.id, setNodeCopies(template, productTypeId, copies))
                  }
            }
            onSetCopyBpos={
              isSharedView
                ? undefined
                : (productTypeId, copies) => {
                    const template = selectedPlanTemplateFromStore()
                    if (!template) return
                    updatePlanTemplate(
                      template.id,
                      setT2Options(template, productTypeId, { copyBpos: copies }),
                    )
                  }
            }
            ownerOptions={planCharacterOptions}
            onSetOwner={isSharedView ? undefined : handleSetPlanOwner}
            onSetAllDuration={
              isSharedView
                ? undefined
                : (hours, mode) => {
                    const template = selectedPlanTemplateFromStore()
                    if (!template) return
                    if (mode === 'overall') {
                      fitRootsToReadyDeadlines(
                        template.roots
                          .filter((r) => r.enabled !== false)
                          .map((r) => ({ rootId: r.id, deadlineHours: hours })),
                      )
                      return
                    }
                    const patch = { productionDurationHours: hours }
                    const roots = template.roots.map((r) => {
                      const bp = getBlueprintForProduct(blueprints, r.productTypeId)
                      return applyRootEntryPatch(
                        r,
                        patch,
                        bp,
                        storeSettings,
                        template.nodeOverrides[r.productTypeId],
                      )
                    })
                    updatePlanTemplate(template.id, { roots })
                  }
            }
            onToggleEnabled={
              isSharedView
                ? undefined
                : (rootId, enabled) => {
                    const template = selectedPlanTemplateFromStore()
                    if (!template) return
                    updatePlanTemplate(template.id, {
                      roots: template.roots.map((r) => (r.id === rootId ? { ...r, enabled } : r)),
                    })
                  }
            }
            onDuplicate={
              isSharedView
                ? undefined
                : (rootId) => {
                    const template = selectedPlanTemplateFromStore()
                    if (!template) return
                    updatePlanTemplate(template.id, {
                      roots: duplicatePlanRootAfter(template.roots, rootId, createPlanRootId()),
                    })
                  }
            }
            onRemove={
              isSharedView
                ? undefined
                : (rootId) => storeTemplate && removeRootFromPlanTemplate(storeTemplate.id, rootId)
            }
            onReorder={
              isSharedView
                ? undefined
                : (fromId, toId) => {
                    const template = selectedPlanTemplateFromStore()
                    if (!template) return
                    updatePlanTemplate(template.id, {
                      roots: movePlanRootById(template.roots, fromId, toId),
                    })
                  }
            }
          />

          <PlanTimelinePanel
            windowHours={plan.productionWindowHours}
            researchWindowHours={plan.windowHours}
            nodes={plan.nodes}
            jobs={plan.jobs}
            productionJobs={plan.productionJobs}
            slots={plan.slots}
            scienceSlots={plan.scienceSlots}
            reactionSlots={plan.reactionSlots}
            slotBonuses={slotBonuses}
            characterSlotBonuses={activeTemplate.characterSlotBonus}
            onAddSlot={isSharedView ? undefined : handleAddPlanSlot}
            onRemoveSlot={isSharedView ? undefined : handleRemovePlanSlot}
            blueprintTypeIdByProduct={blueprintTypeIdByProduct}
            planCrew={planGanttCrew}
          />

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
                manufactureRows={manufactureRows}
                planRoots={activePlanRoots(activeTemplate.roots)}
                skillSlots={slots}
                hubPricesByHub={hubPricesByHub}
                hubVolumesByHub={hubVolumesByHub}
                defaultBuyHub={buyHubId}
                nodeOverrides={activeTemplate.nodeOverrides}
                onToggleMode={isSharedView ? undefined : toggleMode}
                onSetBuyPriceSource={isSharedView ? undefined : saveBuyPriceSource}
                onOpenGraph={openGraph}
                onOpenMeTe={openMeTe}
                blueprintTypeIdByProduct={blueprintTypeIdByProduct}
                typeMap={typeMap}
                inventoryByTypeId={inventoryLoaded ? locationInventory : null}
                inventoryNettedInExpand={activeSettings.includeInventory === true}
              />
            ) : null}

            {tab === 'pipeline' ? (
              <PlanPipelineChecklist
                pipeline={plan.pipeline}
                typeMap={typeMap}
                onOpenMeTe={isSharedView ? undefined : openMeTe}
              />
            ) : null}

            {tab === 'graph' ? (
              <PlanGraphView
                nodes={plan.nodes}
                onToggleMode={isSharedView ? undefined : toggleMode}
                blueprintTypeIdByProduct={blueprintTypeIdByProduct}
                simulations={plan.simulations}
                windowHours={plan.windowHours}
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
                  onToggleMode={isSharedView ? undefined : toggleMode}
                  blueprintTypeIdByProduct={blueprintTypeIdByProduct}
                  simulations={plan.simulations}
                  windowHours={plan.windowHours}
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
      )}

      {graphBlueprint ? (
        <BlueprintGraphModal
          variant="modal"
          blueprint={graphBlueprint}
          buyHub={buyHubId}
          sellHub={sellHubId}
          settings={manufacturingSettings}
          getPlanRuns={getPlanRuns}
          onClose={() => setGraphProductTypeId(null)}
          onOpenPage={openGraphPage}
        />
      ) : null}

      {meTeBlueprint && meTeProductTypeId != null && activeTemplate && !isSharedView ? (
        <PlanMeTeModal
          blueprint={meTeBlueprint}
          name={meTeNodeName}
          settings={activeSettings}
          nodeOverride={activeTemplate.nodeOverrides[meTeProductTypeId]}
          onChange={(patch) => saveMeTe(meTeProductTypeId, patch)}
          onClose={() => setMeTeProductTypeId(null)}
        />
      ) : null}

      <PlanRootSetupModal
        breakdown={setupDetailBreakdown}
        onClose={() => setSetupDetailRootId(null)}
      />

      <PlanRootProfitModal
        breakdown={profitDetailBreakdown}
        onClose={() => setProfitDetailRootId(null)}
      />
    </div>
  )
}
