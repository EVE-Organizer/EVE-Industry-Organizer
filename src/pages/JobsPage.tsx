import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, LoadingState } from '@/components/Layout'
import { Panel } from '@/components/Panel'
import { BlueprintGraphModal } from '@/components/BlueprintGraphModal'
import { TabRail } from '@/components/TabRail'
import { CharacterAvatar } from '@/components/EveImage'
import { SlotGanttChart } from '@/components/gantt/SlotGanttChart'
import { PlanBlueprintItemName } from '@/components/plan/PlanBlueprintItemName'
import { PlanProductIcon, PLAN_ROW_ICON_SIZE } from '@/components/plan/PlanProductIcon'
import { ManufacturingSlotsRow } from '@/components/plan/ManufacturingSlotRing'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { useCharacterIndustryJobs, useCharacterBlueprints } from '@/hooks/useCharacterIndustryData'
import { getCachedCharacterIndustryJobs } from '@/services/character/characterIndustryJobsService'
import { useSdeData } from '@/hooks/useSdeData'
import { manufacturingSlotsFromSkills } from '@/lib/manufacturingSlots'
import {
  filterJobsByTab,
  LIVE_JOBS_TAB_ICON_TYPE_ID,
  researchSlotsEstimate,
  type LiveJobsTab,
} from '@/lib/liveJobCategories'
import {
  enrichLiveJobs,
  iconTypeIdMapFromJobs,
  RESEARCH_KIND_LABELS,
  RESEARCH_KIND_TITLES,
  timelineJobsFromDisplay,
  type DisplayLiveJob,
} from '@/lib/liveJobDisplay'
import {
  buildLiveTimelineWindow,
  formatCountdown,
  formatLiveTick,
  liveJobsToGanttLanes,
} from '@/lib/liveTimelineAdapter'
import { productionGraphRoute } from '@/lib/paths'
import { formatDecimal } from '@/lib/profit'
import { typeIconUrl } from '@/lib/eveImages'
import { getAllBlueprints, getBlueprintForProduct } from '@/services/data/sdeLoader'
import { DEFAULT_BATCH_SIZE } from '@/types'
import type { LiveIndustryJob } from '@/types'
import type { GanttBar } from '@/components/gantt/ganttTypes'

const JOB_TABS: { id: LiveJobsTab; label: string; hint: string }[] = [
  { id: 'manufacturing', label: 'Manufacturing', hint: 'Production and reaction jobs' },
  { id: 'research', label: 'Research', hint: 'ME, TE, and copying jobs' },
]

function JobTabIcon({ tab }: { tab: LiveJobsTab }) {
  return (
    <img
      src={typeIconUrl(LIVE_JOBS_TAB_ICON_TYPE_ID[tab], 32)}
      alt=""
      width={16}
      height={16}
      className="w-4 h-4 shrink-0 rounded-sm"
      loading="lazy"
    />
  )
}

function ResearchKindBadge({ kind }: { kind: DisplayLiveJob['researchKind'] }) {
  if (!kind) return null
  return (
    <span className="badge badge-info badge-xs shrink-0" title={RESEARCH_KIND_TITLES[kind]}>
      {RESEARCH_KIND_LABELS[kind]}
    </span>
  )
}

function JobListRow({
  job,
  nowMs,
  researchTab,
  selected,
  onSelect,
  onOpenGraph,
}: {
  job: DisplayLiveJob
  nowMs: number
  researchTab: boolean
  selected: boolean
  onSelect: () => void
  onOpenGraph: (productTypeId: number) => void
}) {
  return (
    <tr
      className={`cursor-pointer transition-colors${selected ? ' bg-primary/10' : ' hover:bg-base-300/20'}`}
      onClick={onSelect}
    >
      <td className="py-2">
        <div className="flex items-start gap-2 min-w-0">
          <PlanProductIcon
            productTypeId={job.iconProductTypeId}
            blueprintTypeId={job.iconBlueprintTypeId}
            size={PLAN_ROW_ICON_SIZE}
            alt={job.itemName}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <PlanBlueprintItemName
                node={{
                  productTypeId: job.iconProductTypeId,
                  name: job.itemName,
                  canToggle: true,
                  isRoot: false,
                }}
                onOpenGraph={onOpenGraph}
              />
              <ResearchKindBadge kind={job.researchKind} />
            </div>
            <p className="text-[11px] opacity-60">
              {job.researchProgress ?? (job.researchKind ? RESEARCH_KIND_TITLES[job.researchKind] : job.activityLabel)}
            </p>
          </div>
        </div>
      </td>
      <td className="tabular-nums text-sm py-2">
        {researchTab && job.researchKind
          ? (job.researchProgress ?? RESEARCH_KIND_LABELS[job.researchKind])
          : formatDecimal(job.runs, 0)}
      </td>
      <td className="text-sm py-2 capitalize">{job.status}</td>
      <td className="tabular-nums text-sm py-2">{formatCountdown(job.endAt, nowMs)}</td>
    </tr>
  )
}

