import type { PlanPipeline, PlanPipelineStage } from '@/lib/planPipeline'
import { formatDecimal } from '@/lib/profit'
import { EveImage } from '@/components/EveImage'

const ACTIVITY_LABEL: Record<PlanPipelineStage['activity'], string> = {
  copy: 'Copy',
  invention: 'Invention',
  manufacture: 'Manufacture',
  reaction: 'Reaction',
}

interface PlanPipelineChecklistProps {
  pipeline: PlanPipeline | null
  typeMap?: Map<number, { name: string }>
  onOpenMeTe?: (productTypeId: number) => void
}

export function PlanPipelineChecklist({
  pipeline,
  typeMap,
  onOpenMeTe,
}: PlanPipelineChecklistProps) {
  if (!pipeline || pipeline.stages.length === 0) {
    return (
      <p className="text-sm opacity-60 py-4">
        No research or manufacturing stages. Add a build-mode root (buy-mode T2 skips copy and
        invention).
      </p>
    )
  }

  const science = pipeline.stages.filter((s) => s.pool === 'science')
  const manufacturing = pipeline.stages.filter((s) => s.pool === 'manufacturing')
  const reactions = pipeline.stages.filter((s) => s.pool === 'reaction')

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <p className="text-xs opacity-60">
        Science slots: {pipeline.scienceSlots} · Manufacturing slots: {pipeline.manufacturingSlots}
        · Reaction slots: {pipeline.reactionSlots}
      </p>

      {science.length > 0 ? (
        <StageGroup
          title="Science (copy → invention)"
          stages={science}
          allStages={pipeline.stages}
          typeMap={typeMap}
        />
      ) : null}

      <StageGroup
        title="Manufacturing"
        stages={manufacturing}
        allStages={pipeline.stages}
        typeMap={typeMap}
        onOpenMeTe={onOpenMeTe}
      />

      {reactions.length > 0 ? (
        <StageGroup
          title="Reactions"
          stages={reactions}
          allStages={pipeline.stages}
          typeMap={typeMap}
          onOpenMeTe={onOpenMeTe}
        />
      ) : null}
    </div>
  )
}

function StageGroup({
  title,
  stages,
  allStages,
  typeMap,
  onOpenMeTe,
}: {
  title: string
  stages: PlanPipelineStage[]
  allStages: PlanPipelineStage[]
  typeMap?: Map<number, { name: string }>
  onOpenMeTe?: (productTypeId: number) => void
}) {
  return (
    <section className="min-w-0">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="overflow-x-auto border border-eve-border rounded-lg">
        <table className="table table-sm w-full">
          <thead className="bg-base-300/80">
            <tr className="text-xs">
              <th>Step</th>
              <th>Activity</th>
              <th className="text-right">Runs / attempts</th>
              <th className="text-right">Duration / job</th>
              <th>Depends on</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage.id} className="text-sm">
                <td>
                  <div className="flex items-center gap-2 min-w-0">
                    <EveImage id={stage.productTypeId} size={24} framed alt="" />
                    {onOpenMeTe &&
                    (stage.activity === 'manufacture' || stage.activity === 'reaction') ? (
                      <button
                        type="button"
                        className="link link-hover truncate text-left"
                        onClick={() => onOpenMeTe(stage.productTypeId)}
                      >
                        {stage.name}
                      </button>
                    ) : (
                      <span className="truncate">{stage.name}</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="badge badge-ghost badge-sm">{ACTIVITY_LABEL[stage.activity]}</span>
                </td>
                <td className="text-right tabular-nums">{formatDecimal(stage.runs, 0)}</td>
                <td className="text-right tabular-nums">{formatDecimal(stage.durationHours, 1)}h</td>
                <td className="text-xs opacity-70">
                  {stage.dependsOn.length === 0
                    ? '—'
                    : stage.dependsOn
                        .map((id) => {
                          const dep = allStages.find((s) => s.id === id)
                          return dep ? ACTIVITY_LABEL[dep.activity] : id
                        })
                        .join(', ')}
                  {stage.datacoreTypeIds && stage.datacoreTypeIds.length > 0 ? (
                    <div className="opacity-60 mt-0.5">
                      Datacores:{' '}
                      {stage.datacoreTypeIds
                        .map((id) => typeMap?.get(id)?.name ?? `Type ${id}`)
                        .join(', ')}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
