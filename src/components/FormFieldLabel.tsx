import { InfoTooltip } from '@/components/InfoTooltip'

interface FormFieldLabelProps {
  label: string
  tooltip?: string
  valueLabel?: string | number
  size?: 'md' | 'sm'
}

export function FormFieldLabel({
  label,
  tooltip,
  valueLabel,
  size = 'md',
}: FormFieldLabelProps) {
  return (
    <div className="label py-1 min-h-0">
      <span
        className={`label-text inline-flex items-center gap-1.5 min-w-0 ${size === 'sm' ? 'text-xs' : ''}`}
      >
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      {valueLabel != null && (
        <span className="label-text-alt text-primary tabular-nums">{valueLabel}</span>
      )}
    </div>
  )
}
