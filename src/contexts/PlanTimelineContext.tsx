import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { simulationForPair } from '@/lib/planSimulator'
import type { PlanNode, PlanNodeSimulation, PlanTimeBucket } from '@/types'

export interface PlanTimelineState {
  windowHours: number
  viewportStart: number
  viewportEnd: number
  playheadHours: number
  selectedSupplierId: number | null
  selectedConsumerId: number | null
  pairBuckets: PlanTimeBucket[]
  simulations: Map<number, PlanNodeSimulation>
  nodes: PlanNode[]
  setViewport: (start: number, end: number) => void
  setPlayheadHours: (hours: number) => void
  setSelectedPair: (supplierId: number | null, consumerId: number | null) => void
}

const PlanTimelineContext = createContext<PlanTimelineState | null>(null)

export function PlanTimelineProvider({
  windowHours,
  nodes,
  simulations,
  defaultSupplierId,
  defaultConsumerId,
  children,
}: {
  windowHours: number
  nodes: PlanNode[]
  simulations: Map<number, PlanNodeSimulation>
  defaultSupplierId: number | null
  defaultConsumerId: number | null
  children: ReactNode
}) {
  const [viewportStart, setViewportStart] = useState(0)
  const [viewportEnd, setViewportEnd] = useState(() => Math.min(48, windowHours))
  const [playheadHours, setPlayheadHours] = useState(() => Math.min(24, windowHours / 2))
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null)
  const [selectedConsumerId, setSelectedConsumerId] = useState<number | null>(null)

  useEffect(() => {
    setViewportEnd((prev) => Math.min(prev, windowHours))
    setPlayheadHours((prev) => Math.min(prev, windowHours))
  }, [windowHours])

  useEffect(() => {
    if (selectedSupplierId != null && selectedConsumerId != null) return
    if (defaultSupplierId != null && defaultConsumerId != null) {
      setSelectedSupplierId(defaultSupplierId)
      setSelectedConsumerId(defaultConsumerId)
    }
  }, [defaultSupplierId, defaultConsumerId, selectedSupplierId, selectedConsumerId])

  const pairBuckets = useMemo(
    () =>
      selectedSupplierId != null && selectedConsumerId != null
        ? simulationForPair(simulations, selectedSupplierId, selectedConsumerId)
        : [],
    [simulations, selectedSupplierId, selectedConsumerId],
  )

  const value = useMemo<PlanTimelineState>(
    () => ({
      windowHours,
      viewportStart,
      viewportEnd,
      playheadHours,
      selectedSupplierId,
      selectedConsumerId,
      pairBuckets,
      simulations,
      nodes,
      setViewport: (start, end) => {
        setViewportStart(Math.max(0, start))
        setViewportEnd(Math.min(windowHours, Math.max(start + 1, end)))
      },
      setPlayheadHours: (hours) => setPlayheadHours(Math.max(0, Math.min(windowHours, hours))),
      setSelectedPair: (supplierId, consumerId) => {
        setSelectedSupplierId(supplierId)
        setSelectedConsumerId(consumerId)
      },
    }),
    [
      windowHours,
      viewportStart,
      viewportEnd,
      playheadHours,
      selectedSupplierId,
      selectedConsumerId,
      pairBuckets,
      simulations,
      nodes,
    ],
  )

  return <PlanTimelineContext.Provider value={value}>{children}</PlanTimelineContext.Provider>
}

export function usePlanTimeline(): PlanTimelineState {
  const ctx = useContext(PlanTimelineContext)
  if (!ctx) throw new Error('usePlanTimeline must be used within PlanTimelineProvider')
  return ctx
}

export function inventoryAtPlayhead(
  simulations: Map<number, PlanNodeSimulation>,
  productTypeId: number,
  playheadHours: number,
): number {
  const sim = simulations.get(productTypeId)
  if (!sim || sim.buckets.length === 0) return 0
  let best = sim.buckets[0]
  for (const b of sim.buckets) {
    if (b.hour <= playheadHours) best = b
    else break
  }
  return best.inventory
}
