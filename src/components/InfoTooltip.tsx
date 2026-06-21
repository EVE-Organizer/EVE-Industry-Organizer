import { Tooltip, type TooltipPlacement } from '@/components/Tooltip'

interface InfoTooltipProps {
  text: string
  placement?: TooltipPlacement
  className?: string
}

export function InfoTooltip({ text, placement = 'right', className = '' }: InfoTooltipProps) {
  return (
    <Tooltip text={text} placement={placement} className={className}>
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-current opacity-50 hover:opacity-100 cursor-help text-[10px] font-bold leading-none"
        aria-label={text}
        tabIndex={0}
      >
        i
      </span>
    </Tooltip>
  )
}