export function JobsPage() {
  const navigate = useNavigate()
  const configured = useAuthStore((s) => s.configured)
  const characters = useAuthStore((s) => s.characters)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const login = useAuthStore((s) => s.login)
  const switchCharacter = useAuthStore((s) => s.switchCharacter)
  const isBusy = useAuthStore((s) => s.isBusy)
  const settings = useAppStore((s) => s.userData.settings)

  const manufacturingSettings = useMemo(
    () => ({
      ...settings,
      batchSize: DEFAULT_BATCH_SIZE,
    }),
    [settings],
  )

  const [viewCharacterId, setViewCharacterId] = useState<number | null>(activeCharacterId)
  const [focusedSlotIndex, setFocusedSlotIndex] = useState<number | null>(null)
  const [graphProductTypeId, setGraphProductTypeId] = useState<number | null>(null)
  const timelineRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (viewCharacterId == null && activeCharacterId != null) {
      setViewCharacterId(activeCharacterId)
    }
  }, [activeCharacterId, viewCharacterId])

  const { data: sdeData, isLoading: sdeLoading } = useSdeData()
  const typeNameMap = useMemo(() => {
    if (!sdeData) return new Map<number, string>()
    return new Map(sdeData.types.map((type) => [type.typeId, type.name]))
  }, [sdeData])

  const blueprintByBpo = useMemo(() => {
    if (!sdeData) return undefined
    return new Map(getAllBlueprints(sdeData.registry).map((bp) => [bp.blueprintTypeId, bp]))
  }, [sdeData])

  const { missing, hasAll, granted } = useAuthScopes(viewCharacterId)
  const {
    data: rawJobs = [],
    isLoading: jobsLoading,
    error: jobsError,
    refetch,
    isFetching,
  } = useCharacterIndustryJobs(viewCharacterId)
  const { data: blueprintByItemId } = useCharacterBlueprints(viewCharacterId, granted)

  const activeJobCountByCharacter = useMemo(() => {
    const map = new Map<number, number>()
    const activeCount = (jobs: { status: string }[]) =>
      jobs.filter((j) => j.status === 'active' || j.status === 'ready' || j.status === 'paused').length

    for (const character of characters) {
      if (character.characterId === viewCharacterId) {
        map.set(character.characterId, activeCount(rawJobs))
      } else {
        const cached = getCachedCharacterIndustryJobs(character.characterId)
        map.set(character.characterId, cached ? activeCount(cached) : 0)
      }
    }
    return map
  }, [characters, viewCharacterId, rawJobs])

  const jobs = useMemo(
    () => enrichLiveJobs(rawJobs, typeNameMap, blueprintByBpo, blueprintByItemId),
    [rawJobs, typeNameMap, blueprintByBpo, blueprintByItemId],
  )

  const viewCharacter = characters.find((c) => c.characterId === viewCharacterId) ?? null
  const manufacturingSlots = manufacturingSlotsFromSkills(viewCharacter?.skills)
  const [activeTab, setActiveTab] = useState<LiveJobsTab>('manufacturing')
  const [nowMs, setNowMs] = useState(() => Date.now())

  const tabJobs = useMemo(() => filterJobsByTab(jobs, activeTab), [jobs, activeTab])
  const timelineJobs = useMemo(() => timelineJobsFromDisplay(tabJobs), [tabJobs])

  useEffect(() => {
    const timer = globalThis.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => globalThis.clearInterval(timer)
  }, [])

  const activeTabJobs = useMemo(
    () => tabJobs.filter((j) => j.status === 'active' || j.status === 'ready' || j.status === 'paused'),
    [tabJobs],
  )

  const slots =
    activeTab === 'manufacturing' ? manufacturingSlots : researchSlotsEstimate(activeTabJobs)

  const blueprintTypeIdByProduct = useMemo(() => iconTypeIdMapFromJobs(tabJobs), [tabJobs])

  const timelineWindow = useMemo(() => buildLiveTimelineWindow(timelineJobs, nowMs), [timelineJobs, nowMs])
  const lanes = useMemo(
    () => liveJobsToGanttLanes(timelineJobs, slots, timelineWindow),
    [timelineJobs, slots, timelineWindow],
  )
  const nowRatio = (nowMs - timelineWindow.startMs) / timelineWindow.spanMs

  const jobIdToSlot = useMemo(() => {
    const map = new Map<number, number>()
    lanes.forEach((lane, slotIndex) => {
      for (const bar of lane.bars) {
        const job = bar.meta?.job as LiveIndustryJob | undefined
        if (job) map.set(job.jobId, slotIndex)
      }
    })
    return map
  }, [lanes])

  const focusedLaneId = focusedSlotIndex != null ? `slot-${focusedSlotIndex}` : null

  const handleSelectSlot = useCallback((slotIndex: number) => {
    setFocusedSlotIndex((prev) => (prev === slotIndex ? null : slotIndex))
  }, [])

  const handleSelectJob = useCallback(
    (jobId: number) => {
      const slotIndex = jobIdToSlot.get(jobId)
      if (slotIndex == null) return
      setFocusedSlotIndex((prev) => (prev === slotIndex ? null : slotIndex))
      timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
    [jobIdToSlot],
  )

  const handleFocusedLaneChange = useCallback((laneId: string | null) => {
    if (laneId == null) {
      setFocusedSlotIndex(null)
      return
    }
    const match = /^slot-(\d+)$/.exec(laneId)
    if (match) setFocusedSlotIndex(Number(match[1]))
  }, [])

  const openGraph = useCallback((productTypeId: number) => {
    setGraphProductTypeId(productTypeId)
  }, [])

  const openGraphPage = useCallback(
    (productTypeId: number) => {
      navigate(productionGraphRoute(productTypeId))
      setGraphProductTypeId(null)
    },
    [navigate],
  )

  const graphBlueprint = useMemo(() => {
    if (graphProductTypeId == null || !sdeData) return null
    return getBlueprintForProduct(getAllBlueprints(sdeData.registry), graphProductTypeId) ?? null
  }, [graphProductTypeId, sdeData])

  useEffect(() => {
    setFocusedSlotIndex(null)
  }, [activeTab, viewCharacterId])

  const formatTick = useCallback(
    (ratio: number) => formatLiveTick(ratio, timelineWindow),
    [timelineWindow],
  )

  const formatBarRange = useCallback((bar: GanttBar) => {
    const job = bar.meta?.job as LiveIndustryJob | undefined
    if (!job) return ''
    const start = new Date(job.startAt).toLocaleString()
    const end = new Date(job.endAt).toLocaleString()
    return `${start} – ${end}`
  }, [])

  const formatBarMeta = useCallback(
    (bar: GanttBar) => {
      const job = bar.meta?.job as LiveIndustryJob | undefined
      if (!job) return ''
      const display = tabJobs.find((entry) => entry.jobId === job.jobId)
      const progress = display?.researchProgress
      const prefix = progress ? `${progress} · ` : display?.researchKind ? `${RESEARCH_KIND_TITLES[display.researchKind]} · ` : ''
      return `${prefix}${formatDecimal(job.runs, 0)} runs · ${formatCountdown(job.endAt, nowMs)} left`
    },
    [nowMs, tabJobs],
  )

  const slotRingProps = useMemo(
    () =>
      lanes.map((lane, index) => {
        const firstJob = lane.bars[0]?.meta?.job as DisplayLiveJob | undefined
        const displayJob = firstJob
          ? tabJobs.find((job) => job.jobId === firstJob.jobId)
          : undefined
        return {
          slotIndex: index,
          active: lane.jobCount > 0,
          utilization: timelineWindow.spanMs > 0 ? lane.busyHours / (timelineWindow.spanMs / (60 * 60 * 1000)) : 0,
          productTypeId: displayJob?.iconProductTypeId ?? lane.bars[0]?.productTypeId,
          blueprintTypeId: displayJob?.iconBlueprintTypeId,
          productName: lane.bars[0]?.label,
          idleMessage: 'No active job',
        }
      }),
    [lanes, timelineWindow.spanMs, tabJobs],
  )

  const manufacturingActiveCount = useMemo(
    () =>
      filterJobsByTab(jobs, 'manufacturing').filter(
        (j) => j.status === 'active' || j.status === 'ready' || j.status === 'paused',
      ).length,
    [jobs],
  )

  const researchActiveCount = useMemo(
    () =>
      filterJobsByTab(jobs, 'research').filter(
        (j) => j.status === 'active' || j.status === 'ready' || j.status === 'paused',
      ).length,
    [jobs],
  )

  if (!configured) {
    return (
      <div>
        <PageHeader title="Jobs" />
        <Panel title="EVE sign-in required">
          <p className="text-sm opacity-70">
            Configure <code className="text-xs">VITE_EVE_CLIENT_ID</code> to track in-game industry jobs.
          </p>
        </Panel>
      </div>
    )
  }

  if (characters.length === 0) {
    return (
      <div>
        <PageHeader title="Jobs" />
        <Panel title="Sign in to track jobs">
          <p className="text-sm opacity-70 mb-4">
            Connect a character to see live manufacturing, research, and reaction jobs from EVE.
          </p>
          <button type="button" className="btn btn-primary btn-sm" disabled={isBusy} onClick={() => void login()}>
            Sign in with EVE
          </button>
        </Panel>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Jobs"
        subtitle="Live in-game industry jobs per character. Plan timelines stay separate on the Plan page."
      />

      {!hasAll ? (
        <div className="alert alert-warning text-sm">
          <span>
            This character is missing scopes: {missing.join(', ')}. Sign in again to enable jobs and inventory.
          </span>
          <button type="button" className="btn btn-sm" disabled={isBusy} onClick={() => void login()}>
            Re-authorize
          </button>
        </div>
      ) : null}

      <TabRail
        ariaLabel="Characters"
        selectedId={String(viewCharacterId ?? '')}
        onSelect={(id) => {
          const characterId = Number(id)
          setViewCharacterId(characterId)
          switchCharacter(characterId)
        }}
        items={characters.map((character) => ({
          id: String(character.characterId),
          label: character.characterName,
          icon: (
            <CharacterAvatar
              characterId={character.characterId}
              name={character.characterName}
              size={20}
            />
          ),
          count: activeJobCountByCharacter.get(character.characterId) ?? 0,
        }))}
      />

      {sdeLoading || jobsLoading ? <LoadingState /> : null}

      {jobsError ? (
        <div className="alert alert-error text-sm">
          <span>{jobsError instanceof Error ? jobsError.message : 'Failed to load jobs'}</span>
          <button type="button" className="btn btn-sm" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="plan-view-tabs">
        <div className="plan-view-tabs__bar" role="tablist" aria-label="Job categories">
          <div className="plan-view-tabs__list">
            {JOB_TABS.map((tab) => {
              const selected = activeTab === tab.id
              const count = tab.id === 'manufacturing' ? manufacturingActiveCount : researchActiveCount
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`jobs-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`jobs-tabpanel-${tab.id}`}
                  title={tab.hint}
                  className={`plan-view-tabs__tab${selected ? ' plan-view-tabs__tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <JobTabIcon tab={tab.id} />
                  <span>{tab.label}</span>
                  {count > 0 ? (
                    <span className="badge badge-ghost badge-xs tabular-nums">{count}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div
          className="plan-view-tabs__panel flex flex-col gap-4"
          role="tabpanel"
          id={`jobs-tabpanel-${activeTab}`}
          aria-labelledby={`jobs-tab-${activeTab}`}
        >
          <Panel
            title={activeTab === 'manufacturing' ? 'Manufacturing stats' : 'Research stats'}
            actions={
              <button type="button" className="btn btn-ghost btn-xs" disabled={isFetching} onClick={() => void refetch()}>
                {isFetching ? 'Refreshing…' : 'Refresh'}
              </button>
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase opacity-50">Active jobs</p>
                <p className="text-lg font-semibold tabular-nums">{activeTabJobs.length}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase opacity-50">
                  {activeTab === 'manufacturing' ? 'Industry slots' : 'Lab slots'}
                </p>
                <p className="text-lg font-semibold tabular-nums">{slots}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase opacity-50">Slots in use</p>
                <p className="text-lg font-semibold tabular-nums">
                  {lanes.filter((lane) => lane.jobCount > 0).length}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase opacity-50">Ready to deliver</p>
                <p className="text-lg font-semibold tabular-nums">
                  {tabJobs.filter((j) => j.status === 'ready').length}
                </p>
              </div>
            </div>
          </Panel>

          <section ref={timelineRef} className="plan-build-card plan-timeline">
            <div className="plan-build-card__header">
              <h2 className="plan-build-card__title">
                {activeTab === 'manufacturing' ? 'Manufacturing timeline' : 'Research timeline'}
              </h2>
            </div>
            <div className="plan-build-card__body plan-timeline__body">
              <div className="plan-timeline__hero">
                <div className="plan-timeline__slots-panel">
                  <ManufacturingSlotsRow
                    slots={slotRingProps}
                    selectedSlotIndex={focusedSlotIndex}
                    onSelectSlot={handleSelectSlot}
                    emptyHint={
                      activeTab === 'manufacturing'
                        ? 'No active manufacturing jobs'
                        : 'No active research jobs'
                    }
                  />
                </div>
              </div>
              <SlotGanttChart
                lanes={lanes}
                formatTick={formatTick}
                formatBarRange={formatBarRange}
                formatBarMeta={formatBarMeta}
                blueprintTypeIdByProduct={blueprintTypeIdByProduct}
                focusedLaneId={focusedLaneId}
                onFocusedLaneChange={handleFocusedLaneChange}
                nowRatio={nowRatio}
                emptyMessage={
                  activeTab === 'manufacturing'
                    ? 'No active manufacturing jobs for this character.'
                    : 'No active research jobs for this character.'
                }
                title="In-game job schedule"
              />
            </div>
          </section>

          <Panel title="Job list">
            {activeTabJobs.length === 0 ? (
              <p className="text-sm opacity-60">
                {activeTab === 'manufacturing'
                  ? 'No active manufacturing jobs. Start production in EVE, then refresh.'
                  : 'No active research jobs. Start ME, TE, or copying in EVE, then refresh.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-compact w-full">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide opacity-50">
                      <th>Product</th>
                      <th>{activeTab === 'research' ? 'Progress' : 'Runs'}</th>
                      <th>Status</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTabJobs.map((job) => (
                      <JobListRow
                        key={job.jobId}
                        job={job}
                        nowMs={nowMs}
                        researchTab={activeTab === 'research'}
                        selected={focusedSlotIndex != null && jobIdToSlot.get(job.jobId) === focusedSlotIndex}
                        onSelect={() => handleSelectJob(job.jobId)}
                        onOpenGraph={openGraph}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </section>

      <p className="text-xs opacity-50">
        Need supply planning?{' '}
        <button type="button" className="link link-primary" onClick={() => navigate('/plan')}>
          Open Plan
        </button>
      </p>

      {graphBlueprint ? (
        <BlueprintGraphModal
          variant="modal"
          blueprint={graphBlueprint}
          hub={settings.primaryHub}
          settings={manufacturingSettings}
          onClose={() => setGraphProductTypeId(null)}
          onOpenPage={openGraphPage}
        />
      ) : null}
    </div>
  )
}
