import { StatCard } from '@/components/StatCard'
import { formatCpu, formatMw } from '@/lib/fitting/fitSkills'
import type { FitLoad } from '@/lib/fitting/types'

export function FitLoadStats({ load }: { load: FitLoad }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
      <StatCard
        label="Powergrid"
        value={`${formatMw(load.powerUsed)} / ${formatMw(load.powerOutput)}`}
        description={load.powerOk ? 'Under cap' : 'Over cap'}
        accent={load.powerOk ? 'success' : 'warning'}
        valueClassName="text-lg"
        className="min-w-0"
      />
      <StatCard
        label="CPU"
        value={`${formatCpu(load.cpuUsed)} / ${formatCpu(load.cpuOutput)}`}
        description={load.cpuOk ? 'Under cap' : 'Over cap'}
        accent={load.cpuOk ? 'success' : 'warning'}
        valueClassName="text-lg"
        className="min-w-0"
      />
    </div>
  )
}
