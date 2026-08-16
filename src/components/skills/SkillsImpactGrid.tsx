import type { ReactNode } from 'react'
import {
  BrokerIcon,
  IndustryGroupIcon,
  InventionIcon,
  MarketGroupIcon,
  QueueIcon,
  ReactionIcon,
  ScienceGroupIcon,
  SlotIcon,
  SpRateIcon,
  TaxIcon,
  TimeCutIcon,
  TrainingGroupIcon,
} from '@/components/skills/SkillsImpactIcons'
import type { SkillImpactSummary } from '@/lib/skillImpact'
import { formatTrainingDuration } from '@/lib/skillTraining'

interface SkillsImpactGridProps {
  impact: SkillImpactSummary
  trainedImpact?: SkillImpactSummary | null
  spPerMinute: number | null
  queueFinishSeconds: number | null
}

type ImpactValueTone = 'neutral' | 'positive' | 'cost'

function ImpactGroup({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="skills-impact__group">
      <div className="skills-impact__group-head">
        <span className="skills-impact__group-icon">{icon}</span>
        <h3 className="skills-impact__group-title">{title}</h3>
      </div>
      <div className="skills-impact__metrics">{children}</div>
    </div>
  )
}

function ImpactMetric({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: ImpactValueTone
}) {
  return (
    <div className="skills-impact__metric">
      <span className="skills-impact__metric-icon">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="skills-impact__metric-label">{label}</div>
        <div className={`skills-impact__metric-value skills-impact__metric-value--${tone}`}>{value}</div>
        {hint ? <div className="skills-impact__metric-hint">{hint}</div> : null}
      </div>
    </div>
  )
}

export function SkillsImpactGrid({
  impact,
  trainedImpact,
  spPerMinute,
  queueFinishSeconds,
}: SkillsImpactGridProps) {
  const mfgSlotsHint =
    trainedImpact && impact.manufacturingSlots !== trainedImpact.manufacturingSlots
      ? `Trained ${trainedImpact.manufacturingSlots}`
      : undefined

  return (
    <section className="skills-page__card skills-impact">
      <h2 className="skills-page__section-title mb-3">Impact</h2>
      <div className="skills-impact__grid">
        <ImpactGroup title="Manufacturing" icon={<IndustryGroupIcon />}>
          <ImpactMetric
            icon={<SlotIcon />}
            label="Mfg slots"
            value={impact.manufacturingSlots}
            hint={mfgSlotsHint}
          />
          <ImpactMetric
            icon={<TimeCutIcon />}
            label="Mfg time"
            value={`−${impact.manufacturingTimeCutPercent}%`}
            tone={impact.manufacturingTimeCutPercent > 0 ? 'positive' : 'neutral'}
          />
          <ImpactMetric
            icon={<ReactionIcon />}
            label="Reaction time"
            value={`−${impact.reactionTimeCutPercent}%`}
            tone={impact.reactionTimeCutPercent > 0 ? 'positive' : 'neutral'}
          />
        </ImpactGroup>

        <ImpactGroup title="Science" icon={<ScienceGroupIcon />}>
          <ImpactMetric icon={<SlotIcon />} label="Sci slots" value={impact.scienceSlots} />
          <ImpactMetric
            icon={<InventionIcon />}
            label="Invention"
            value={`${impact.inventionChancePercent.toFixed(1)}%`}
            tone="positive"
          />
        </ImpactGroup>

        <ImpactGroup title="Market" icon={<MarketGroupIcon />}>
          <ImpactMetric
            icon={<TaxIcon />}
            label="Sales tax"
            value={`${impact.salesTaxPercent.toFixed(2)}%`}
            tone="cost"
          />
          <ImpactMetric
            icon={<BrokerIcon />}
            label="Broker fee"
            value={`${impact.brokerFeePercent.toFixed(2)}%`}
            tone="cost"
          />
        </ImpactGroup>

        <ImpactGroup title="Training" icon={<TrainingGroupIcon />}>
          <ImpactMetric
            icon={<SpRateIcon />}
            label="SP / min"
            value={spPerMinute != null ? spPerMinute.toFixed(1) : '—'}
          />
          <ImpactMetric
            icon={<QueueIcon />}
            label="Queue total"
            value={formatTrainingDuration(queueFinishSeconds)}
          />
        </ImpactGroup>
      </div>
    </section>
  )
}
